import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import './sell.css'

export default function Sell() {
  const navigate = useNavigate()

  return (
    <div className="sell-page">
      <div className="sell-bg" />

      <div className="sell-topbar">
        <div className="sell-progress" aria-hidden="true">
          <span className="sell-progress-bar active" />
          <span className="sell-progress-bar" />
          <span className="sell-progress-bar" />
          <span className="sell-progress-bar" />
        </div>
        <button className="sell-close" aria-label="Close" onClick={() => navigate('/')}>
          <X size={22} />
        </button>
      </div>

      <div className="sell-bottom">
        <p className="sell-eyebrow">Selling on Spotted</p>
        <h1 className="sell-headline">Keep your cash — no selling fees</h1>
        <p className="sell-fees-note">Standard payment processing fees still apply.</p>
        <p className="sell-terms">
          By continuing you agree to our <strong>Terms of Service</strong>.
        </p>
        <p className="sell-business">Set up as a business</p>
        <button type="button" className="btn btn-primary sell-cta">
          Start selling
        </button>
      </div>
    </div>
  )
}
