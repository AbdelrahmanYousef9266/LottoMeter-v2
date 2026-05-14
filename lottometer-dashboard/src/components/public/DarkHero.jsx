import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'

const FEATURE_ICONS = {
  stopwatch: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36">
      <defs><linearGradient id="g-sh" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0077CC"/><stop offset="100%" stopColor="#2DAE1A"/></linearGradient></defs>
      <circle cx="12" cy="14" r="7.5" stroke="url(#g-sh)" strokeWidth="1.7"/>
      <path d="M12 9.5V14L15 16" stroke="url(#g-sh)" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M9.5 3.5h5M12 3.5V6" stroke="url(#g-sh)" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  barcode: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36">
      <defs><linearGradient id="g-bc" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0077CC"/><stop offset="100%" stopColor="#2DAE1A"/></linearGradient></defs>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" stroke="url(#g-bc)" strokeWidth="1.7"/>
      <path d="M7 8v8M9 8v8M11.5 8v8M14 8v8M16 8v8M18 8v8" stroke="url(#g-bc)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36">
      <defs><linearGradient id="g-ch" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0077CC"/><stop offset="100%" stopColor="#2DAE1A"/></linearGradient></defs>
      <path d="M4 20V8M10 20V12M16 20V6" stroke="url(#g-ch)" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M3 16l5-4 4 3 5-6 4 2" stroke="#2DAE1A" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M16 4l4 2-2 4" stroke="#2DAE1A" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36">
      <defs><linearGradient id="g-cl" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0077CC"/><stop offset="100%" stopColor="#2DAE1A"/></linearGradient></defs>
      <path d="M7 17h10a4 4 0 100-8 5.5 5.5 0 00-10.7 1.2A3.5 3.5 0 007 17z" stroke="url(#g-cl)" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M9.5 13l2 2 3.5-3.5" stroke="#2DAE1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36">
      <defs><linearGradient id="g-sh2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0077CC"/><stop offset="100%" stopColor="#2DAE1A"/></linearGradient></defs>
      <path d="M12 3l8 3v5c0 5.5-4 9.5-8 10-4-.5-8-4.5-8-10V6l8-3z" stroke="url(#g-sh2)" strokeWidth="1.7" strokeLinejoin="round"/>
      <rect x="9" y="10" width="6" height="5.5" rx="1" stroke="#2DAE1A" strokeWidth="1.5"/>
      <path d="M10.5 10V8.5a1.5 1.5 0 013 0V10" stroke="#2DAE1A" strokeWidth="1.5"/>
    </svg>
  ),
}

const HERO_FEATURES = [
  { id: 'stopwatch', title: 'Close Shifts',  sub: 'in Minutes' },
  { id: 'barcode',   title: 'Scan & Track',  sub: 'Every Book' },
  { id: 'chart',     title: 'Real-Time',     sub: 'Reports' },
  { id: 'cloud',     title: 'Works Online',  sub: '& Offline' },
  { id: 'shield',    title: 'Secure',        sub: '& Reliable' },
]

const HERO_BADGES = [
  { kind: 'check',    label: 'Increase Accuracy' },
  { kind: 'clock',    label: 'Save Valuable Time' },
  { kind: 'trending', label: 'Boost Store Performance' },
]

const HERO_COPY = {
  dashboard: {
    eyebrow: 'For Store Owners',
    tagline: 'Smarter Lottery Management',
    claim: ['Faster.', 'Easier.', 'More Accurate.'],
    ctaSecondary: 'See How It Works',
    ctaSecondaryHref: '#how-it-works',
  },
  shifts: {
    eyebrow: 'Shift Management',
    tagline: 'Every Shift, Down to the Cent',
    claim: ['Open.', 'Scan.', 'Close.'],
    ctaSecondary: 'See Sample Reports',
    ctaSecondaryHref: '#features',
    openSampleReport: true,
  },
  books: {
    eyebrow: 'Book Inventory',
    tagline: 'Every Book, Every Position',
    claim: ['Active.', 'Sold.', 'Returned.'],
    ctaSecondary: 'See Book Tracking',
    ctaSecondaryHref: '#features',
  },
}

