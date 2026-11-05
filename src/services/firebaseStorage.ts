import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent, Analytics } from 'firebase/analytics';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const effectiveMeasurementId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID) ||
  firebaseConfig.measurementId ||
  '';

const appConfig = {
  ...firebaseConfig,
  ...(effectiveMeasurementId ? { measurementId: effectiveMeasurementId } : {}),
};

const app = getApps().length > 0 ? getApp() : initializeApp(appConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

let analyticsInstance: Analytics | null = null;

/**
 * Initializes Google Analytics (Firebase Analytics + gtag.js if a Measurement ID is present)
 * for website traffic and event tracking.
 */
export async function initWebsiteAnalytics(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (effectiveMeasurementId && !(window as any).gtag) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
        effectiveMeasurementId
      )}`;
      document.head.appendChild(script);

      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: any[]) {
        (window as any).dataLayer.push(args);
      }
      (window as any).gtag = gtag;
      gtag('js', new Date());
      gtag('config', effectiveMeasurementId, { send_page_view: true });
    }

    const supported = await isAnalyticsSupported();
    if (supported && effectiveMeasurementId) {
      analyticsInstance = getAnalytics(app);
    }
  } catch {
    // Ignore analytics blockers (e.g. adblockers or offline preview)
  }
}

export function trackPageView(sectionName: string, subTab?: string): void {
  if (typeof window === 'undefined') return;
  const pagePath = subTab ? `/${sectionName}/${subTab}` : `/${sectionName}`;
  const pageTitle = `Garden State Warriors - ${sectionName}${subTab ? ` (${subTab})` : ''}`;

  try {
    if (analyticsInstance) {
      logEvent(analyticsInstance, 'page_view', {
        page_path: pagePath,
        page_title: pageTitle,
      });
    }
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: pageTitle,
      });
    }
  } catch {
    // Ignore analytics errors
  }
}

export function trackCustomEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  try {
    if (analyticsInstance) {
      logEvent(analyticsInstance, eventName, params);
    }
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', eventName, params);
    }
  } catch {
    // Ignore analytics errors
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot (100% client-side)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();
initWebsiteAnalytics();

function base64ToObjectUrl(base64Payload: string, mimeType: string): string {
  const binaryStr = atob(base64Payload);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Compresses any uploaded image file (PNG, JPG, WebP, GIF, AVIF, BMP, SVG, etc.) in the browser
 * so that it is crisp (up to 900px) and guaranteed to fit comfortably inside a permanent Firebase document (< 450KB).
 */
async function encodeImageFileForFirebase(
  file: File,
  maxDimension = 900,
  quality = 0.82
): Promise<{ mimeType: string; base64Payload: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => {
        // If browser Image decoder cannot rasterize a specialized format, store raw base64 if < 650KB
        const commaIdx = dataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        if (rawBase64 && rawBase64.length <= 700000) {
          resolve({
            mimeType: file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg',
            base64Payload: rawBase64,
          });
        } else {
          reject(new Error('Unsupported or oversized image format'));
        }
      };
      img.onload = () => {
        let width = img.width || 600;
        let height = img.height || 600;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        const keepPng = file.type === 'image/png' || file.type === 'image/svg+xml';
        const outputMime = keepPng ? 'image/png' : 'image/jpeg';
        ctx.drawImage(img, 0, 0, width, height);
        let encodedDataUrl = canvas.toDataURL(outputMime, quality);

        let finalMime = outputMime;
        if (encodedDataUrl.length > 650000) {
          finalMime = 'image/jpeg';
          encodedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        }
        if (encodedDataUrl.length > 850000) {
          finalMime = 'image/jpeg';
          encodedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
        }

        const commaIdx = encodedDataUrl.indexOf(',');
        const base64Payload = commaIdx >= 0 ? encodedDataUrl.slice(commaIdx + 1) : encodedDataUrl;
        resolve({
          mimeType: finalMime,
          base64Payload,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// In-memory cache of resolved Firebase asset Object URLs for instant client-side rendering
const firebaseAssetUrlCache = new Map<string, string>();
const inFlightAssetPromises = new Map<string, Promise<string | null>>();

/**
 * Extracts the Firebase assetId from:
 * - https://<any-domain>/api/firebase-image?id=<assetId>
 * - /api/firebase-image?id=<assetId>
 * - https://firestore.googleapis.com/.../documents/sponsor_assets/<assetId>
 */
export function extractFirebaseAssetId(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();

  const apiMatch = trimmed.match(/\/api\/firebase-image\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i);
  if (apiMatch?.[1]) {
    return apiMatch[1];
  }

  const firestoreMatch = trimmed.match(/\/documents\/sponsor_assets\/([a-zA-Z0-9_-]+)/i);
  if (firestoreMatch?.[1]) {
    return firestoreMatch[1];
  }

  return null;
}

/**
 * Uploads any image file permanently to the Firebase server (100% client-side, serverless)
 * (`/sponsor_assets/{assetId}` in Firestore database `ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012`)
 * and returns the permanent HTTP URL to store in Google Sheets plus an immediate client-side preview URL.
 */
export async function uploadSponsorImageToFirebase(
  file: File,
  ownerLabel = '',
  prefix = 'sp'
): Promise<{ url: string; previewUrl: string; assetId: string }> {
  const { mimeType, base64Payload } = await encodeImageFileForFirebase(file);

  const sanitizedBase = (file.name || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '') || 'img';
  const assetId = `${safePrefix}_${Date.now()}_${randomSuffix}_${sanitizedBase || 'img'}`.slice(
    0,
    120
  );

  const cleanFileName = (file.name || 'uploaded-image.jpg')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
  const cleanSponsorName = (ownerLabel || '').trim().slice(0, 180);

  const docPath = `sponsor_assets/${assetId}`;
  try {
    await setDoc(doc(db, 'sponsor_assets', assetId), {
      assetId,
      fileName: cleanFileName || 'uploaded-image.jpg',
      mimeType,
      imageData: base64Payload,
      sponsorName: cleanSponsorName,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }

  // Cache the client-side ObjectURL immediately so it renders in 0ms without any server roundtrip
  const previewUrl = base64ToObjectUrl(base64Payload, mimeType);
  firebaseAssetUrlCache.set(assetId, previewUrl);

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-nzia7s26ovtoydhj7rfqsp-195196720664.us-west2.run.app';
  const permanentUrl = `${origin}/api/firebase-image?id=${encodeURIComponent(assetId)}`;

  return {
    url: permanentUrl,
    previewUrl,
    assetId,
  };
}

/**
 * Uploads multiple images (up to 5 max) permanently to the Firebase server in parallel
 * for the Become a Warrior `MediaUrlsCsv` field.
 */
export async function uploadMultipleImagesToFirebase(
  files: File[],
  ownerLabel = ''
): Promise<{ urls: string[]; previewUrls: string[]; assetIds: string[] }> {
  const limited = files.slice(0, 5);
  const uploadedList = await Promise.all(
    limited.map((f, idx) => uploadSponsorImageToFirebase(f, ownerLabel, `war_m${idx + 1}`))
  );
  return {
    urls: uploadedList.map((u) => u.url),
    previewUrls: uploadedList.map((u) => u.previewUrl),
    assetIds: uploadedList.map((u) => u.assetId),
  };
}

/**
 * Fetches an uploaded image 100% client-side directly from the Firebase server by assetId
 * using the client Firebase SDK (`getDoc(doc(db, 'sponsor_assets', assetId))`).
 */
export async function resolveFirebaseAssetDirect(assetId: string): Promise<string | null> {
  if (!assetId) return null;
  const cached = firebaseAssetUrlCache.get(assetId);
  if (cached) return cached;

  const existingPromise = inFlightAssetPromises.get(assetId);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    const docPath = `sponsor_assets/${assetId}`;
    try {
      const snap = await getDoc(doc(db, 'sponsor_assets', assetId));
      if (!snap.exists()) return null;
      const data = snap.data();
      if (!data?.imageData || !data?.mimeType) return null;

      const objectUrl = base64ToObjectUrl(String(data.imageData), String(data.mimeType));
      firebaseAssetUrlCache.set(assetId, objectUrl);
      return objectUrl;
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch {
        return null;
      }
    } finally {
      inFlightAssetPromises.delete(assetId);
    }
  })();

  inFlightAssetPromises.set(assetId, promise);
  return promise;
}

/**
 * If a URL from Google Sheets is a Firebase asset URL (`/api/firebase-image?id=<assetId>` or
 * `firestore.googleapis.com/.../sponsor_assets/<assetId>`), resolves it 100% client-side
 * via the Firebase SDK so no server is required to display the image.
 */
export async function resolveSheetUrlIfFirebase(rawUrl?: string): Promise<string | undefined> {
  if (!rawUrl) return rawUrl;
  const assetId = extractFirebaseAssetId(rawUrl);
  if (!assetId) return rawUrl;
  const resolved = await resolveFirebaseAssetDirect(assetId);
  return resolved || rawUrl;
}
