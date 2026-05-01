import { Link } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'

const PROBLEMS = [
  { icon: '📋', title: 'Paper-Based Tracking', desc: 'Shift records are handwritten, lost, or inconsistent — making audits a nightmare.' },
  { icon: '💸', title: 'Cash Variance Goes Unnoticed', desc: 'Overs and shorts are only discovered at end of day, with no clear accountability trail.' },
  { icon: '📚', title: 'Book Inventory Chaos', desc: 'No visibility into which lottery books are active, sold, or assigned to which employee.' },
  { icon: '⏱️', title: 'Slow Shift Handovers', desc: 'Opening and closing a shift takes too long without a standardized digital process.' },
  { icon: '📊', title: 'Zero Business Insights', desc: 'Owners have no data on daily sales trends, top performers, or variance history.' },
]

const FEATURES = [
  { icon: '📱', title: 'Mobile Barcode Scanning', desc: 'Scan lottery book barcodes in seconds from any iPhone or Android device — no special hardware required.' },
  { icon: '🔄', title: 'Digital Shift Management', desc: 'Open and close shifts digitally with automatic time tracking, cash reconciliation, and status badges.' },
  { icon: '📚', title: 'Book Inventory Tracking', desc: 'Know exactly which books are active, sold, or returned at any given time, assigned to the right employee.' },
  { icon: '📊', title: 'Real-Time Reports', desc: 'Instant shift reports show gross sales, expected cash, actual cash, and variance — down to the cent.' },
  { icon: '📅', title: 'Business Day Control', desc: 'Group shifts by business day, close days with one tap, and keep a complete audit trail automatically.' },
  { icon: '👥', title: 'Multi-Employee Support', desc: 'Manage your entire team from the dashboard — each employee has their own login and shift history.' },
]

const STEPS = [
  { num: '01', title: 'Owner sets up the store', desc: 'Create your account, add your store, and invite employees via the web dashboard in minutes.' },
  { num: '02', title: 'Employee opens a shift', desc: 'Each employee logs in on the mobile app and taps "Open Shift" to start their working day.' },
  { num: '03', title: 'Scan books during the shift', desc: 'As lottery books are sold or activated, the employee scans the barcode — inventory updates instantly.' },
  { num: '04', title: 'Close the shift with cash count', desc: 'At end of shift, the employee enters their cash total. LottoMeter calculates variance automatically.' },
  { num: '05', title: 'Owner reviews reports', desc: 'Log into the dashboard to see every shift report, daily sales totals, and team performance at a glance.' },
]

export default function HomePage() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)', padding: '96px 24px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#EAF6FF', border: '1px solid #B3D9F5', borderRadius: 999,
            padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#0077CC', marginBottom: 28,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0077CC', display: 'inline-block' }} />
            Built for lottery store owners
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 900, lineHeight: 1.12, margin: '0 0 24px', letterSpacing: '-0.02em' }}>
            The fastest way to{' '}
            <span style={{ background: 'linear-gradient(to right, #0077CC, #2DAE1A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              track lottery shifts
            </span>
          </h1>
          <p style={{ fontSize: 18, color: '#46627F', lineHeight: 1.7, margin: '0 0 40px', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            LottoMeter replaces paper-based shift records with a digital system your whole team can use from their phone. Scan books, track cash, and close days in seconds.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/apply" style={{
              textDecoration: 'none', fontSize: 15, fontWeight: 700, color: '#fff',
              padding: '14px 28px', borderRadius: 10,
              background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
              boxShadow: '0 4px 16px rgba(0,119,204,0.3)',
            }}>
              Request a Free Demo
            </Link>
            <a href="#how-it-works" style={{
              textDecoration: 'none', fontSize: 15, fontWeight: 600, color: '#0077CC',
              padding: '14px 28px', borderRadius: 10,
              border: '2px solid #B3D9F5', background: '#fff',
            }}>
              See How It Works
            </a>
          </div>
        </div>

        {/* Dashboard mockup strip */}
        <div style={{
          maxWidth: 900, margin: '64px auto 0',
          background: 'linear-gradient(135deg, #0A1128 0%, #0E2040 100%)',
          borderRadius: 16, padding: '24px', boxShadow: '0 24px 80px rgba(0,77,140,0.18)',
          border: '1px solid #1E3A5F',
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: "Today's Sales", value: '$4,820', color: '#2DAE1A' },
              { label: 'Active Shifts', value: '3', color: '#0077CC' },
              { label: 'Books Scanned', value: '47', color: '#F59E0B' },
              { label: 'Variance', value: '+$12.00', color: '#2DAE1A' },
            ].map((stat) => (
              <div key={stat.label} style={{
                flex: '1 1 160px', background: '#0E2040', borderRadius: 10, padding: '16px 20px',
                border: '1px solid #1E3A5F',
              }}>
                <div style={{ fontSize: 11, color: '#8EA8C3', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problems */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              The Problem
            </p>
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Running a lottery store is harder than it needs to be
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
                <div style={{ fontSize: 28, marginBottom: 12 }}>{p.icon}</div>
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
                  width: 44, height: 44, borderRadius: 12,
                  background: 'linear-gradient(135deg, #EAF6FF, #EAF9EA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, marginBottom: 16,
                }}>
                  {f.icon}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', gap: 24, alignItems: 'flex-start', position: 'relative' }}>
                {/* Line connector */}
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

      {/* CTA */}
      <section style={{
        padding: '80px 24px',
        background: 'linear-gradient(135deg, #0A1128 0%, #0E2040 100%)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Ready to modernize your store?
          </h2>
          <p style={{ fontSize: 16, color: '#8EA8C3', margin: '0 0 40px', lineHeight: 1.7 }}>
            Join lottery store owners already using LottoMeter to save time and reduce errors every single day.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/apply" style={{
              textDecoration: 'none', fontSize: 15, fontWeight: 700, color: '#0A1128',
              padding: '14px 28px', borderRadius: 10,
              background: 'linear-gradient(to right, #4DB8FF, #5CDE3A)',
              boxShadow: '0 4px 20px rgba(77,184,255,0.25)',
            }}>
              Request a Free Demo
            </Link>
            <Link to="/contact" style={{
              textDecoration: 'none', fontSize: 15, fontWeight: 600, color: '#C8D8E8',
              padding: '14px 28px', borderRadius: 10,
              border: '1.5px solid #1E3A5F',
            }}>
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
