import { useEffect, useState, type ChangeEvent } from 'react';
import { CheckCircle2, KeyRound, Upload, X } from 'lucide-react';

interface CookiesModalProps {
  isOpen: boolean;
  cookiesText: string;
  onClose: () => void;
  onSaveCookies: (value: string) => void;
}

export function CookiesModal({
  isOpen,
  cookiesText,
  onClose,
  onSaveCookies,
}: CookiesModalProps) {
  const [draft, setDraft] = useState(cookiesText);

  useEffect(() => {
    if (isOpen) {
      setDraft(cookiesText);
    }
  }, [isOpen, cookiesText]);

  if (!isOpen) return null;

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookies-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#111613] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound size={17} className="text-lime-400" />
              <h2
                id="cookies-modal-title"
                className="font-display text-lg font-semibold text-white"
              >
                YouTube Browser Cookies
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">
              YouTube blocks unauthenticated datacenter IPs for direct MP4/WEBM downloads. Paste or upload Netscape <code className="font-mono text-zinc-200">cookies.txt</code> or JSON cookies from a signed-in YouTube tab (tip: export from a private/incognito tab and close it so cookies aren’t rotated). Stored only in this browser session.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="cookies-textarea"
              className="text-xs font-medium text-zinc-300"
            >
              Netscape cookies.txt content
            </label>
            <label className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer">
              <Upload size={13} />
              Upload .txt file
              <input
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>

          <textarea
            id="cookies-textarea"
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	..."
            className="w-full rounded-lg border border-zinc-800 bg-[#0A0D0B] p-3 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onSaveCookies('');
              onClose();
            }}
            className="text-xs font-medium text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Clear Saved Cookies
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 bg-zinc-800/70 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveCookies(draft.trim());
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-lime-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-lime-300 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              Save Session Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
