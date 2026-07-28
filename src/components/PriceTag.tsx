import { formatINR } from '../lib/format';

interface PriceTagProps {
  priceINR: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_PX: Record<NonNullable<PriceTagProps['size']>, number> = {
  sm: 13,
  md: 15,
  lg: 22,
};

export default function PriceTag({ priceINR, size = 'md' }: PriceTagProps) {
  return (
    <span className="price-tag" style={{ fontSize: SIZE_PX[size] }}>
      {formatINR(priceINR)}
    </span>
  );
}
