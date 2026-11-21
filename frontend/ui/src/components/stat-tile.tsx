import { cn } from 'cn';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}

/** Number cell for dashboards. Has no borders of its own, the parent draws the grid lines. */
export function StatTile({ label, value, hint, emphasis = false }: StatTileProps) {
  return (
    <div className={cn('flex flex-col gap-1 p-6', emphasis ? 'bg-navy text-white' : 'text-ink')}>
      <span className="font-heading text-base font-medium">{label}</span>
      <span className="font-heading text-[3.5rem] leading-none font-semibold tracking-tight">
        {value}
      </span>
      {hint ? (
        <span className={cn('text-sm', emphasis ? 'text-on-navy-muted' : 'text-ink-muted')}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
