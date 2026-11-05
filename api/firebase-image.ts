import firebaseConfig from '../firebase-applet-config.json';

const PROJECT_ID = firebaseConfig.projectId || 'gen-lang-client-0103247541';
const DATABASE_ID =
  firebaseConfig.firestoreDatabaseId || 'ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012';

/**
 * Fetches an uploaded sponsor image document from the Firebase Firestore server
 * (`/sponsor_assets/{assetId}`) and returns the binary Buffer and MIME type.
 */
export async function fetchFirebaseImageBuffer(
  assetId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  if (!assetId || !/^[a-zA-Z0-9_-]{3,128}$/.test(assetId)) {
    return null;
  }

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    PROJECT_ID
  )}/databases/${encodeURIComponent(DATABASE_ID)}/documents/sponsor_assets/${encodeURIComponent(
    assetId
  )}`;

  const response = await fetch(firestoreUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const docJson = (await response.json()) as {
    fields?: {
      imageData?: { stringValue?: string };
      mimeType?: { stringValue?: string };
      fileName?: { stringValue?: string };
    };
  };

  const base64Data = docJson?.fields?.imageData?.stringValue;
  const mimeType = docJson?.fields?.mimeType?.stringValue || 'image/jpeg';
  const fileName = docJson?.fields?.fileName?.stringValue || `${assetId}.jpg`;

  if (!base64Data) {
    return null;
  }

  const buffer = Buffer.from(base64Data, 'base64');
  return { buffer, mimeType, fileName };
}

/**
 * Serverless handler (`GET /api/firebase-image?id=<assetId>`)
 * Streams the permanently stored Firebase image as raw binary with its image Content-Type.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawId = req.query?.id || '';
  const assetId = Array.isArray(rawId) ? rawId[0] : String(rawId).trim();

  if (!assetId) {
    return res.status(400).json({ status: 'error', message: 'Missing image id parameter' });
  }

  try {
    const result = await fetchFirebaseImageBuffer(assetId);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Image not found on Firebase server' });
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', String(result.buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    return res.status(200).send(result.buffer);
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to load image from Firebase server',
    });
  }
}
