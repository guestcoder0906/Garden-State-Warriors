import React, { useEffect, useRef, useState } from 'react';
import {
  extractFirebaseAssetId,
  getCachedFirebaseAssetUrl,
  resolveFirebaseAssetDirect,
} from '../services/firebaseStorage';

export interface SheetImageProps {
  src?: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  hideWhenBroken?: boolean;
  onStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

function isSheetsImagesRtUrl(url: string): boolean {
  return /^https:\/\/docs\.google\.com\/sheets-images-rt\//i.test(url);
}

function isGoogleHostedImageUrl(url: string): boolean {
  return (
    isSheetsImagesRtUrl(url) ||
    /^https:\/\/[^/]*\.googleusercontent\.com\//i.test(url)
  );
}

function extractDriveFileIdFromLh3(url: string): string | null {
  const m = url.match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
  return m?.[1] || null;
}

/**
 * Resilient, zero-flicker image renderer for all Google Sheets, CellImage (sheets-images-rt),
 * Firebase Firestore asset, and external media URLs:
 * 1. Double-buffers image updates: once loaded, keeps displaying the current image cleanly
 *    while preloading rotated/updated URLs in an offscreen Image object, so background syncs
 *    NEVER cause loaded images to flash blank or disappear.
 * 2. Keeps `crossOrigin="anonymous"` for `docs.google.com/sheets-images-rt/` across retries
 *    (required because Google serves `Cross-Origin-Resource-Policy: same-site` + `ACAO: *`).
 * 3. Resolves Firebase asset URLs (`/api/firebase-image?id=...`) client-side via Firestore SDK.
 */
export const SheetImage: React.FC<SheetImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  wrapperClassName = '',
  referrerPolicy = 'no-referrer',
  hideWhenBroken = true,
  onStatusChange,
}) => {
  const cleanSrc = (src || '').trim();

  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (!cleanSrc) return '';
    const fbId = extractFirebaseAssetId(cleanSrc);
    if (fbId) {
      return getCachedFirebaseAssetUrl(fbId) || '';
    }
    return cleanSrc;
  });

  const [corsMode, setCorsMode] = useState<'anonymous' | undefined>(() =>
    cleanSrc && !extractFirebaseAssetId(cleanSrc) && isGoogleHostedImageUrl(cleanSrc)
      ? 'anonymous'
      : undefined
  );

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() =>
    cleanSrc ? 'loading' : 'error'
  );

  const attemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedEntityRef = useRef<string>('');
  const resolvedSrcRef = useRef<string>(resolvedSrc);
  const statusRef = useRef<'loading' | 'loaded' | 'error'>(status);

  resolvedSrcRef.current = resolvedSrc;
  statusRef.current = status;

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    let cancelled = false;
    attemptRef.current = 0;

    if (!cleanSrc) {
      loadedEntityRef.current = '';
      setResolvedSrc('');
      setStatus('error');
      onStatusChange?.('error');
      return;
    }

    const fbId = extractFirebaseAssetId(cleanSrc);
    if (fbId) {
      const cached = getCachedFirebaseAssetUrl(fbId);
      if (cached) {
        setCorsMode(undefined);
        if (resolvedSrcRef.current !== cached) {
          setResolvedSrc(cached);
          setStatus('loading');
          onStatusChange?.('loading');
        }
        return;
      }

      setCorsMode(undefined);
      setResolvedSrc('');
      setStatus('loading');
      onStatusChange?.('loading');

      resolveFirebaseAssetDirect(fbId).then((objUrl) => {
        if (cancelled) return;
        if (objUrl) {
          setResolvedSrc(objUrl);
        } else {
          setStatus('error');
          onStatusChange?.('error');
        }
      });

      return () => {
        cancelled = true;
      };
    }

    const needsCors = isGoogleHostedImageUrl(cleanSrc);

    // If this component already has a loaded image for the same item (e.g. background sync
    // rotated a sheets-images-rt signed token or updated the photo), preload offscreen first
    // so the visible image NEVER disappears or flashes opacity-0!
    if (
      statusRef.current === 'loaded' &&
      resolvedSrcRef.current &&
      resolvedSrcRef.current !== cleanSrc &&
      loadedEntityRef.current === alt
    ) {
      const preloader = new Image();
      if (needsCors) preloader.crossOrigin = 'anonymous';
      preloader.referrerPolicy = referrerPolicy;
      preloader.onload = () => {
        if (cancelled) return;
        setCorsMode(needsCors ? 'anonymous' : undefined);
        setResolvedSrc(cleanSrc);
        setStatus('loaded');
        onStatusChange?.('loaded');
      };
      preloader.onerror = () => {
        // Keep displaying the already-loaded image instead of blanking out if transient error
      };
      preloader.src = cleanSrc;

      return () => {
        cancelled = true;
        preloader.onload = null;
        preloader.onerror = null;
      };
    }

    if (resolvedSrcRef.current === cleanSrc && statusRef.current === 'loaded') {
      return;
    }

    setCorsMode(needsCors ? 'anonymous' : undefined);
    setResolvedSrc(cleanSrc);
    setStatus('loading');
    onStatusChange?.('loading');

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [cleanSrc, alt, referrerPolicy]);

  const handleLoad = () => {
    loadedEntityRef.current = alt;
    setStatus('loaded');
    onStatusChange?.('loaded');
  };

  const handleError = () => {
    const attempt = attemptRef.current;
    attemptRef.current = attempt + 1;

    // Firebase URLs should never fall through once Firestore resolution failed
    if (extractFirebaseAssetId(cleanSrc)) {
      setStatus('error');
      onStatusChange?.('error');
      return;
    }

    if (isSheetsImagesRtUrl(cleanSrc)) {
      // Never strip crossOrigin="anonymous" on sheets-images-rt because CORP: same-site requires it.
      if (attempt === 0) {
        retryTimerRef.current = setTimeout(() => {
          setResolvedSrc('');
          requestAnimationFrame(() => {
            setCorsMode('anonymous');
            setResolvedSrc(cleanSrc);
          });
        }, 650);
        return;
      }

      if (attempt === 1) {
        // Fallback: if resized =s900 failed, try original =s2048 once
        const origSized = cleanSrc.replace(/=s900(\?|$)/i, '=s2048$1');
        retryTimerRef.current = setTimeout(() => {
          setCorsMode('anonymous');
          setResolvedSrc('');
          requestAnimationFrame(() => setResolvedSrc(origSized));
        }, 1200);
        return;
      }
    } else if (isGoogleHostedImageUrl(cleanSrc)) {
      if (attempt === 0) {
        retryTimerRef.current = setTimeout(() => {
          setResolvedSrc('');
          requestAnimationFrame(() => {
            setCorsMode('anonymous');
            setResolvedSrc(cleanSrc);
          });
        }, 650);
        return;
      }

      if (attempt === 1) {
        setCorsMode(undefined);
        setResolvedSrc('');
        requestAnimationFrame(() => setResolvedSrc(cleanSrc));
        return;
      }

      const driveId = extractDriveFileIdFromLh3(cleanSrc);
      if (attempt === 2 && driveId) {
        setCorsMode(undefined);
        setResolvedSrc(`https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`);
        return;
      }
    } else if (attempt === 0) {
      retryTimerRef.current = setTimeout(() => {
        setResolvedSrc('');
        requestAnimationFrame(() => setResolvedSrc(cleanSrc));
      }, 650);
      return;
    }

    setStatus('error');
    onStatusChange?.('error');
  };

  if (!cleanSrc || (status === 'error' && hideWhenBroken)) {
    return null;
  }

  const imgElement = resolvedSrc ? (
    <img
      src={resolvedSrc}
      alt={alt}
      crossOrigin={corsMode}
      referrerPolicy={referrerPolicy}
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      className={`${className} transition-opacity duration-200 ${
        status === 'loaded' ? 'opacity-100' : 'opacity-0'
      }`}
    />
  ) : null;

  if (!wrapperClassName) {
    return (
      <>
        {status === 'loading' && !resolvedSrc && (
          <div className="w-full h-full bg-white/[0.04] animate-pulse" aria-hidden="true" />
        )}
        {imgElement}
      </>
    );
  }

  return (
    <div className={`relative ${wrapperClassName}`}>
      {status === 'loading' && (
        <div
          className="absolute inset-0 bg-white/[0.04] animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}
      {imgElement}
    </div>
  );
};

interface PlayerPhotoPairProps {
  jerseyPhotoUrl?: string;
  profilePictureUrl?: string;
  playerName?: string;
  aspectClassName?: string;
  jerseyAltFallback?: string;
  profileAltFallback?: string;
}

/**
 * Renders Player/Captain Jersey Photo first and Profile Picture second.
 * - If Jersey is missing or fails to load (e.g. restricted Drive link), Profile Picture
 *   automatically takes the full main image width.
 * - If both are provided and load cleanly, both display side-by-side (Jersey first, Profile second).
 * - If both are missing or fail, collapses cleanly without showing broken image icons.
 */
export const PlayerPhotoPair: React.FC<PlayerPhotoPairProps> = ({
  jerseyPhotoUrl,
  profilePictureUrl,
  playerName,
  aspectClassName = 'aspect-square',
  jerseyAltFallback = 'Warrior Jersey',
  profileAltFallback = 'Warrior Profile',
}) => {
  const [jerseyStatus, setJerseyStatus] = useState<'loading' | 'loaded' | 'error'>(
    jerseyPhotoUrl ? 'loading' : 'error'
  );
  const [profileStatus, setProfileStatus] = useState<'loading' | 'loaded' | 'error'>(
    profilePictureUrl ? 'loading' : 'error'
  );
  const prevPlayerRef = useRef<string | undefined>(playerName);

  useEffect(() => {
    if (!jerseyPhotoUrl) {
      setJerseyStatus('error');
    } else if (prevPlayerRef.current !== playerName || jerseyStatus === 'error') {
      setJerseyStatus('loading');
    }
  }, [jerseyPhotoUrl, playerName]);

  useEffect(() => {
    if (!profilePictureUrl) {
      setProfileStatus('error');
    } else if (prevPlayerRef.current !== playerName || profileStatus === 'error') {
      setProfileStatus('loading');
    }
    prevPlayerRef.current = playerName;
  }, [profilePictureUrl, playerName]);

  const showJersey = Boolean(jerseyPhotoUrl) && jerseyStatus !== 'error';
  const showProfile = Boolean(profilePictureUrl) && profileStatus !== 'error';

  if (!showJersey && !showProfile) {
    return null;
  }

  return (
    <div
      className={`${
        showJersey && showProfile ? 'grid grid-cols-2 gap-0.5' : ''
      } ${aspectClassName} bg-[#080E0B] overflow-hidden`}
    >
      {showJersey && (
        <SheetImage
          src={jerseyPhotoUrl}
          alt={playerName ? `${playerName} Jersey` : jerseyAltFallback}
          wrapperClassName="w-full h-full overflow-hidden"
          className="w-full h-full object-cover"
          onStatusChange={setJerseyStatus}
        />
      )}
      {showProfile && (
        <SheetImage
          src={profilePictureUrl}
          alt={playerName ? `${playerName} Profile` : profileAltFallback}
          wrapperClassName="w-full h-full overflow-hidden"
          className="w-full h-full object-cover"
          onStatusChange={setProfileStatus}
        />
      )}
    </div>
  );
};

interface WarriorAvatarProps {
  jerseyPhotoUrl?: string;
  profilePictureUrl?: string;
  fallbackSrc: string;
  alt: string;
}

/**
 * Circular avatar that prefers jerseyPhotoUrl -> profilePictureUrl -> fallbackSrc (team crest).
 */
export const WarriorAvatar: React.FC<WarriorAvatarProps> = ({
  jerseyPhotoUrl,
  profilePictureUrl,
  fallbackSrc,
  alt,
}) => {
  const [jerseyFailed, setJerseyFailed] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);

  useEffect(() => {
    setJerseyFailed(false);
  }, [jerseyPhotoUrl]);

  useEffect(() => {
    setProfileFailed(false);
  }, [profilePictureUrl]);

  const activeUrl =
    (jerseyPhotoUrl && !jerseyFailed ? jerseyPhotoUrl : undefined) ||
    (profilePictureUrl && !profileFailed ? profilePictureUrl : undefined);

  if (!activeUrl) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        className="w-10 h-10 object-contain rounded-full shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <SheetImage
      src={activeUrl}
      alt={alt}
      wrapperClassName="w-10 h-10 rounded-full overflow-hidden shrink-0"
      className="w-10 h-10 object-cover rounded-full"
      hideWhenBroken={false}
      onStatusChange={(s) => {
        if (s === 'error') {
          if (activeUrl === jerseyPhotoUrl) {
            setJerseyFailed(true);
          } else {
            setProfileFailed(true);
          }
        }
      }}
    />
  );
};