// Carousel slides: dashboard screenshot + 4 mobile screenshots
const SLIDES = [
  {
    src: '/brand/mobile-shot.png',
    label: 'Home',
  },
  {
    src: '/brand/nav1.png',
    label: 'Slots',
  },
  {
    src: '/brand/nav2.png',
    label: 'History',
  },
  {
    src: '/brand/nav3.png',
    label: 'Settings',
  },
]

function BadgeIcon({ kind }) {
  const stroke = '#2DAE1A'
  const props = { fill: 'none', stroke, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (kind === 'check')
    return <svg viewBox="0 0 24 24" width="22" height="22" {...props}><circle cx="12" cy="12" r="9.5"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>
  if (kind === 'clock')
    return <svg viewBox="0 0 24 24" width="22" height="22" {...props}><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/></svg>
  if (kind === 'trending')
    return <svg viewBox="0 0 24 24" width="22" height="22" {...props}><path d="M4 18V8M10 18v-5M16 18v-9"/><path d="M3 14l5-4 4 3 5-6 4 2"/></svg>
  return null
}

function PhoneCarousel() {
  const [current, setCurrent] = useState(0)
  const [enterDir, setEnterDir] = useState('right')
  const touchStartX = useRef(null)
  const autoplayRef = useRef(null)

  const advance = useCallback((idx, dir) => {
    setEnterDir(dir)
    setCurrent(idx)
  }, [])

  const next = useCallback(() => {
    advance((current + 1) % SLIDES.length, 'right')
  }, [current, advance])

  const prev = useCallback(() => {
    advance((current - 1 + SLIDES.length) % SLIDES.length, 'left')
  }, [current, advance])

  useEffect(() => {
    autoplayRef.current = setInterval(next, 3200)
    return () => clearInterval(autoplayRef.current)
  }, [next])

  const resetAutoplay = () => {
    clearInterval(autoplayRef.current)
    autoplayRef.current = setInterval(next, 3200)
  }

  const handlePrev = () => { prev(); resetAutoplay() }
  const handleNext = () => { next(); resetAutoplay() }
  const handleDot = (i) => {
    advance(i, i > current ? 'right' : 'left')
    resetAutoplay()
  }

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) { dx < 0 ? handleNext() : handlePrev() }
    touchStartX.current = null
  }

  const slide = SLIDES[current]

  return (
    <div className="phone-carousel">
      {/* Phone bezel */}
      <div className="phone-bezel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Status bar */}
        <div className="phone-status-bar">
          <span className="phone-time">9:41</span>
          <div className="phone-status-icons">
            <svg viewBox="0 0 16 12" width="14" height="10" fill="rgba(255,255,255,0.9)">
              <rect x="0" y="4" width="3" height="8" rx="0.5"/>
              <rect x="4.5" y="2.5" width="3" height="9.5" rx="0.5"/>
              <rect x="9" y="0.5" width="3" height="11.5" rx="0.5"/>
              <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.3"/>
            </svg>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8">
              <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
            </svg>
            <svg viewBox="0 0 24 12" width="22" height="12" fill="none">
              <rect x="0.5" y="0.5" width="20" height="11" rx="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/>
              <rect x="2" y="2" width="14" height="8" rx="1" fill="rgba(255,255,255,0.9)"/>
              <path d="M22 4v4a2 2 0 000-4z" fill="rgba(255,255,255,0.5)"/>
            </svg>
          </div>
        </div>

        {/* Screen — key forces remount → replays enter animation on every slide change */}
        <div
          key={`${current}-${enterDir}`}
          className={`phone-screen phone-screen--enter-${enterDir}`}
        >
          <img
            src={slide.src}
            alt={slide.label}
            className="phone-screen-img"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            draggable={false}
          />
        </div>

        {/* Home indicator */}
        <div className="phone-home-indicator" />
      </div>

      {/* Navigation dots */}
      <div className="phone-dots">
        {SLIDES.map((s, i) => (
          <button
            key={s.label}
            className={`phone-dot${i === current ? ' active' : ''}`}
            onClick={() => handleDot(i)}
            aria-label={s.label}
          />
        ))}
      </div>

      {/* Prev / Next arrows */}
      <button className="phone-arrow phone-arrow--prev" onClick={handlePrev} aria-label="Previous">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button className="phone-arrow phone-arrow--next" onClick={handleNext} aria-label="Next">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {/* Label chip */}
      <div className="phone-label">{slide.label}</div>
    </div>
  )
}

