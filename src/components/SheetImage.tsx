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

function isGoogleHostedImageUrl(url: string): boolean {
  return (
    /^https:\/\/docs\.google\.com\/sheets-images-rt\//i.test(url) ||
    /^https:\/\/[^/]*\.googleusercontent\.com\//i.test(url)
  );
}

function extractDriveFileIdFromLh3(url: string): string | null {
  const m = url.match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
  return m?.[1] || null;
}

/**
 * Resilient image renderer for all Google Sheets, CellImage (sheets-images-rt),
 * Firebase Firestore asset, and external media URLs:
 * 1. Resolves Firebase asset URLs (`/api/firebase-image?id=...` or Firestore doc URLs)
 *    100% client-side via Firestore SDK before setting `<img src>`, preventing 404/HTML flashes in dev.
 * 2. Uses `crossOrigin="anonymous"` for `docs.google.com/sheets-images-rt/` and `googleusercontent.com`
 *    so `Cross-Origin-Resource-Policy: same-site` does not block cross-site rendering
 *    (they return `Access-Control-Allow-Origin: *`), with automatic fallback retries.
 * 3. Retries once on transient network glitches and cleanly collapses broken external links
 *    (such as private Drive links) instead of displaying broken-image icons.
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

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    let cancelled = false;
    attemptRef.current = 0;

    if (!cleanSrc) {
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
        setResolvedSrc(cached);
        setStatus('loading');
        onStatusChange?.('loading');
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

    setCorsMode(isGoogleHostedImageUrl(cleanSrc) ? 'anonymous' : undefined);
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
  }, [cleanSrc]);

  const handleLoad = () => {
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

    if (isGoogleHostedImageUrl(cleanSrc)) {
      // Attempt 0 failed with crossOrigin="anonymous": retry once after brief delay (transient 429/blip)
      if (attempt === 0) {
        retryTimerRef.current = setTimeout(() => {
          setResolvedSrc('');
          requestAnimationFrame(() => {
            setCorsMode('anonymous');
            setResolvedSrc(cleanSrc);
          });
        }, 700);
        return;
      }

      // Attempt 1: try without crossOrigin attribute (for CDN edges that don't send ACAO headers)
      if (attempt === 1) {
        setCorsMode(undefined);
        setResolvedSrc('');
        requestAnimationFrame(() => setResolvedSrc(cleanSrc));
        return;
      }

      // Attempt 2: if Google Drive lh3 URL, try drive thumbnail endpoint once
      const driveId = extractDriveFileIdFromLh3(cleanSrc);
      if (attempt === 2 && driveId) {
        setCorsMode(undefined);
        setResolvedSrc(`https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`);
        return;
      }
    } else if (attempt === 0) {
      // Retry generic external image once after transient network error
      retryTimerRef.current = setTimeout(() => {
        setResolvedSrc('');
        requestAnimationFrame(() => setResolvedSrc(cleanSrc));
      }, 700);
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

  useEffect(() => {
    setJerseyStatus(jerseyPhotoUrl ? 'loading' : 'error');
  }, [jerseyPhotoUrl]);

  useEffect(() => {
    setProfileStatus(profilePictureUrl ? 'loading' : 'error');
  }, [profilePictureUrl]);

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

