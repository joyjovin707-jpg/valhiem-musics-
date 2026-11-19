import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ClipboardPaste,
  KeyRound,
  Link2,
  Loader2,
  X,
} from 'lucide-react';
import { CookiesModal } from './components/CookiesModal';
import { PlaylistWorkbench } from './components/PlaylistWorkbench';
import { QueuePanel } from './components/QueuePanel';
import { SingleMediaPanel } from './components/SingleMediaPanel';
import type {
  AudioBitrate,
  DownloadMode,
  ExtractedCollection,
  MediaFormat,
  MediaTrackItem,
  PreparedFileResponse,
  QueueHistoryItem,
  TrackJobStatus,
  VideoQuality,
} from './types/media';
import { triggerBrowserDownload } from './utils/formatters';

const SAMPLE_URLS = [
  {
    label: 'Spotify Track',
    url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  },
  {
    label: 'Spotify Playlist',
    url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  },
  {
    label: 'YouTube Playlist',
    url: 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6puJdseH2Rt9sMvt9E2M4i',
  },
  {
    label: 'YouTube Video',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  },
];

function encodeCookiesB64(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const bytes = new TextEncoder().encode(trimmed);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  } catch {
    return undefined;
  }
}

async function parseApiJson<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`${fallbackError} (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.startsWith('<')) {
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      const titleHint = titleMatch?.[1]?.trim();
      if (res.status === 504 || trimmed.includes('timeout')) {
        throw new Error(
          `Request timed out on the server (HTTP ${res.status}). Try a shorter video, lower quality (480p/360p), or Audio mode.`,
        );
      }
      if (res.status === 413 || trimmed.includes('payload') || trimmed.includes('too large')) {
        throw new Error(
          `File exceeded the serverless payload limit (HTTP ${res.status}). Try a lower resolution or Audio mode.`,
        );
      }
      throw new Error(
        `Server returned an HTML error page (HTTP ${res.status}${titleHint ? `: ${titleHint}` : ''}). Please try again or switch to Audio mode.`,
      );
    }
    throw new Error(`${fallbackError}: ${text.slice(0, 120)}`);
  }
}

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [collection, setCollection] = useState<ExtractedCollection | null>(null);

  // Format settings
  const [mode, setMode] = useState<DownloadMode>('audio');
  const [format, setFormat] = useState<MediaFormat>('mp3');
  const [bitrate, setBitrate] = useState<AudioBitrate>('320');
  const [quality, setQuality] = useState<VideoQuality>('1080');

  // Playlist selection & statuses
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trackStatuses, setTrackStatuses] = useState<
    Record<string, TrackJobStatus>
  >({});
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isZipRunning, setIsZipRunning] = useState(false);
  const [zipError, setZipError] = useState<string | undefined>(undefined);
  const batchCancelRef = useRef(false);

  // Queue / History
  const [history, setHistory] = useState<QueueHistoryItem[]>([]);

  // Optional YouTube session cookies
  const [cookiesModalOpen, setCookiesModalOpen] = useState(false);
  const [cookiesText, setCookiesText] = useState<string>(() => {
    try {
      return sessionStorage.getItem('soundpress_yt_cookies') || '';
    } catch {
      return '';
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (cookiesText) {
        sessionStorage.setItem('soundpress_yt_cookies', cookiesText);
      } else {
        sessionStorage.removeItem('soundpress_yt_cookies');
      }
    } catch {
      // ignore storage errors
    }
  }, [cookiesText]);

  const handleModeChange = (nextMode: DownloadMode) => {
    setMode(nextMode);
    if (nextMode === 'audio') {
      if (format === 'mp4' || format === 'webm') {
        setFormat('mp3');
      }
    } else {
      if (format !== 'mp4' && format !== 'webm') {
        setFormat('mp4');
      }
    }
  };

  const runExtract = useCallback(
    async (targetUrl: string) => {
      const cleaned = targetUrl.trim();
      if (!cleaned) {
        setExtractError('Paste a URL from Spotify, YouTube, or SoundCloud.');
        return;
      }

      setIsExtracting(true);
      setExtractError(null);
      setZipError(undefined);
      batchCancelRef.current = true;
      setIsBatchRunning(false);

      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: cleaned,
            cookiesB64: encodeCookiesB64(cookiesText),
          }),
        });

        const data = await parseApiJson<
          ExtractedCollection | { error?: string }
        >(res, 'Unable to analyze this URL.');

        if (!res.ok || !('tracks' in data)) {
          throw new Error(
            ('error' in data && data.error) ||
              'Unable to analyze this URL. Please check that it is public.',
          );
        }

        setCollection(data);
        setSelectedIds(new Set(data.tracks.map((t) => t.id)));
        setTrackStatuses({});

        if (!data.isVideoCapable) {
          setMode('audio');
          setFormat((prev) =>
            prev === 'mp4' || prev === 'webm' ? 'mp3' : prev,
          );
        }
      } catch (err) {
        setCollection(null);
        setExtractError(
          err instanceof Error
            ? err.message
            : 'Could not extract metadata from this URL.',
        );
      } finally {
        setIsExtracting(false);
      }
    },
    [cookiesText],
  );

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runExtract(urlInput);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
        void runExtract(text.trim());
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const prepareAndTriggerTrack = useCallback(
    async (
      track: MediaTrackItem,
      override?: { mode: DownloadMode; format: MediaFormat },
    ): Promise<boolean> => {
      const activeMode = override?.mode ?? mode;
      const activeFormat = override?.format ?? format;
      const jobId = `${track.id}-${Date.now()}`;

      setTrackStatuses((prev) => ({
        ...prev,
        [track.id]: { state: 'resolving' },
      }));

      setHistory((prev) => [
        {
          id: jobId,
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          platform: track.platform,
          mode: activeMode,
          format: activeFormat,
          state: 'resolving',
          createdAt: Date.now(),
        },
        ...prev.slice(0, 49),
      ]);

      try {
        const res = await fetch('/api/prepare-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: track.url,
            title: track.title,
            artist: track.artist,
            album: track.album || (collection?.kind === 'album' ? collection.title : undefined),
            thumbnail: track.thumbnail || collection?.thumbnail,
            durationSec: track.durationSec,
            previewUrl: track.previewUrl,
            platform: track.platform,
            mode: activeMode,
            format: activeFormat,
            bitrate,
            quality,
            cookiesB64: encodeCookiesB64(cookiesText),
          }),
        });

        const payload = await parseApiJson<
          PreparedFileResponse | { error?: string; code?: string }
        >(res, 'Download failed.');

        if (!res.ok || !('downloadUrl' in payload)) {
          const errorMessage =
            ('error' in payload && payload.error) || 'Download failed.';
          const errorCode =
            'code' in payload ? payload.code : undefined;

          setTrackStatuses((prev) => ({
            ...prev,
            [track.id]: {
              state: 'error',
              message: errorMessage,
              errorCode,
            },
          }));

          setHistory((prev) =>
            prev.map((item) =>
              item.id === jobId
                ? {
                    ...item,
                    state: 'error',
                    errorMessage,
                    errorCode,
                  }
                : item,
            ),
          );
          return false;
        }

        setTrackStatuses((prev) => ({
          ...prev,
          [track.id]: {
            state: 'ready',
            resolvedSource: payload.resolvedSource,
            downloadUrl: payload.downloadUrl,
            inlineDataUrl: payload.inlineDataUrl,
            proxiedSegments: payload.proxiedSegments,
            chunkedDownload: payload.chunkedDownload,
            fallbackRangeUrl: payload.fallbackRangeUrl,
            fallbackTotalBytes: payload.fallbackTotalBytes,
            mimeType: payload.mimeType,
            filename: payload.filename,
            sizeBytes: payload.sizeBytes,
          },
        }));

        setHistory((prev) =>
          prev.map((item) =>
            item.id === jobId
              ? {
                  ...item,
                  state: 'ready',
                  resolvedSource: payload.resolvedSource,
                  downloadUrl: payload.downloadUrl,
                  inlineDataUrl: payload.inlineDataUrl,
                  proxiedSegments: payload.proxiedSegments,
                  chunkedDownload: payload.chunkedDownload,
                  fallbackRangeUrl: payload.fallbackRangeUrl,
                  fallbackTotalBytes: payload.fallbackTotalBytes,
                  mimeType: payload.mimeType,
                  filename: payload.filename,
                  sizeBytes: payload.sizeBytes,
                }
              : item,
          ),
        );

        await triggerBrowserDownload(payload.downloadUrl, payload.filename, {
          inlineDataUrl: payload.inlineDataUrl,
          proxiedSegments: payload.proxiedSegments,
          chunkedDownload: payload.chunkedDownload,
          sizeBytes: payload.sizeBytes,
          fallbackRangeUrl: payload.fallbackRangeUrl,
          fallbackTotalBytes: payload.fallbackTotalBytes,
          mimeType: payload.mimeType,
        });
        return true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Network error during download.';
        setTrackStatuses((prev) => ({
          ...prev,
          [track.id]: { state: 'error', message: msg },
        }));
        setHistory((prev) =>
          prev.map((item) =>
            item.id === jobId
              ? { ...item, state: 'error', errorMessage: msg }
              : item,
          ),
        );
        return false;
      }
    },
    [bitrate, collection, cookiesText, format, mode, quality],
  );

  const handleDownloadSelectedSeparately = async (tracks: MediaTrackItem[]) => {
    if (tracks.length === 0) return;
    batchCancelRef.current = false;
    setIsBatchRunning(true);
    setZipError(undefined);

    setTrackStatuses((prev) => {
      const next = { ...prev };
      for (const t of tracks) {
        next[t.id] = { state: 'queued' };
      }
      return next;
    });

    // Process up to 3 tracks concurrently for much faster batch preparation
    let cursor = 0;
    const concurrency = Math.min(3, tracks.length);
    const worker = async () => {
      while (cursor < tracks.length) {
        if (batchCancelRef.current) break;
        const idx = cursor++;
        const track = tracks[idx];
        await prepareAndTriggerTrack(track);
        await new Promise((r) => setTimeout(r, 350));
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (batchCancelRef.current) {
      setTrackStatuses((prev) => {
        const next = { ...prev };
        for (const t of tracks) {
          if (next[t.id]?.state === 'queued') {
            next[t.id] = { state: 'idle' };
          }
        }
        return next;
      });
    }

    setIsBatchRunning(false);
  };

  const handleSaveAllPrepared = async (readyTracks: MediaTrackItem[]) => {
    for (const track of readyTracks) {
      const status = trackStatuses[track.id];
      if (status?.downloadUrl) {
        await triggerBrowserDownload(status.downloadUrl, status.filename, {
          inlineDataUrl: status.inlineDataUrl,
          proxiedSegments: status.proxiedSegments,
          chunkedDownload: status.chunkedDownload,
          sizeBytes: status.sizeBytes,
          fallbackRangeUrl: status.fallbackRangeUrl,
          fallbackTotalBytes: status.fallbackTotalBytes,
          mimeType: status.mimeType,
        });
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  };

  const handleStopBatch = () => {
    batchCancelRef.current = true;
    setIsBatchRunning(false);
  };

  const handleDownloadSelectedZip = async (tracks: MediaTrackItem[]) => {
    if (!collection || tracks.length === 0) return;
    setIsZipRunning(true);
    setZipError(undefined);

    try {
      const res = await fetch('/api/prepare-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archiveTitle: collection.title,
          tracks: tracks.map((t) => ({
            url: t.url,
            title: t.title,
            artist: t.artist,
            album: t.album || (collection.kind === 'album' ? collection.title : undefined),
            thumbnail: t.thumbnail || collection.thumbnail,
            durationSec: t.durationSec,
            previewUrl: t.previewUrl,
            platform: t.platform,
            mode,
            format,
            bitrate,
            quality,
            cookiesB64: encodeCookiesB64(cookiesText),
          })),
        }),
      });

      const payload = await parseApiJson<
        PreparedFileResponse | { error?: string }
      >(res, 'Could not create ZIP archive.');

      if (!res.ok || !('downloadUrl' in payload)) {
        throw new Error(
          ('error' in payload && payload.error) || 'Could not create ZIP archive.',
        );
      }

      setHistory((prev) => [
        {
          id: `zip-${Date.now()}`,
          trackId: collection.id,
          title: `${collection.title} (${tracks.length} tracks ZIP)`,
          artist: collection.creator,
          platform: collection.platform,
          mode,
          format,
          state: 'ready',
          resolvedSource: payload.resolvedSource,
          downloadUrl: payload.downloadUrl,
          inlineDataUrl: payload.inlineDataUrl,
          proxiedSegments: payload.proxiedSegments,
          chunkedDownload: payload.chunkedDownload,
          fallbackRangeUrl: payload.fallbackRangeUrl,
          fallbackTotalBytes: payload.fallbackTotalBytes,
          mimeType: payload.mimeType,
          filename: payload.filename,
          sizeBytes: payload.sizeBytes,
          createdAt: Date.now(),
        },
        ...prev.slice(0, 49),
      ]);

      await triggerBrowserDownload(payload.downloadUrl, payload.filename, {
        inlineDataUrl: payload.inlineDataUrl,
        proxiedSegments: payload.proxiedSegments,
        chunkedDownload: payload.chunkedDownload,
        sizeBytes: payload.sizeBytes,
        fallbackRangeUrl: payload.fallbackRangeUrl,
        fallbackTotalBytes: payload.fallbackTotalBytes,
        mimeType: payload.mimeType,
      });
    } catch (err) {
      setZipError(
        err instanceof Error ? err.message : 'Failed to package ZIP archive.',
      );
    } finally {
      setIsZipRunning(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0A0D0B] text-zinc-100 flex flex-col bg-[radial-gradient(ellipse_at_top,rgba(163,230,53,0.08),transparent_55%)]">
      {/* Top Bar Contract: 1-row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0A0D0B]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#extractor-section"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('extractor-section');
            }}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            VAL<span className="text-lime-400">HIEM</span>
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
          >
            <a
              href="#extractor-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('extractor-section');
              }}
              className="hover:text-lime-300 transition-colors whitespace-nowrap shrink-0"
            >
              Extractor
            </a>
            <a
              href="#playlist-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(collection ? 'playlist-section' : 'extractor-section');
              }}
              className="hover:text-lime-300 transition-colors whitespace-nowrap shrink-0"
            >
              Playlist Tracks
            </a>
            <a
              href="#downloads-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('downloads-section');
              }}
              className="hover:text-lime-300 transition-colors whitespace-nowrap shrink-0"
            >
              Downloads
            </a>
            <a
              href="#sources-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('sources-section');
              }}
              className="hover:text-lime-300 transition-colors whitespace-nowrap shrink-0"
            >
              Supported Sources
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCookiesModalOpen(true)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                cookiesText
                  ? 'border border-lime-400/40 bg-lime-400/15 text-lime-200 hover:bg-lime-400/25'
                  : 'border border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:border-lime-400/50 hover:text-lime-200'
              }`}
            >
              <KeyRound size={14} />
              {cookiesText ? 'Cookies Active' : 'YouTube Cookies'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
        {/* Dominant Focal Anchor: URL Extractor */}
        <section id="extractor-section" className="space-y-5">
          <div className="max-w-2xl space-y-2.5">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
              Download music, videos, and playlist tracks from{' '}
              <span className="text-lime-400">any URL</span>.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
              Paste a link from Spotify, YouTube, SoundCloud, Vimeo, or Bandcamp. Download single files or select specific songs from a playlist to save separately.
            </p>
          </div>

          <form
            onSubmit={handleFormSubmit}
            className="rounded-2xl border border-zinc-800 bg-[#111613] p-2.5 shadow-lg shadow-black/30 focus-within:border-lime-400/80 transition-colors"
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex flex-1 items-center">
                <Link2
                  size={18}
                  className="pointer-events-none absolute left-3.5 text-zinc-500"
                />
                <input
                  ref={inputRef}
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/... or https://www.youtube.com/watch?v=..."
                  aria-label="Media or playlist URL"
                  className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('');
                      setExtractError(null);
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear URL"
                    className="absolute right-2 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handlePasteClipboard()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-800/70 px-3.5 py-2.5 text-xs font-medium text-zinc-200 transition-colors hover:border-lime-400/50 hover:text-lime-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ClipboardPaste size={14} />
                  Paste
                </button>

                <button
                  type="submit"
                  disabled={isExtracting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze URL
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Clean Unboxed Sample Links */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-400">
            <span>Try a link:</span>
            {SAMPLE_URLS.map((sample, idx) => (
              <span key={sample.url} className="inline-flex items-center gap-2.5">
                {idx > 0 && <span aria-hidden="true" className="text-zinc-600">·</span>}
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput(sample.url);
                    void runExtract(sample.url);
                  }}
                  className="font-medium text-zinc-300 underline decoration-zinc-700 underline-offset-4 hover:text-lime-400 hover:decoration-lime-400 transition-colors cursor-pointer"
                >
                  {sample.label}
                </button>
              </span>
            ))}
          </div>

          {extractError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0 text-rose-400"
              />
              <p>{extractError}</p>
            </div>
          )}
        </section>

        {/* Loading Skeleton */}
        {isExtracting && (
          <section
            aria-label="Loading media metadata"
            className="rounded-2xl border border-zinc-800/90 bg-[#111613] p-6"
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="h-56 animate-pulse rounded-xl bg-zinc-800/60 lg:col-span-5" />
              <div className="space-y-4 lg:col-span-7">
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-800/70" />
                <div className="h-8 w-3/4 animate-pulse rounded bg-zinc-800/70" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-800/70" />
                <div className="pt-6">
                  <div className="h-10 w-56 animate-pulse rounded-lg bg-zinc-800/70" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Extracted Result: Single Item OR Playlist Workbench */}
        {!isExtracting &&
          collection &&
          collection.tracks.length === 1 &&
          collection.kind !== 'playlist' &&
          collection.kind !== 'album' && (
            <SingleMediaPanel
              collection={collection}
              track={collection.tracks[0]}
              mode={mode}
              format={format}
              bitrate={bitrate}
              quality={quality}
              jobStatus={
                trackStatuses[collection.tracks[0].id] || { state: 'idle' }
              }
              onModeChange={handleModeChange}
              onFormatChange={setFormat}
              onBitrateChange={setBitrate}
              onQualityChange={setQuality}
              onDownload={(t) => void prepareAndTriggerTrack(t)}
              onOpenCookies={() => setCookiesModalOpen(true)}
              onSwitchToAudioAndRetry={(t) => {
                setMode('audio');
                setFormat('mp3');
                void prepareAndTriggerTrack(t, { mode: 'audio', format: 'mp3' });
              }}
            />
          )}

        {!isExtracting &&
          collection &&
          (collection.tracks.length > 1 ||
            collection.kind === 'playlist' ||
            collection.kind === 'album') && (
            <PlaylistWorkbench
              collection={collection}
              selectedIds={selectedIds}
              trackStatuses={trackStatuses}
              mode={mode}
              format={format}
              bitrate={bitrate}
              quality={quality}
              isBatchRunning={isBatchRunning}
              isZipRunning={isZipRunning}
              zipError={zipError}
              onModeChange={handleModeChange}
              onFormatChange={setFormat}
              onBitrateChange={setBitrate}
              onQualityChange={setQuality}
              onToggleTrack={(trackId) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(trackId)) next.delete(trackId);
                  else next.add(trackId);
                  return next;
                })
              }
              onSelectAll={(ids) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const id of ids) next.add(id);
                  return next;
                })
              }
              onClearSelection={() => setSelectedIds(new Set())}
              onInvertSelection={(ids) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const id of ids) {
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                  }
                  return next;
                })
              }
              onDownloadSingleTrack={(t) => void prepareAndTriggerTrack(t)}
              onDownloadSelectedSeparately={(tracks) =>
                void handleDownloadSelectedSeparately(tracks)
              }
              onStopBatch={handleStopBatch}
              onDownloadSelectedZip={(tracks) =>
                void handleDownloadSelectedZip(tracks)
              }
              onSaveAllPrepared={(tracks) => void handleSaveAllPrepared(tracks)}
              onOpenCookies={() => setCookiesModalOpen(true)}
            />
          )}

        {/* Download Queue & History */}
        <QueuePanel
          items={history}
          onClearHistory={() => setHistory([])}
        />

        {/* Supported Sources & Formats Grid */}
        <section
          id="sources-section"
          aria-label="Supported sources and formats"
          className="rounded-2xl border border-zinc-800/90 bg-[#111613] p-6"
        >
          <div className="border-b border-zinc-800/80 pb-4">
            <h3 className="font-display text-base font-semibold text-white">
              Supported Sources & Output Formats
            </h3>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-lime-300">
                Spotify Tracks, Albums & Playlists
              </h4>
              <p className="text-xs leading-relaxed text-zinc-400">
                Extracts complete Spotify tracklists, album art, and metadata. Matches full audio streams and embeds ID3 cover artwork into MP3, M4A, FLAC, or WAV files.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-lime-300">
                YouTube Videos & Playlists
              </h4>
              <p className="text-xs leading-relaxed text-zinc-400">
                Loads individual videos or full public playlists so you can pick specific entries to save separately. Audio mode includes multi-source fallback; attach cookies for direct 1080p MP4/WEBM.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-lime-300">
                SoundCloud, Bandcamp & Vimeo
              </h4>
              <p className="text-xs leading-relaxed text-zinc-400">
                Supports direct extraction of single tracks, sets, and videos via FFmpeg transcoding at up to 320 kbps MP3, AAC M4A, lossless FLAC/WAV, or MP4.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/80 bg-[#0A0D0B]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>VALHIEM — Personal media extraction & playlist utility</span>
          <span>For personal offline archiving of public and authorized media.</span>
        </div>
      </footer>

      <CookiesModal
        isOpen={cookiesModalOpen}
        cookiesText={cookiesText}
        onClose={() => setCookiesModalOpen(false)}
        onSaveCookies={setCookiesText}
      />
    </div>
  );
}
