import type { MediaPlatform, PreparedFileResponse } from '../types/media';

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatTotalDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '—';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m ${Math.floor(totalSeconds % 60)}s`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function platformLabel(platform: MediaPlatform): string {
  switch (platform) {
    case 'spotify':
      return 'Spotify';
    case 'youtube':
      return 'YouTube';
    case 'soundcloud':
      return 'SoundCloud';
    case 'bandcamp':
      return 'Bandcamp';
    case 'vimeo':
      return 'Vimeo';
    default:
      return 'Web Media';
  }
}

export function resolvedSourceLabel(
  source?: PreparedFileResponse['resolvedSource'],
): string {
  switch (source) {
    case 'youtube-direct':
      return 'YouTube stream';
    case 'soundcloud-match':
      return 'SoundCloud audio match';
    case 'audius-match':
      return 'Audius audio match';
    case 'spotify-preview':
      return '30s preview audio';
    case 'direct':
    default:
      return 'Direct stream';
  }
}

export interface DownloadTriggerOptions {
  inlineDataUrl?: string;
  proxiedSegments?: string[];
  chunkedDownload?: boolean;
  sizeBytes?: number;
  fallbackRangeUrl?: string;
  fallbackTotalBytes?: number;
  mimeType?: string;
}

function saveBlobAsFile(blob: Blob, filename?: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename || 'download';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
}

async function fetchRangeChunks(
  url: string,
  totalBytes: number,
  chunkSize = 2_000_000,
): Promise<ArrayBuffer[]> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < totalBytes; start += chunkSize) {
    ranges.push({ start, end: Math.min(start + chunkSize - 1, totalBytes - 1) });
  }
  const buffers: ArrayBuffer[] = new Array(ranges.length);
  let cursor = 0;
  const concurrency = Math.min(3, ranges.length);

  const worker = async () => {
    while (cursor < ranges.length) {
      const i = cursor++;
      const { start, end } = ranges[i];
      const res = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
      });
      if (!res.ok && res.status !== 206) {
        throw new Error(`Chunk ${i + 1} failed (${res.status})`);
      }
      buffers[i] = await res.arrayBuffer();
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return buffers;
}

async function fetchProxyRangeChunks(
  baseProxyUrl: string,
  totalBytes?: number,
  chunkSize = 2_000_000,
): Promise<ArrayBuffer[]> {
  if (totalBytes && totalBytes > 0) {
    const ranges: Array<{ start: number; end: number }> = [];
    for (let start = 0; start < totalBytes; start += chunkSize) {
      ranges.push({ start, end: Math.min(start + chunkSize - 1, totalBytes - 1) });
    }
    const buffers: ArrayBuffer[] = new Array(ranges.length);
    let cursor = 0;
    const concurrency = Math.min(3, ranges.length);
    const worker = async () => {
      while (cursor < ranges.length) {
        const i = cursor++;
        const { start, end } = ranges[i];
        const sep = baseProxyUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${baseProxyUrl}${sep}start=${start}&end=${end}`);
        if (!res.ok && res.status !== 206) {
          throw new Error(`Proxy range ${i + 1} failed (${res.status})`);
        }
        buffers[i] = await res.arrayBuffer();
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return buffers;
  }

  const buffers: ArrayBuffer[] = [];
  let start = 0;
  while (true) {
    const end = start + chunkSize - 1;
    const sep = baseProxyUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${baseProxyUrl}${sep}start=${start}&end=${end}`);
    if (!res.ok && res.status !== 206) {
      throw new Error(`Proxy range failed (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) break;
    buffers.push(buf);
    const contentRange = res.headers.get('content-range');
    const totalMatch = contentRange?.match(/\/(\d+)$/);
    const total = totalMatch ? Number.parseInt(totalMatch[1], 10) : 0;
    start += buf.byteLength;
    if ((total > 0 && start >= total) || buf.byteLength < chunkSize) {
      break;
    }
  }
  return buffers;
}

export async function triggerBrowserDownload(
  url: string,
  filename?: string,
  options?: DownloadTriggerOptions,
): Promise<void> {
  try {
    if (options?.inlineDataUrl) {
      const res = await fetch(options.inlineDataUrl);
      const blob = await res.blob();
      saveBlobAsFile(blob, filename);
      return;
    }

    if (options?.proxiedSegments && options.proxiedSegments.length > 0) {
      const segs = options.proxiedSegments;
      const buffers: ArrayBuffer[] = new Array(segs.length);
      let cursor = 0;
      const concurrency = Math.min(4, segs.length);
      const worker = async () => {
        while (cursor < segs.length) {
          const i = cursor++;
          const res = await fetch(segs[i]);
          if (!res.ok) throw new Error(`Segment ${i + 1} failed (${res.status})`);
          buffers[i] = await res.arrayBuffer();
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      const blob = new Blob(buffers, {
        type: options.mimeType || 'audio/mp4',
      });
      saveBlobAsFile(blob, filename);
      return;
    }

    if (options?.chunkedDownload && options.sizeBytes && options.sizeBytes > 0) {
      try {
        const buffers = await fetchRangeChunks(url, options.sizeBytes);
        const blob = new Blob(buffers, {
          type: options.mimeType || 'video/mp4',
        });
        saveBlobAsFile(blob, filename);
        return;
      } catch (err) {
        if (options.fallbackRangeUrl) {
          const buffers = await fetchProxyRangeChunks(
            options.fallbackRangeUrl,
            options.fallbackTotalBytes,
          );
          const blob = new Blob(buffers, {
            type: options.mimeType || 'video/mp4',
          });
          saveBlobAsFile(blob, filename);
          return;
        }
        throw err;
      }
    }

    if (options?.fallbackRangeUrl && !url) {
      const buffers = await fetchProxyRangeChunks(
        options.fallbackRangeUrl,
        options.fallbackTotalBytes,
      );
      const blob = new Blob(buffers, {
        type: options.mimeType || 'video/mp4',
      });
      saveBlobAsFile(blob, filename);
      return;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Download stream failed');
    const blob = await res.blob();
    saveBlobAsFile(blob, filename);
  } catch {
    if (options?.fallbackRangeUrl) {
      try {
        const buffers = await fetchProxyRangeChunks(
          options.fallbackRangeUrl,
          options.fallbackTotalBytes,
        );
        const blob = new Blob(buffers, {
          type: options.mimeType || 'video/mp4',
        });
        saveBlobAsFile(blob, filename);
        return;
      } catch {
        // fall through to direct anchor
      }
    }
    const anchor = document.createElement('a');
    anchor.href = options?.inlineDataUrl || url;
    if (filename) {
      anchor.download = filename;
    }
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}
