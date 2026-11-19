import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { QueueHistoryItem } from '../types/media';
import {
  formatBytes,
  platformLabel,
  resolvedSourceLabel,
  triggerBrowserDownload,
} from '../utils/formatters';

interface QueuePanelProps {
  items: QueueHistoryItem[];
  onClearHistory: () => void;
}

export function QueuePanel({ items, onClearHistory }: QueuePanelProps) {
  if (items.length === 0) {
    return (
      <section
        id="downloads-section"
        aria-label="Download queue"
        className="rounded-2xl border border-zinc-800/90 bg-[#111613] p-6"
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <h3 className="font-display text-base font-semibold text-white">
            Recent Downloads
          </h3>
          <span className="font-mono text-xs text-zinc-500">0 items</span>
        </div>
        <div className="py-10 text-center">
          <p className="text-sm text-zinc-400">
            Completed and active track downloads will appear here with file sizes and quick re-save links.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="downloads-section"
      aria-label="Download queue"
      className="rounded-2xl border border-zinc-800/90 bg-[#111613] overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-base font-semibold text-white">
            Recent Downloads
          </h3>
          <span className="font-mono text-xs text-zinc-400">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Trash2 size={13} />
          Clear History
        </button>
      </div>

      <div className="divide-y divide-zinc-800/60">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium text-zinc-100">
                {item.title}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span>{item.artist}</span>
                <span aria-hidden="true">·</span>
                <span>{platformLabel(item.platform)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono uppercase">{item.format}</span>
                {item.resolvedSource && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{resolvedSourceLabel(item.resolvedSource)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {item.state === 'resolving' || item.state === 'queued' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-lime-300">
                  <Loader2 size={14} className="animate-spin" />
                  {item.state === 'queued' ? 'Queued' : 'Converting...'}
                </span>
              ) : item.state === 'ready' ? (
                <>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-lime-400">
                    <CheckCircle2 size={14} />
                    {formatBytes(item.sizeBytes)}
                  </span>
                  {item.downloadUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        void triggerBrowserDownload(
                          item.downloadUrl!,
                          item.filename,
                          {
                            inlineDataUrl: item.inlineDataUrl,
                            proxiedSegments: item.proxiedSegments,
                            chunkedDownload: item.chunkedDownload,
                            sizeBytes: item.sizeBytes,
                            fallbackRangeUrl: item.fallbackRangeUrl,
                            fallbackTotalBytes: item.fallbackTotalBytes,
                            mimeType: item.mimeType,
                          },
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-lime-400/50 hover:text-lime-200 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download size={13} />
                      Save File
                    </button>
                  )}
                </>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs text-rose-400 max-w-xs truncate"
                  title={item.errorMessage}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="truncate">
                    {item.errorMessage || 'Download failed'}
                  </span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
