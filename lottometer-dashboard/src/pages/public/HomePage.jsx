import { Link } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'
import DarkHero from '../../components/public/DarkHero'

// ── Inline SVG icons for problem + feature cards ───────────────────────────
function PubIcon({ name, size = 24 }) {
  const s = { fill: 'none', stroke: '#0077CC', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    clipboard:    <><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M9 12h6M9 16h4"/></>,
    'dollar-sign': <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
    'book-open':  <><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></>,
    clock:        <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    'bar-chart-3': <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    smartphone:   <><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
    'refresh-cw': <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>,
    calendar:     <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    users:        <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...s}>
      {paths[name]}
    </svg>
  )
}

const PROBLEMS = [
  { icon: 'clipboard',    title: 'Paper-Based Tracking',         desc: 'Shift records are handwritten, lost, or inconsistent — making audits a nightmare.' },
  { icon: 'dollar-sign',  title: 'Cash Variance Goes Unnoticed', desc: 'Overs and shorts are only discovered at end of day, with no clear accountability trail.' },
  { icon: 'book-open',    title: 'Book Inventory Chaos',         desc: 'No visibility into which lottery books are active, sold, or assigned to which employee.' },
  { icon: 'clock',        title: 'Slow Shift Handovers',         desc: 'Opening and closing a shift takes too long without a standardized digital process.' },
  { icon: 'bar-chart-3',  title: 'Zero Business Insights',       desc: 'Owners have no data on daily sales trends, top performers, or variance history.' },
]

const FEATURES = [
  { icon: 'smartphone',   title: 'Mobile Barcode Scanning',   desc: 'Scan lottery book barcodes in seconds from any iPhone or Android device — no special hardware required.' },
  { icon: 'refresh-cw',   title: 'Digital Shift Management',  desc: 'Open and close shifts digitally with automatic time tracking, cash reconciliation, and status badges.' },
  { icon: 'book-open',    title: 'Book Inventory Tracking',   desc: 'Know exactly which books are active, sold, or returned at any given time, assigned to the right employee.' },
  { icon: 'bar-chart-3',  title: 'Real-Time Reports',          desc: 'Instant shift reports show gross sales, expected cash, actual cash, and variance — down to the cent.' },
  { icon: 'calendar',     title: 'Business Day Control',       desc: 'Group shifts by business day, close days with one tap, and keep a complete audit trail automatically.' },
  { icon: 'users',        title: 'Multi-Employee Support',     desc: 'Manage your entire team from the dashboard — each employee has their own login and shift history.' },
]

const STEPS = [
  { num: '01', title: 'Owner sets up the store',         desc: 'Create your account, add your store, and invite employees via the web dashboard in minutes.' },
  { num: '02', title: 'Employee opens a shift',          desc: 'Each employee logs in on the mobile app and taps "Open Shift" to start their working day.' },
  { num: '03', title: 'Scan books during the shift',     desc: 'As lottery books are sold or activated, the employee scans the barcode — inventory updates instantly.' },
  { num: '04', title: 'Close the shift with cash count', desc: 'At end of shift, the employee enters their cash total. LottoMeter calculates variance automatically.' },
  { num: '05', title: 'Owner reviews reports',           desc: 'Log into the dashboard to see every shift report, daily sales totals, and team performance at a glance.' },
]

export default function HomePage() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      <DarkHero />

      {/* Problems */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              The Problem
            </p>
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Running stores is harder than it needs to be
            </h2>
            <p style={{ fontSize: 16, color: '#46627F', maxWidth: 520, margin: '0 auto' }}>
              Most stores still rely on pen and paper. That leads to errors, disputes, and zero accountability.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
            {PROBLEMS.map((p) => (
              <div key={p.title} style={{
                flex: '1 1 200px', maxWidth: 280,
                background: '#F8FAFF', borderRadius: 12, padding: '24px',
                border: '1px solid #E2EAF4',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(0,119,204,0.08)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                }}>
                  <PubIcon name={p.icon} size={24} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: '#46627F', lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '80px 24px', background: '#F0F7FF' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              Features
            </p>
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Everything you need to run a tight operation
            </h2>
            <p style={{ fontSize: 16, color: '#46627F', maxWidth: 500, margin: '0 auto' }}>
              One app on the phone, one dashboard on the web — and everything syncs in real time.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: '#fff', borderRadius: 14, padding: '28px',
                border: '1px solid #E2EAF4', boxShadow: '0 2px 12px rgba(0,77,140,0.06)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,119,204,0.12)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,77,140,0.06)' }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'linear-gradient(135deg, #EAF6FF, #EAF9EA)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <PubIcon name={f.icon} size={22} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#46627F', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              How It Works
            </p>
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Up and running in under 10 minutes
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0077CC, #2DAE1A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0,
                  }}>
                    {step.num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 32, background: '#E2EAF4', margin: '4px 0' }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < STEPS.length - 1 ? 32 : 0, paddingTop: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{step.title}</div>
                  <div style={{ fontSize: 14, color: '#46627F', lineHeight: 1.65 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lm-bg-dark-hero" style={{ padding: '96px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Ready to{' '}
            <span style={{
              background: 'linear-gradient(to right, #4DB8FF, #5CDE3A)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              modernize
            </span>
            {' '}your store?
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: '0 0 40px' }}>
            Join lottery store owners already using LottoMeter to save time and reduce errors every single day.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/get-started" className="btn-gradient lg">Get Started</Link>
            <Link to="/contact" className="btn-on-dark">Contact Us</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
