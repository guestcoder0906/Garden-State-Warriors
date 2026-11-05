import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import firebaseImageHandler from './api/firebase-image';
import syncHandler from './api/sync';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ limit: '5mb' }));

  // Permanent Firebase Image Endpoint (/api/firebase-image?id=<assetId>)
  app.all('/api/firebase-image', async (req, res) => {
    await firebaseImageHandler(req, res);
  });

  // Google Sheets Sync & Sponsor Submission Endpoint (/api/sync)
  app.all('/api/sync', async (req, res) => {
    await syncHandler(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
