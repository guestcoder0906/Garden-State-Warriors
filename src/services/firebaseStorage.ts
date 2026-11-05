import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

function getFirebaseStorageInstance() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const bucketUrl = firebaseConfig.storageBucket
    ? firebaseConfig.storageBucket.startsWith('gs://')
      ? firebaseConfig.storageBucket
      : `gs://${firebaseConfig.storageBucket}`
    : undefined;
  return getStorage(app, bucketUrl);
}

/**
 * Uploads a Sponsor Logo / Flyer file to Firebase Storage (`sponsors/<timestamp>-<filename>`)
 * and returns the public Firebase download URL (`https://firebasestorage.googleapis.com/...`).
 * If Firebase Storage is unreachable or restricted by bucket rules, returns null so the caller
 * can seamlessly fall back to Apps Script DriveApp / compressed data URL upload.
 */
export async function uploadSponsorImageToFirebase(file: File): Promise<string | null> {
  try {
    const storage = getFirebaseStorageInstance();
    const cleanName = (file.name || 'sponsor-logo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `sponsors/${Date.now()}_${cleanName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = (async () => {
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg',
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    })();

    const timeoutTask = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 6500);
    });

    return await Promise.race([uploadTask, timeoutTask]);
  } catch {
    return null;
  }
}
