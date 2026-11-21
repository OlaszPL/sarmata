import { cn } from 'cn';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  /** Grid lines and spacing set by the parent grid. */
  className?: string;
}

/** Number cell for dashboards. Has no borders of its own, the parent draws the grid lines. */
export function StatTile({ label, value, hint, emphasis = false, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-6 py-5',
        emphasis ? 'bg-navy text-white' : 'text-ink',
        className,
      )}
    >
      <span className="font-heading text-base leading-[normal] font-medium">{label}</span>
      <span className="font-heading text-[3.5rem] leading-none font-semibold tracking-[-0.0268em]">
        {value}
      </span>
      {hint ? (
        <span
          className={cn(
            'text-sm leading-[normal]',
            emphasis ? 'text-on-navy-muted' : 'text-ink-muted',
          )}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
