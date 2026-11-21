interface AiMarkProps {
  className?: string;
}

/** 0 empty, 1 navy, 2 gold. */
const rows = ['0100', '1120', '0101', '0010'];

const fills: Record<string, string | undefined> = { '1': 'var(--navy)', '2': 'var(--gold)' };

/** Small pixel mark that labels AI generated content. Decorative, the label comes from the text next to it. */
export function AiMark({ className }: AiMarkProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      className={className}
      aria-hidden
      focusable="false"
    >
      {rows.flatMap((row, y) =>
        row.split('').map((cell, x) => {
          const fill = fills[cell];
          return fill ? (
            <rect key={`${x}-${y}`} x={x * 4} y={y * 4} width="4" height="4" fill={fill} />
          ) : null;
        }),
      )}
    </svg>
  );
}
