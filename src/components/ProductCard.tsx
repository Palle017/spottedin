import { Heart } from 'lucide-react'
import type { Listing } from '../data/mock'
import './ProductCard.css'

type ProductCardProps = {
  listing: Listing
}

function formatInr(value: number) {
  return `₹${value.toLocaleString('en-IN')}`
}

export default function ProductCard({ listing }: ProductCardProps) {
  const { brand, size, price, originalPrice, likes, img } = listing

  return (
    <div className="product-card">
      <div className="product-card-image-wrap">
        <img src={img} alt={brand} loading="lazy" />
        <button className="product-card-like" aria-label="Like">
          <Heart size={20} />
          <span>{likes}</span>
        </button>
      </div>
      <div className="product-card-info">
        <p className="product-card-brand">{brand}</p>
        <p className="product-card-size">{size}</p>
        <p className="product-card-price">
          {formatInr(price)}
          {originalPrice && (
            <span className="product-card-original">{formatInr(originalPrice)}</span>
          )}
        </p>
      </div>
    </div>
  )
}
