import { useState } from 'react';
import { Disc3, Film } from 'lucide-react';

interface MediaThumbProps {
  src?: string;
  alt: string;
  isVideo?: boolean;
  className?: string;
  iconSize?: number;
}

export function MediaThumb({
  src,
  alt,
  isVideo = false,
  className = '',
  iconSize = 20,
}: MediaThumbProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-lime-400/60 ${className}`}
        aria-label={alt}
      >
        {isVideo ? (
          <Film size={iconSize} strokeWidth={1.75} />
        ) : (
          <Disc3 size={iconSize} strokeWidth={1.75} />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover bg-zinc-900 ${className}`}
    />
  );
}
