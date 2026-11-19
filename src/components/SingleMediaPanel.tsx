import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  KeyRound,
  Loader2,
  Music,
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
  platformLabel,
  resolvedSourceLabel,
  triggerBrowserDownload,
} from '../utils/formatters';
import { FormatToolbar } from './FormatToolbar';
import { MediaThumb } from './MediaThumb';

interface SingleMediaPanelProps {
  collection: ExtractedCollection;
  track: MediaTrackItem;
  mode: DownloadMode;
  format: MediaFormat;
  bitrate: AudioBitrate;
  quality: VideoQuality;
  jobStatus: TrackJobStatus;
  onModeChange: (mode: DownloadMode) => void;
  onFormatChange: (format: MediaFormat) => void;
  onBitrateChange: (bitrate: AudioBitrate) => void;
  onQualityChange: (quality: VideoQuality) => void;
  onDownload: (track: MediaTrackItem) => void;
  onOpenCookies: () => void;
  onSwitchToAudioAndRetry: (track: MediaTrackItem) => void;
}

export function SingleMediaPanel({
  collection,
  track,
  mode,
  format,
  bitrate,
  quality,
  jobStatus,
  onModeChange,
  onFormatChange,
  onBitrateChange,
  onQualityChange,
  onDownload,
  onOpenCookies,
  onSwitchToAudioAndRetry,
}: SingleMediaPanelProps) {
  const isBusy =
    jobStatus.state === 'queued' || jobStatus.state === 'resolving';

  return (
    <section
      aria-label="Extracted media preview"
      className="rounded-2xl border border-zinc-800/90 bg-[#111613] p-6"
    >
      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        {/* Artwork / Video Frame */}
        <div className="lg:col-span-5">
          <div className="relative h-full min-h-[220px] overflow-hidden rounded-xl border border-zinc-800 bg-[#0A0D0B]">
            <MediaThumb
              src={track.thumbnail || collection.thumbnail}
              alt={track.title}
              isVideo={collection.kind === 'video'}
              iconSize={40}
              className="h-full w-full max-h-[300px]"
            />
          </div>
        </div>

        {/* Metadata & Download Action */}
        <div className="flex flex-col justify-between gap-6 lg:col-span-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="font-medium text-lime-300">
                {platformLabel(collection.platform)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {collection.kind === 'video' ? 'Single Video' : 'Single Track'}
              </span>
              {track.durationSec > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-zinc-300">
                    {formatDuration(track.durationSec)}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <a
                href={track.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-zinc-400 hover:text-lime-300 transition-colors"
              >
                Source
                <ExternalLink size={12} />
              </a>
            </div>

            <h2 className="font-display text-2xl font-semibold tracking-tight text-white [text-wrap:balance]">
              {track.title}
            </h2>

            <p className="text-sm font-medium text-zinc-300">{track.artist}</p>

            {collection.description && (
              <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
                {collection.description}
              </p>
            )}
          </div>

          <div className="space-y-4 border-t border-zinc-800/80 pt-5">
            <div className="space-y-2">
              <span className="block text-xs font-medium text-zinc-400">
                Output format & quality
              </span>
              <FormatToolbar
                mode={mode}
                format={format}
                bitrate={bitrate}
                quality={quality}
                isVideoCapable={track.isVideoCapable}
                onModeChange={onModeChange}
                onFormatChange={onFormatChange}
                onBitrateChange={onBitrateChange}
                onQualityChange={onQualityChange}
              />
            </div>

            {/* Action & Status Row */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onDownload(track)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isBusy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Preparing {format.toUpperCase()}...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Download {format.toUpperCase()}
                  </>
                )}
              </button>

              {jobStatus.state === 'ready' && jobStatus.downloadUrl && (
                <button
                  type="button"
                  onClick={() =>
                    void triggerBrowserDownload(
                      jobStatus.downloadUrl!,
                      jobStatus.filename,
                      {
                        inlineDataUrl: jobStatus.inlineDataUrl,
                        proxiedSegments: jobStatus.proxiedSegments,
                        chunkedDownload: jobStatus.chunkedDownload,
                        sizeBytes: jobStatus.sizeBytes,
                        fallbackRangeUrl: jobStatus.fallbackRangeUrl,
                        fallbackTotalBytes: jobStatus.fallbackTotalBytes,
                        mimeType: jobStatus.mimeType,
                      },
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-lime-400/35 bg-lime-400/10 px-4 py-2.5 text-xs font-medium text-lime-200 transition-colors hover:bg-lime-400/20 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CheckCircle2 size={15} className="text-lime-400" />
                  <span>
                    Save File ({formatBytes(jobStatus.sizeBytes)} ·{' '}
                    {resolvedSourceLabel(jobStatus.resolvedSource)})
                  </span>
                </button>
              )}
            </div>

            {jobStatus.state === 'error' && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle
                    size={16}
                    className="mt-0.5 shrink-0 text-rose-400"
                  />
                  <div className="space-y-2.5">
                    <p className="leading-relaxed font-medium">
                      {jobStatus.message}
                    </p>
                    {(jobStatus.errorCode === 'YOUTUBE_COOKIES_REQUIRED' ||
                      jobStatus.errorCode === 'VIDEO_NOT_SUPPORTED') && (
                      <div className="flex flex-wrap items-center gap-2">
                        {track.platform === 'youtube' && (
                          <button
                            type="button"
                            onClick={onOpenCookies}
                            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <KeyRound size={13} />
                            Attach YouTube Cookies
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSwitchToAudioAndRetry(track)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-lime-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-lime-300 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Music size={13} />
                          Download Audio Fallback (MP3)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
