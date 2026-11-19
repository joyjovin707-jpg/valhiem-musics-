import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FolderArchive,
  KeyRound,
  Loader2,
  Search,
  Square,
} from 'lucide-react';
import type {
  AudioBitrate,
  DownloadMode,
  ExtractedCollection,
  MediaFormat,
  MediaTrackItem,
  TrackJobStatus,
  VideoQuality,
} from '../types/media';
import {
  formatBytes,
  formatDuration,
  formatTotalDuration,
  platformLabel,
  resolvedSourceLabel,
  triggerBrowserDownload,
} from '../utils/formatters';
import { FormatToolbar } from './FormatToolbar';
import { MediaThumb } from './MediaThumb';

interface PlaylistWorkbenchProps {
  collection: ExtractedCollection;
  selectedIds: Set<string>;
  trackStatuses: Record<string, TrackJobStatus>;
  mode: DownloadMode;
  format: MediaFormat;
  bitrate: AudioBitrate;
  quality: VideoQuality;
  isBatchRunning: boolean;
  isZipRunning: boolean;
  zipError?: string;
  onModeChange: (mode: DownloadMode) => void;
  onFormatChange: (format: MediaFormat) => void;
  onBitrateChange: (bitrate: AudioBitrate) => void;
  onQualityChange: (quality: VideoQuality) => void;
  onToggleTrack: (trackId: string) => void;
  onSelectAll: (trackIds: string[]) => void;
  onClearSelection: () => void;
  onInvertSelection: (trackIds: string[]) => void;
  onDownloadSingleTrack: (track: MediaTrackItem) => void;
  onDownloadSelectedSeparately: (tracks: MediaTrackItem[]) => void;
  onStopBatch: () => void;
  onDownloadSelectedZip: (tracks: MediaTrackItem[]) => void;
  onSaveAllPrepared: (tracks: MediaTrackItem[]) => void;
  onOpenCookies: () => void;
}

