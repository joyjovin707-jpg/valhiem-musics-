import fs from 'node:fs';
import dotenv from 'dotenv';
import express from 'express';
import {
  MediaEngineError,
  ensureYtDlp,
  extractMediaInfo,
  getStoredFile,
  prepareMediaDownload,
  prepareZipArchive,
  verifyRangeToken,
  verifySegmentToken,
  type PrepareDownloadInput,
} from './mediaEngine.ts';

dotenv.config();

function decodeCookiesInput(cookiesText?: string, cookiesB64?: string): string | undefined {
  if (typeof cookiesB64 === 'string' && cookiesB64.trim()) {
    try {
      return Buffer.from(cookiesB64.trim(), 'base64').toString('utf8');
    } catch {
      // fall back to plain text
    }
  }
  return typeof cookiesText === 'string' && cookiesText.trim() ? cookiesText : undefined;
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Warm up yt-dlp binary check in background when running in non-serverless environments
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    void ensureYtDlp().catch(() => {});
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/extract', async (req, res) => {
    try {
      const { url, cookiesText, cookiesB64 } = req.body as {
        url?: string;
        cookiesText?: string;
        cookiesB64?: string;
      };
      const result = await extractMediaInfo(
        url || '',
        decodeCookiesInput(cookiesText, cookiesB64),
      );
      res.json(result);
    } catch (err) {
      if (err instanceof MediaEngineError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to extract media info.',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  app.post('/api/prepare-download', async (req, res) => {
    try {
      const body = req.body as PrepareDownloadInput & { cookiesB64?: string };
      if (!body?.url || !body?.title) {
        res.status(400).json({
          error: 'Missing required track URL or title.',
          code: 'INVALID_REQUEST',
        });
        return;
      }
      const prepared = await prepareMediaDownload({
        ...body,
        cookiesText: decodeCookiesInput(body.cookiesText, body.cookiesB64),
      });
      res.json(prepared);
    } catch (err) {
      if (err instanceof MediaEngineError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to prepare download.',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  app.post('/api/prepare-zip', async (req, res) => {
    try {
      const { archiveTitle, tracks } = req.body as {
        archiveTitle?: string;
        tracks?: Array<PrepareDownloadInput & { cookiesB64?: string }>;
      };
      const prepared = await prepareZipArchive({
        archiveTitle: archiveTitle || 'playlist',
        tracks: Array.isArray(tracks)
          ? tracks.map((t) => ({
              ...t,
              cookiesText: decodeCookiesInput(t.cookiesText, t.cookiesB64),
            }))
          : [],
      });
      res.json(prepared);
    } catch (err) {
      if (err instanceof MediaEngineError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to build ZIP archive.',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  app.get('/api/proxy-segment', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const targetUrl = token ? verifySegmentToken(token) : null;
    if (!targetUrl) {
      res.status(403).json({ error: 'Invalid or expired media segment token.' });
      return;
    }

    try {
      const upstream = await fetch(targetUrl, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Segment fetch failed.' });
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') || 'application/octet-stream',
      );
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(buf);
    } catch {
      res.status(502).json({ error: 'Upstream segment request timed out.' });
    }
  });

  app.get('/api/proxy-range', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const targetUrl = token ? verifyRangeToken(token) : null;
    if (!targetUrl) {
      res.status(403).json({ error: 'Invalid or expired range token.' });
      return;
    }

    const start = Math.max(0, Number.parseInt(String(req.query.start ?? '0'), 10) || 0);
    const requestedEnd = Number.parseInt(String(req.query.end ?? String(start + 2_097_151)), 10);
    const maxChunk = 2_500_000;
    const end = Math.min(
      Number.isFinite(requestedEnd) && requestedEnd >= start
        ? requestedEnd
        : start + 2_097_151,
      start + maxChunk - 1,
    );

    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          Range: `bytes=${start}-${end}`,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: 'Upstream range fetch failed.' });
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      res.status(upstream.status === 206 ? 206 : 200);
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') || 'video/mp4',
      );
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Accept-Ranges', 'bytes');
      res.send(buf);
    } catch {
      res.status(502).json({ error: 'Upstream range request timed out.' });
    }
  });

  app.get('/api/file/:fileId', (req, res) => {
    const entry = getStoredFile(req.params.fileId);
    if (!entry || !fs.existsSync(entry.filePath)) {
      res.status(404).json({
        error: 'Download link expired or file not found. Please prepare the track again.',
        code: 'FILE_NOT_FOUND',
      });
      return;
    }

    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(entry.filename)}`,
    );
    res.setHeader('X-Resolved-Source', entry.resolvedSource);

    const rangeHeader = req.headers.range;
    if (rangeHeader && entry.sizeBytes > 0) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = Number.parseInt(match[1], 10);
        const rawEnd = match[2] ? Number.parseInt(match[2], 10) : entry.sizeBytes - 1;
        const end = Math.min(rawEnd, entry.sizeBytes - 1);
        if (start >= 0 && start <= end && end < entry.sizeBytes) {
          const chunkSize = end - start + 1;
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${entry.sizeBytes}`);
          res.setHeader('Content-Length', String(chunkSize));
          fs.createReadStream(entry.filePath, { start, end }).pipe(res);
          return;
        }
      }
    }

    res.setHeader('Content-Length', String(entry.sizeBytes));
    const stream = fs.createReadStream(entry.filePath);
    stream.pipe(res);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'API endpoint not found.',
      code: 'NOT_FOUND',
    });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) return;
      if (err instanceof MediaEngineError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 500;
      const message =
        err instanceof Error ? err.message : 'Unexpected server error.';
      res.status(status).json({ error: message, code: 'INTERNAL_ERROR' });
    },
  );

  return app;
}
