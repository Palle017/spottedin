import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import Chip from '../../components/Chip'
import './onboarding.css'
import './brands.css'

const BRANDS = [
  'Adidas', 'Jordan', 'Supreme', 'Polo Ralph Lauren', 'Ralph Lauren', 'Carhartt',
  'The North Face', 'Nike', "Levi's", 'Wrangler', 'Louis Vuitton', 'Burberry',
  'Harley Davidson', 'Vans', 'Chrome Hearts', 'Palm Angels', 'Rick Owens',
  'Maison Margiela', "Arc'teryx", 'Salomon', 'Moncler', 'Canada Goose', 'New Era',
  'Mitchell & Ness', 'Stone Island', 'FabIndia', 'Sabyasachi', 'Zara', 'H&M', 'Uniqlo',
]

const ONBOARDED_KEY = 'spotted_onboarded'

export default function Brands() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set<string>())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return BRANDS
    return BRANDS.filter((brand) => brand.toLowerCase().includes(q))
  }, [query])

  const toggle = (brand: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(brand)) next.delete(brand)
      else next.add(brand)
      return next
    })
  }

  const skip = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true')
    navigate('/')
  }

  const seeMyFeed = () => {
    if (selected.size < 1) return
    localStorage.setItem(ONBOARDED_KEY, 'true')
    navigate('/')
  }

  return (
    <div className="light onboarding-page">
      <div className="onboarding-topbar">
        <button type="button" className="skip-pill" onClick={skip}>Skip</button>
      </div>

      <div className="onboarding-header">
        <h1>What brands are you into?</h1>
        <p>Choose brands you actually love — we'll use them to shape your feed.</p>
      </div>

      <div className="brand-search-wrap">
        <div className="brand-search pill">
          <Search size={18} className="brand-search-icon" />
          <input
            type="text"
            placeholder="Search any brand"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="brands-scroll">
        <div className="brand-chip-cloud">
          {filtered.map((brand) => (
            <Chip
              key={brand}
              label={brand}
              selected={selected.has(brand)}
              onClick={() => toggle(brand)}
            />
          ))}
        </div>
      </div>

      <div className="onboarding-cta-bar">
        <button
          type="button"
          className={'onboarding-cta' + (selected.size >= 1 ? ' onboarding-cta-active' : '')}
          onClick={seeMyFeed}
          disabled={selected.size < 1}
        >
          See my feed
        </button>
      </div>
    </div>
  )
}
