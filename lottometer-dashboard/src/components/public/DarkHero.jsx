import { Link } from 'react-router-dom'

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

          {/* ── Product mockup ───────────────────────── */}
          <div className="dark-hero-mockup" aria-hidden="true">
            <div className="dark-hero-mockup-glow" />
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
            <div className="dark-hero-phone">
              <img
                src="/brand/mobile-shot.png"
                alt="Mobile preview"
                onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
              />
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
