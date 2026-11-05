import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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

// Validate connection to Firestore on boot
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

/**
 * Compresses an uploaded image file in the browser so that it is crisp (up to 900px)
 * and guaranteed to fit comfortably inside a permanent Firebase document (< 450KB).
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
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
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
        // Keep transparency for PNGs if small enough, otherwise flatten on dark/white or use PNG/JPEG
        const isPng = file.type === 'image/png';
        const outputMime = isPng ? 'image/png' : 'image/jpeg';
        let encodedDataUrl = canvas.toDataURL(outputMime, quality);
        ctx.drawImage(img, 0, 0, width, height);
        encodedDataUrl = canvas.toDataURL(outputMime, quality);

        // If PNG is larger than 650KB, re-encode as high-quality JPEG so it never exceeds Firestore's 1MB limit
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

// In-memory cache of resolved Firebase asset Blob/Object URLs for instant rendering
const firebaseAssetUrlCache = new Map<string, string>();

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
 * Uploads a Sponsor Logo / Flyer file permanently to the Firebase server
 * (`/sponsor_assets/{assetId}` in Firestore database `ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012`)
 * and returns a real, permanent HTTP image URL (`https://<domain>/api/firebase-image?id={assetId}`).
 *
 * Never returns a base64 string. Throws if the upload fails.
 */
export async function uploadSponsorImageToFirebase(
  file: File,
  sponsorName = ''
): Promise<{ url: string; assetId: string }> {
  const { mimeType, base64Payload } = await encodeImageFileForFirebase(file);

  const sanitizedBase = (file.name || 'logo')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const assetId = `sp_${Date.now()}_${randomSuffix}_${sanitizedBase || 'logo'}`.slice(0, 120);

  const cleanFileName = (file.name || 'sponsor-logo.jpg')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
  const cleanSponsorName = (sponsorName || '').trim().slice(0, 180);

  const docPath = `sponsor_assets/${assetId}`;
  try {
    await setDoc(doc(db, 'sponsor_assets', assetId), {
      assetId,
      fileName: cleanFileName || 'sponsor-logo.jpg',
      mimeType,
      imageData: base64Payload,
      sponsorName: cleanSponsorName,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }

  // Construct the permanent HTTP image URL served from /api/firebase-image?id={assetId}
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-nzia7s26ovtoydhj7rfqsp-195196720664.us-west2.run.app';
  const permanentUrl = `${origin}/api/firebase-image?id=${encodeURIComponent(assetId)}`;

  return {
    url: permanentUrl,
    assetId,
  };
}

/**
 * Fetches an uploaded sponsor image directly from the Firebase server by assetId
 * and returns a browser Object URL (or data URL) as a direct fallback if /api/firebase-image
 * is ever accessed from a static-only host.
 */
export async function resolveFirebaseAssetDirect(assetId: string): Promise<string | null> {
  if (!assetId) return null;
  const cached = firebaseAssetUrlCache.get(assetId);
  if (cached) return cached;

  const docPath = `sponsor_assets/${assetId}`;
  try {
    const snap = await getDoc(doc(db, 'sponsor_assets', assetId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data?.imageData || !data?.mimeType) return null;

    const binaryStr = atob(String(data.imageData));
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: String(data.mimeType) });
    const objectUrl = URL.createObjectURL(blob);
    firebaseAssetUrlCache.set(assetId, objectUrl);
    return objectUrl;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, docPath);
    } catch {
      return null;
    }
  }
}
