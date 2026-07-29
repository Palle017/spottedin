import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Chip from '../../components/Chip'
import './onboarding.css'
import './sizes.css'

type Tab = 'womens' | 'mens'

const LETTER_SIZES = [
  'US 3XS', 'US XXS', 'US XS', 'US S', 'US M', 'US L',
  'US XL', 'US XXL', 'US 3XL', 'US 4XL', 'US 5XL', 'US 6XL',
]

const WAIST_SIZES = Array.from({ length: 61 - 26 + 1 }, (_, i) => `US ${26 + i}"`)

const SHOE_SIZES = [
  '3', '4', '5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10',
  '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16',
].map((n) => `US ${n}`)

type SizeSection = { title: string; sizes: string[] }

const SECTIONS: Record<Tab, SizeSection[]> = {
  mens: [
    { title: 'Tops', sizes: LETTER_SIZES },
    { title: 'Bottoms', sizes: [...LETTER_SIZES, ...WAIST_SIZES] },
    { title: 'Shoes', sizes: SHOE_SIZES },
  ],
  womens: [
    { title: 'Tops', sizes: LETTER_SIZES },
    { title: 'Bottoms', sizes: LETTER_SIZES },
    { title: 'Shoes', sizes: SHOE_SIZES },
  ],
}

const ONBOARDED_KEY = 'spotted_onboarded'

export default function Sizes() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mens')
  const [selected, setSelected] = useState<Set<string>>(new Set<string>())

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const skip = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true')
    navigate('/')
  }

  const next = () => {
    if (selected.size < 1) return
    navigate('/onboarding/brands')
  }

  return (
    <div className="light onboarding-page">
      <div className="onboarding-topbar">
        <button type="button" className="skip-pill" onClick={skip}>Skip</button>
      </div>

      <div className="onboarding-header">
        <h1>Tell us your sizes</h1>
        <p>This will help you see items that are more relevant</p>
      </div>

      <div className="size-tabs">
        <button
          type="button"
          className={'size-tab' + (tab === 'womens' ? ' size-tab-active' : '')}
          onClick={() => setTab('womens')}
        >
          Women's
        </button>
        <button
          type="button"
          className={'size-tab' + (tab === 'mens' ? ' size-tab-active' : '')}
          onClick={() => setTab('mens')}
        >
          Men's
        </button>
      </div>

      <div className="sizes-scroll">
        {SECTIONS[tab].map((section) => (
          <section className="size-section" key={section.title}>
            <h2>{section.title}</h2>
            <div className="size-chip-grid">
              {section.sizes.map((size) => {
                const key = `${tab}:${section.title}:${size}`
                return (
                  <Chip
                    key={key}
                    label={size}
                    selected={selected.has(key)}
                    onClick={() => toggle(key)}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="onboarding-cta-bar">
        <button
          type="button"
          className={'onboarding-cta' + (selected.size >= 1 ? ' onboarding-cta-active' : '')}
          onClick={next}
          disabled={selected.size < 1}
        >
          Next
        </button>
      </div>
    </div>
  )
}
