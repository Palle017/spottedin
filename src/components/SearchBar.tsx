import type { ReactNode } from 'react'
import { Search, Camera, Heart, ShoppingBag } from 'lucide-react'
import './SearchBar.css'

type SearchBarProps = {
  rightIcons?: ReactNode
}

export default function SearchBar({ rightIcons }: SearchBarProps) {
  return (
    <div className="search-bar-row">
      <div className="search-bar pill">
        <Search size={18} className="search-bar-icon" />
        <input type="text" placeholder="Search for anything" />
        <Camera size={18} className="search-bar-icon" />
      </div>
      <div className="search-bar-actions pill">
        {rightIcons ?? (
          <>
            <button className="icon-btn" aria-label="Wishlist">
              <Heart size={20} />
            </button>
            <button className="icon-btn" aria-label="Bag">
              <ShoppingBag size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
