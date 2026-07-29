import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import { listings } from '../data/mock'
import './discover.css'

const heroSlides = [
  { title: 'The Summer Edit', img: 'https://picsum.photos/seed/spotted-hero-1/600/800' },
  { title: 'Campus Fits', img: 'https://picsum.photos/seed/spotted-hero-2/600/800' },
  { title: 'Y2K Revival', img: 'https://picsum.photos/seed/spotted-hero-3/600/800' },
]

const categories = ['Men', 'Women', 'Kids', 'Everything else']

const outfitCollages = [
  listings.slice(0, 4),
  listings.slice(4, 8),
  listings.slice(8, 12),
]

export default function Discover() {
  const [activeSlide, setActiveSlide] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = trackRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveSlide(index)
  }

  return (
    <div className="discover-page">
      <div className="discover-header">
        <SearchBar />
      </div>

      <div className="hero-carousel" ref={trackRef} onScroll={handleScroll}>
        {heroSlides.map((slide) => (
          <div className="hero-slide" key={slide.title}>
            <img src={slide.img} alt={slide.title} />
            <div className="hero-slide-gradient" />
            <div className="hero-slide-overlay">
              <h2 className="hero-slide-title">{slide.title}</h2>
              <p className="hero-slide-subtitle">Shop the edit</p>
              <div className="hero-dots">
                {heroSlides.map((_, i) => (
                  <span
                    key={i}
                    className={'hero-dot' + (i === activeSlide ? ' active' : '')}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="discover-content">
        <div className="outfit-card">
          <div className="outfit-card-header">
            <h2>Discover your next look</h2>
            <span className="outfit-pill-new">New</span>
          </div>
          <p className="outfit-card-body">
            Get inspired by outfits styled by the Spotted community and shop the pieces
            you love.
          </p>
          <div className="outfit-collages">
            {outfitCollages.map((group, i) => (
              <div className="outfit-collage" key={i}>
                {group.map((item) => (
                  <img key={item.id} src={item.img} alt={item.brand} />
                ))}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-outline outfit-browse-btn">
            Browse outfits
          </button>
        </div>

        <h2 className="category-heading">Shop by category</h2>
        <div className="category-list">
          {categories.map((cat) => (
            <button type="button" className="category-row" key={cat}>
              <span>{cat}</span>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
