import SearchBar from '../components/SearchBar'
import ProductCard from '../components/ProductCard'
import { listings, user } from '../data/mock'
import './home.css'

export default function Home() {
  return (
    <div className="home">
      <div className="home-search">
        <SearchBar />
      </div>

      <div className="home-promo">
        <p className="home-promo-title">Free shipping on your first order</p>
        <p className="home-promo-sub">No minimum spend. Ends Aug 5. T&amp;Cs apply</p>
      </div>

      <div className="home-greeting">
        <h2 className="home-greeting-title">Hey {user.name}!</h2>
        <p className="home-greeting-sub">Tap into a few items to unlock better picks</p>
      </div>

      <div className="home-grid">
        {listings.map((listing) => (
          <ProductCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  )
}
