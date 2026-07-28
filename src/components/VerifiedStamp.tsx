interface VerifiedStampProps {
  size?: number;
}

/* Rubber-stamp style verified mark — monoline crimson ring + check, slightly
   rotated so it reads as stamped rather than iconography. */
export default function VerifiedStamp({ size = 18 }: VerifiedStampProps) {
  return (
    <svg
      className="verified-stamp"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" stroke="var(--brand-crimson)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7" stroke="var(--brand-crimson)" strokeWidth="1" strokeDasharray="1.4 2.2" />
      <path
        d="M8.1 12.3l2.5 2.5 5.3-5.6"
        stroke="var(--brand-crimson)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