export default function DarkHero({ dashShot = 'shifts' }) {
  const copy = HERO_COPY[dashShot] || HERO_COPY.dashboard

  const dashSrc = {
    dashboard: '/brand/dash-dashboard.png',
    shifts:    '/brand/dash-shifts.png',
    books:     '/brand/dash-books.png',
  }[dashShot] || '/brand/dash-dashboard.png'

  return (
    <section className="lm-bg-dark-hero dark-hero" id="top">
      <div className="dark-hero-inner">

        {/* ── Headline row ────────────────────────────── */}
        <div className="dark-hero-top">
          <div className="dark-hero-headline">
            <div className="dark-hero-logo-block">
              <img src="/app-icon.png" alt="" className="dark-hero-icon" />
            </div>
            <div className="dark-hero-headline-text">
              <div className="dark-hero-eyebrow">
                <span className="dot" />
                {copy.eyebrow}
              </div>
              <div className="dark-hero-wordmark">
                <span className="lm-wordmark on-dark"><span>Lotto</span><span>Meter</span></span>
              </div>
              <div className="dark-hero-tagline">{copy.tagline}</div>
              <div className="dark-hero-claim">
                {copy.claim[0]} {copy.claim[1]}{' '}
                <span className="accent">{copy.claim[2]}</span>
              </div>
              <div className="dark-hero-ctas">
                <Link to="/get-started" className="btn-gradient lg">Get Started</Link>
                {copy.openSampleReport
                  ? (
                    <button className="btn-on-dark" onClick={() => window.open('/sample-report', '_blank')}>
                      {copy.ctaSecondary}
                    </button>
                  ) : (
                    <a href={copy.ctaSecondaryHref} className="btn-on-dark">{copy.ctaSecondary}</a>
                  )}
              </div>
            </div>
          </div>

          {/* ── Product mockup: dashboard + phone carousel ── */}
          <div className="dark-hero-mockup" aria-hidden="true">
            <div className="dark-hero-mockup-glow" />

            {/* Dashboard screenshot */}
            <div className="dark-hero-dashboard">
              <div className="dark-hero-dashboard-frame">
                <span className="mac-dot" style={{ background: '#FF5F57' }} />
                <span className="mac-dot" style={{ background: '#FEBC2E' }} />
                <span className="mac-dot" style={{ background: '#28C840' }} />
              </div>
              <img
                src={dashSrc}
                alt="Dashboard preview"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>

            {/* Phone carousel (replaces static phone) */}
            <div className="dark-hero-phone">
              <PhoneCarousel />
            </div>
          </div>
        </div>

        {/* ── Feature icons row ───────────────────────── */}
        <div className="dark-hero-features">
          {HERO_FEATURES.map((f) => (
            <div className="dark-hero-feature" key={f.id}>
              <div className="dark-hero-feature-icon">{FEATURE_ICONS[f.id]}</div>
              <div className="dark-hero-feature-title">{f.title}<br />{f.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Time comparison ─────────────────────────── */}
        <div className="dark-hero-compare">
          <div className="dark-hero-streak" aria-hidden="true" />
          <div className="dark-hero-compare-text">
            <div className="dark-hero-compare-headline">
              From <span className="from">40 Minutes</span> to <span className="to">3 Minutes</span>
            </div>
            <div className="dark-hero-compare-sub">Save Time. Reduce Errors. Grow Your Business.</div>
          </div>
        </div>

        {/* ── Trust badges ────────────────────────────── */}
        <div className="dark-hero-badges">
          {HERO_BADGES.map((b) => (
            <div className="dark-hero-badge" key={b.label}>
              <span className="badge-ico"><BadgeIcon kind={b.kind} /></span>
              <span>{b.label}</span>
            </div>
          ))}
        </div>

      </div>

    </section>
  )
}
