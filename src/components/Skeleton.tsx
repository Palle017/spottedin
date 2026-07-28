interface SkeletonGridProps {
  count?: number;
}

/* Card-shaped shimmer placeholders — fixed 4:5 tiles match ListingCard so
   swapping in real content causes zero layout shift. */
export default function SkeletonGrid({ count = 8 }: SkeletonGridProps) {
  return (
    <div className="listing-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-card__tile skeleton-shimmer" />
          <div className="skeleton-card__line skeleton-shimmer" />
          <div className="skeleton-card__line skeleton-card__line--short skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
