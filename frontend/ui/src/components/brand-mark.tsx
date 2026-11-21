interface BrandMarkProps {
  className?: string;
}

/** Product mark: gov.pl navy shield with a heron plume held by a jewel (Sarmatian motif). Decorative. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <path
        d="M9 4h46a3 3 0 0 1 3 3v24c0 15.6-11.3 25.3-26 29.4C17.3 56.3 6 46.6 6 31V7a3 3 0 0 1 3-3z"
        fill="#0052a5"
      />
      <path d="M9 4h46a3 3 0 0 1 3 3v4H6V7a3 3 0 0 1 3-3z" fill="#d5233f" />
      <path
        d="M23 46.5C19.6 36.8 22.6 24.4 32.4 17.6 39.6 12.6 48.6 13.2 52.6 19.2 47.4 17.2 41.8 18.6 38 22.6 31.8 29.2 28.8 38.4 23 46.5z"
        fill="#ffffff"
      />
      <path
        d="M23 46.5C24.6 37.4 28.2 28.6 34.4 22.2 39.6 17 46 15.8 52.6 19.2"
        fill="none"
        stroke="#0052a5"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="23" cy="46.5" r="5.4" fill="#eba828" stroke="#ffffff" strokeWidth="1.4" />
      <circle cx="23" cy="46.5" r="3" fill="#d5233f" />
      <circle cx="22" cy="45.4" r="0.9" fill="#ffffff" />
    </svg>
  );
}
