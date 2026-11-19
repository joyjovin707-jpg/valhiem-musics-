export type MediaPlatform =
  | 'spotify'
  | 'youtube'
  | 'soundcloud'
  | 'bandcamp'
  | 'vimeo'
  | 'other';

export type CollectionKind = 'track' | 'video' | 'playlist' | 'album';

export type DownloadMode = 'audio' | 'video';

export type AudioFormat = 'mp3' | 'm4a' | 'flac' | 'wav';
export type VideoFormat = 'mp4' | 'webm';
export type MediaFormat = AudioFormat | VideoFormat;

export type AudioBitrate = '320' | '192' | '128';
export type VideoQuality = '1080' | '720' | '480' | '360';

export interface MediaTrackItem {
  id: string;
  index: number;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  thumbnail?: string;
  url: string;
  previewUrl?: string;
  platform: MediaPlatform;
  isVideoCapable: boolean;
}

export interface ExtractedCollection {
  id: string;
  kind: CollectionKind;
  platform: MediaPlatform;
  title: string;
  creator: string;
  description?: string;
  thumbnail?: string;
  sourceUrl: string;
  totalDurationSec: number;
  trackCount: number;
  isVideoCapable: boolean;
  tracks: MediaTrackItem[];
}

export interface PreparedFileResponse {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  resolvedSource:
    | 'direct'
    | 'youtube-direct'
    | 'soundcloud-match'
    | 'audius-match'
    | 'spotify-preview';
  resolvedTitle?: string;
  downloadUrl: string;
  inlineDataUrl?: string;
  proxiedSegments?: string[];
  chunkedDownload?: boolean;
  fallbackRangeUrl?: string;
  fallbackTotalBytes?: number;
}

export type TrackDownloadState =
  | 'idle'
  | 'queued'
  | 'resolving'
  | 'ready'
  | 'error';

export interface TrackJobStatus {
  state: TrackDownloadState;
  message?: string;
  resolvedSource?: PreparedFileResponse['resolvedSource'];
  downloadUrl?: string;
  inlineDataUrl?: string;
  proxiedSegments?: string[];
  chunkedDownload?: boolean;
  fallbackRangeUrl?: string;
  fallbackTotalBytes?: number;
  mimeType?: string;
  filename?: string;
  sizeBytes?: number;
  errorCode?: string;
}

export interface QueueHistoryItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  platform: MediaPlatform;
  mode: DownloadMode;
  format: MediaFormat;
  state: TrackDownloadState;
  resolvedSource?: PreparedFileResponse['resolvedSource'];
  downloadUrl?: string;
  inlineDataUrl?: string;
  proxiedSegments?: string[];
  chunkedDownload?: boolean;
  fallbackRangeUrl?: string;
  fallbackTotalBytes?: number;
  mimeType?: string;
  filename?: string;
  sizeBytes?: number;
  errorMessage?: string;
  errorCode?: string;
  createdAt: number;
}
