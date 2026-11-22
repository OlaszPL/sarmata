import type { CSSProperties } from 'react';
import { cn } from 'cn';

interface PixelLoaderProps {
  label: string;
  className?: string;
}

const size = 6;
const goldIndex = 14;
const redIndex = 21;

const cells = Array.from({ length: size * size }, (_, index) => {
  if (index === goldIndex) return 'var(--gold)';
  if (index === redIndex) return 'var(--brand-red)';
  return 'var(--navy)';
});

/** Loading indicator for AI work: a 6 by 6 pixel grid that fills up, static with reduced motion. */
export function PixelLoader({ label, className }: PixelLoaderProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="grid grid-cols-6" style={{ width: 'fit-content' }} aria-hidden>
        {cells.map((color, index) => (
          <span
            key={index}
            className="pixel-loader-cell block size-2"
            style={
              {
                '--cell': color,
                animationDelay: `${(index * 2.4) / cells.length}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <span role="status">{label}</span>
    </div>
  );
}
