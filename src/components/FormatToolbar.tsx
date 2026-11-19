import { Music, Video } from 'lucide-react';
import type {
  AudioBitrate,
  AudioFormat,
  DownloadMode,
  MediaFormat,
  VideoFormat,
  VideoQuality,
} from '../types/media';

interface FormatToolbarProps {
  mode: DownloadMode;
  format: MediaFormat;
  bitrate: AudioBitrate;
  quality: VideoQuality;
  isVideoCapable: boolean;
  onModeChange: (mode: DownloadMode) => void;
  onFormatChange: (format: MediaFormat) => void;
  onBitrateChange: (bitrate: AudioBitrate) => void;
  onQualityChange: (quality: VideoQuality) => void;
  compact?: boolean;
}

const AUDIO_FORMATS: AudioFormat[] = ['mp3', 'm4a', 'flac', 'wav'];
const VIDEO_FORMATS: VideoFormat[] = ['mp4', 'webm'];
const AUDIO_BITRATES: AudioBitrate[] = ['320', '192', '128'];
const VIDEO_QUALITIES: VideoQuality[] = ['1080', '720', '480', '360'];

export function FormatToolbar({
  mode,
  format,
  bitrate,
  quality,
  isVideoCapable,
  onModeChange,
  onFormatChange,
  onBitrateChange,
  onQualityChange,
  compact = false,
}: FormatToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 ${compact ? '' : 'pt-1'}`}
    >
      {/* Mode Switch */}
      <div
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0A0D0B] p-1"
        role="group"
        aria-label="Output type"
      >
        <button
          type="button"
          onClick={() => onModeChange('audio')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            mode === 'audio'
              ? 'bg-zinc-800 text-lime-300 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Music size={13} strokeWidth={2} />
          Audio
        </button>
        <button
          type="button"
          disabled={!isVideoCapable}
          onClick={() => onModeChange('video')}
          title={
            isVideoCapable
              ? 'Download video stream'
              : 'This source is audio-only'
          }
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            !isVideoCapable
              ? 'cursor-not-allowed text-zinc-600'
              : mode === 'video'
                ? 'bg-zinc-800 text-lime-300 shadow-xs cursor-pointer'
                : 'text-zinc-400 hover:text-zinc-200 cursor-pointer'
          }`}
        >
          <Video size={13} strokeWidth={2} />
          Video
        </button>
      </div>

      {/* Format Selector */}
      <div
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0A0D0B] p-1"
        role="group"
        aria-label="File format"
      >
        {(mode === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => onFormatChange(fmt)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-mono font-semibold uppercase transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              format === fmt
                ? 'bg-lime-400 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>

      {/* Quality / Bitrate Selector */}
      {mode === 'audio' && (format === 'mp3' || format === 'm4a') && (
        <div
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0A0D0B] p-1"
          role="group"
          aria-label="Audio bitrate"
        >
          {AUDIO_BITRATES.map((br) => (
            <button
              key={br}
              type="button"
              onClick={() => onBitrateChange(br)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                bitrate === br
                  ? 'bg-zinc-800 text-lime-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {br}k
            </button>
          ))}
        </div>
      )}

      {mode === 'audio' && (format === 'flac' || format === 'wav') && (
        <span className="text-xs text-zinc-400 whitespace-nowrap">
          Lossless PCM / FLAC
        </span>
      )}

      {mode === 'video' && (
        <div
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0A0D0B] p-1"
          role="group"
          aria-label="Video resolution"
        >
          {VIDEO_QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQualityChange(q)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                quality === q
                  ? 'bg-zinc-800 text-lime-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {q}p
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