export function PlaylistWorkbench({
  collection,
  selectedIds,
  trackStatuses,
  mode,
  format,
  bitrate,
  quality,
  isBatchRunning,
  isZipRunning,
  zipError,
  onModeChange,
  onFormatChange,
  onBitrateChange,
  onQualityChange,
  onToggleTrack,
  onSelectAll,
  onClearSelection,
  onInvertSelection,
  onDownloadSingleTrack,
  onDownloadSelectedSeparately,
  onStopBatch,
  onDownloadSelectedZip,
  onSaveAllPrepared,
  onOpenCookies,
}: PlaylistWorkbenchProps) {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredTracks = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return collection.tracks;
    return collection.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)),
    );
  }, [collection.tracks, filterQuery]);

  const selectedTracks = useMemo(
    () => collection.tracks.filter((t) => selectedIds.has(t.id)),
    [collection.tracks, selectedIds],
  );

  const readyTracks = useMemo(
    () =>
      collection.tracks.filter(
        (t) =>
          trackStatuses[t.id]?.state === 'ready' &&
          Boolean(trackStatuses[t.id]?.downloadUrl),
      ),
    [collection.tracks, trackStatuses],
  );

  const hasYouTubeCookieError = useMemo(
    () =>
      collection.platform === 'youtube' &&
      collection.tracks.some(
        (t) =>
          trackStatuses[t.id]?.errorCode === 'YOUTUBE_COOKIES_REQUIRED' ||
          trackStatuses[t.id]?.errorCode === 'VIDEO_NOT_SUPPORTED',
      ),
    [collection.platform, collection.tracks, trackStatuses],
  );

  const visibleIds = useMemo(
    () => filteredTracks.map((t) => t.id),
    [filteredTracks],
  );

  const allVisibleSelected =
    filteredTracks.length > 0 &&
    filteredTracks.every((t) => selectedIds.has(t.id));

  return (
    <section
      id="playlist-section"
      aria-label="Playlist track selector"
      className="rounded-2xl border border-zinc-800/90 bg-[#111613] overflow-hidden"
    >
      {/* Playlist Header Summary */}
      <div className="border-b border-zinc-800/80 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#0A0D0B] sm:h-28 sm:w-28">
              <MediaThumb
                src={collection.thumbnail}
                alt={collection.title}
                isVideo={collection.kind === 'playlist' && collection.platform === 'youtube'}
                iconSize={32}
                className="h-full w-full"
              />
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="font-medium text-lime-300">
                  {platformLabel(collection.platform)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{collection.kind}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-zinc-300">
                  {collection.trackCount} tracks
                </span>
                {collection.totalDurationSec > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-zinc-300">
                      {formatTotalDuration(collection.totalDurationSec)}
                    </span>
                  </>
                )}
              </div>

              <h2 className="font-display text-2xl font-semibold tracking-tight text-white [text-wrap:balance]">
                {collection.title}
              </h2>

              <p className="text-sm text-zinc-300">{collection.creator}</p>
            </div>
          </div>

          {/* Batch Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isBatchRunning ? (
              <button
                type="button"
                onClick={onStopBatch}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-500/25 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square size={14} fill="currentColor" />
                Stop Batch
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedTracks.length === 0 || isZipRunning}
                onClick={() => onDownloadSelectedSeparately(selectedTracks)}
                className="inline-flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download size={16} />
                Download Selected Separately ({selectedTracks.length})
              </button>
            )}

            <button
              type="button"
              disabled={
                selectedTracks.length === 0 ||
                selectedTracks.length > 25 ||
                isBatchRunning ||
                isZipRunning
              }
              onClick={() => onDownloadSelectedZip(selectedTracks)}
              title={
                selectedTracks.length > 25
                  ? 'Select up to 25 tracks for ZIP, or use Download Selected Separately'
                  : 'Bundle selected tracks into one ZIP archive'
              }
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-lime-400/50 hover:text-lime-200 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isZipRunning ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Archiving ZIP...
                </>
              ) : (
                <>
                  <FolderArchive size={15} />
                  Download ZIP ({selectedTracks.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Format Controls */}
        <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <FormatToolbar
            mode={mode}
            format={format}
            bitrate={bitrate}
            quality={quality}
            isVideoCapable={collection.isVideoCapable}
            onModeChange={onModeChange}
            onFormatChange={onFormatChange}
            onBitrateChange={onBitrateChange}
            onQualityChange={onQualityChange}
            compact
          />

          <p className="text-xs text-zinc-400">
            Select specific tracks below to download separately, or click any row button.
          </p>
        </div>

        {readyTracks.length > 1 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-lime-200">
              <CheckCircle2 size={15} className="shrink-0 text-lime-400" />
              <span>
                <span className="font-mono font-semibold">{readyTracks.length}</span>{' '}
                tracks prepared. If your browser blocked multiple automatic popups, save them below or use Download ZIP.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSaveAllPrepared(readyTracks)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-lime-400/40 bg-lime-400/20 px-3 py-1.5 text-xs font-semibold text-lime-200 hover:bg-lime-400/30 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download size={13} />
              Save All Prepared ({readyTracks.length})
            </button>
          </div>
        )}

        {zipError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{zipError}</span>
          </div>
        )}

        {hasYouTubeCookieError && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-rose-200">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>
                YouTube blocked automated video extraction from this server IP. Attach browser cookies.txt or switch to Audio mode (MP3/M4A).
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenCookies}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound size={13} />
              Attach YouTube Cookies
            </button>
          </div>
        )}
      </div>

      {/* Filter & Selection Toolbar */}
      <div className="flex flex-col gap-3 border-b border-zinc-800/80 bg-[#0D110E] px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter tracks by title or artist..."
            className="w-full rounded-lg border border-zinc-800 bg-[#0A0D0B] py-1.5 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-mono text-zinc-400">
            {selectedIds.size} of {collection.tracks.length} selected
          </span>
          <span className="text-zinc-700" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            onClick={() => onSelectAll(visibleIds)}
            className="font-medium text-zinc-300 hover:text-lime-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="font-medium text-zinc-300 hover:text-lime-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onInvertSelection(visibleIds)}
            className="font-medium text-zinc-300 hover:text-lime-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Invert
          </button>
        </div>
      </div>

      {/* High-Density Track Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-[#0D110E] text-xs font-medium text-zinc-400">
              <th className="w-11 py-3 pl-6 pr-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={allVisibleSelected}
                  aria-label={
                    allVisibleSelected
                      ? 'Deselect visible tracks'
                      : 'Select all visible tracks'
                  }
                  onClick={() =>
                    allVisibleSelected
                      ? onClearSelection()
                      : onSelectAll(visibleIds)
                  }
                  className={`flex h-4.5 w-4.5 items-center justify-center rounded border transition-colors cursor-pointer ${
                    allVisibleSelected
                      ? 'border-lime-400 bg-lime-400 text-zinc-950'
                      : 'border-zinc-700 bg-[#0A0D0B] hover:border-lime-400/60'
                  }`}
                >
                  {allVisibleSelected && <Check size={12} strokeWidth={3} />}
                </button>
              </th>
              <th className="w-12 py-3 px-2 font-mono">#</th>
              <th className="py-3 px-3">Track</th>
              <th className="w-24 py-3 px-3 text-right font-mono">Duration</th>
              <th className="w-48 py-3 px-3">Status</th>
              <th className="w-36 py-3 pl-3 pr-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-sm">
            {filteredTracks.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-zinc-400"
                >
                  No tracks match "{filterQuery}".
                </td>
              </tr>
            ) : (
              filteredTracks.map((track) => {
                const isSelected = selectedIds.has(track.id);
                const status = trackStatuses[track.id] || { state: 'idle' };
                const isRowBusy =
                  status.state === 'queued' || status.state === 'resolving';

                return (
                  <tr
                    key={track.id}
                    className={`transition-colors hover:bg-zinc-800/40 ${
                      isSelected ? 'bg-lime-400/[0.04]' : ''
                    }`}
                  >
                    <td className="py-2.5 pl-6 pr-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`Select ${track.title}`}
                        onClick={() => onToggleTrack(track.id)}
                        className={`flex h-4.5 w-4.5 items-center justify-center rounded border transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-lime-400 bg-lime-400 text-zinc-950'
                            : 'border-zinc-700 bg-[#0A0D0B] hover:border-lime-400/60'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </button>
                    </td>

                    <td className="py-2.5 px-2 font-mono text-xs text-zinc-500">
                      {String(track.index).padStart(2, '0')}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-[#0A0D0B]">
                          <MediaThumb
                            src={track.thumbnail}
                            alt={track.title}
                            isVideo={track.isVideoCapable}
                            iconSize={15}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-100 max-w-md">
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-zinc-400 max-w-md">
                            {track.artist}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-xs text-zinc-400">
                      {track.durationSec > 0
                        ? formatDuration(track.durationSec)
                        : '—'}
                    </td>

                    <td className="py-2.5 px-3 text-xs">
                      {status.state === 'idle' && (
                        <span className="text-zinc-500">Ready</span>
                      )}
                      {status.state === 'queued' && (
                        <span className="text-zinc-300">Queued</span>
                      )}
                      {status.state === 'resolving' && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-lime-300">
                          <Loader2 size={13} className="animate-spin" />
                          Converting...
                        </span>
                      )}
                      {status.state === 'ready' && (
                        <span
                          className="inline-flex items-center gap-1.5 text-lime-400"
                          title={resolvedSourceLabel(status.resolvedSource)}
                        >
                          <CheckCircle2 size={13} />
                          <span className="truncate max-w-[150px]">
                            Ready · {formatBytes(status.sizeBytes)}
                          </span>
                        </span>
                      )}
                      {status.state === 'error' && (
                        <span
                          className="inline-flex items-center gap-1.5 text-rose-400"
                          title={status.message}
                        >
                          <AlertCircle size={13} className="shrink-0" />
                          <span className="truncate max-w-[150px]">
                            {status.message || 'Failed'}
                          </span>
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 pl-3 pr-6 text-right">
                      {status.state === 'ready' && status.downloadUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            void triggerBrowserDownload(
                              status.downloadUrl!,
                              status.filename,
                              {
                                inlineDataUrl: status.inlineDataUrl,
                                proxiedSegments: status.proxiedSegments,
                                chunkedDownload: status.chunkedDownload,
                                sizeBytes: status.sizeBytes,
                                fallbackRangeUrl: status.fallbackRangeUrl,
                                fallbackTotalBytes: status.fallbackTotalBytes,
                                mimeType: status.mimeType,
                              },
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-md border border-lime-400/35 bg-lime-400/15 px-2.5 py-1.5 text-xs font-medium text-lime-200 hover:bg-lime-400/25 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Download size={13} />
                          Save File
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isRowBusy}
                          onClick={() => onDownloadSingleTrack(track)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/70 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-lime-400/50 hover:text-lime-200 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isRowBusy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                          {format.toUpperCase()}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
