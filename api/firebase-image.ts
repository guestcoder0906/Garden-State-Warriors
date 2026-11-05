const PROJECT_ID = 'gen-lang-client-0103247541';
const DATABASE_ID = 'ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012';

function decodeBase64ToBytes(base64Str: string): Uint8Array {
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Pure zero-import Vercel Serverless Function (`GET /api/firebase-image?id=<assetId>`).
 * Fetches the permanently uploaded sponsor image from the Firebase server REST endpoint
 * and returns the binary image with its Content-Type header when opened directly in a browser.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawId = req.query?.id || '';
  const assetId = Array.isArray(rawId) ? rawId[0] : String(rawId).trim();

  if (!assetId || !/^[a-zA-Z0-9_-]{3,128}$/.test(assetId)) {
    return res.status(400).json({ status: 'error', message: 'Invalid or missing image id' });
  }

  try {
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
      return res.status(404).json({ status: 'error', message: 'Image not found on Firebase server' });
    }

    const docJson: any = await response.json();
    const base64Data: string | undefined = docJson?.fields?.imageData?.stringValue;
    const mimeType: string = docJson?.fields?.mimeType?.stringValue || 'image/jpeg';
    const fileName: string = docJson?.fields?.fileName?.stringValue || `${assetId}.jpg`;

    if (!base64Data) {
      return res.status(404).json({ status: 'error', message: 'Image payload missing' });
    }

    const bytes = decodeBase64ToBytes(base64Data);
    const body = typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(bytes.byteLength));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.status(200).send(body);
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err?.message || 'Failed to load image from Firebase server',
    });
  }
}
