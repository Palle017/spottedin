interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
}

/* Hand-drawn-editorial line illustration — an open box, monoline crimson —
   stands in for the old emoji glyph. `emoji` stays in the prop type so
   existing call sites don't need to change. */
export default function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <svg className="empty-state__art" width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true">
        <circle cx="44" cy="44" r="40" stroke="var(--cream)" strokeWidth="3" />
        <path
          d="M22 38l22-11 22 11v24a2 2 0 01-2 2H24a2 2 0 01-2-2V38z"
          stroke="var(--brand-crimson)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M22 38l22 11 22-11" stroke="var(--brand-crimson)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M44 49v15" stroke="var(--brand-crimson)" strokeWidth="2" strokeLinecap="round" />
        <path d="M35 22l9 5 9-5" stroke="var(--brand-crimson)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="empty-state__title">{title}</p>
      {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
    </div>
  );
}
