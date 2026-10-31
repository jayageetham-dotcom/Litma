/** Typewriter icon in the same 24px, 2px-stroke style as lucide (lucide has none). */
export function TypewriterIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* sheet in the roller */}
      <path d="M7 9V3h10v6" />
      <path d="M10 6h4" />
      {/* body */}
      <rect x="3" y="9" width="18" height="12" rx="2" />
      {/* keys and space bar */}
      <path d="M7 13h.01M10 13h.01M14 13h.01M17 13h.01M8.5 17h7" />
    </svg>
  );
}
