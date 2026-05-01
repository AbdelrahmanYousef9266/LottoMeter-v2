import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'
import settings from '../../config/settings'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FAQ = [
  { q: "Is there a free trial?", a: "Yes — we offer a free onboarding period so you can get your team set up before your first bill. Reach out after signing up." },
  { q: "Can I cancel anytime?", a: "Absolutely. No contracts, no cancellation fees. Cancel from your account settings at any time." },
  { q: "What happens to my data if I cancel?", a: "Your data is kept for 90 days after cancellation, giving you time to export everything you need." },
  { q: "Do employees need their own subscription?", a: "No. The subscription covers your store — all your employees use the mobile app under the same plan." },
]

export default function PricingPage() {
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [wlForm, setWlForm] = useState({ name: '', email: '', store_name: '', phone: '' })
  const [wlStatus, setWlStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [wlError, setWlError] = useState('')

  const setWl = (k) => (e) => setWlForm((p) => ({ ...p, [k]: e.target.value }))

  const handleWaitlist = async (e) => {
    e.preventDefault()
    if (!wlForm.name.trim() || !EMAIL_RE.test(wlForm.email)) {
      setWlError('Please enter your name and a valid email.')
      return
    }
    setWlStatus('loading')
    setWlError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wlForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed.')
      setWlStatus('success')
    } catch (err) {
      setWlStatus('error')
      setWlError(err.message)
    }
  }

  const price = `${settings.PLAN_CURRENCY}${settings.PLAN_PRICE}`
  const interval = settings.PLAN_INTERVAL

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      {/* Header */}
      <section style={{ padding: '80px 24px 56px', background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
          Pricing
        </p>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          One plan. Everything included.
        </h1>
        <p style={{ fontSize: 16, color: '#46627F', margin: '0 auto', maxWidth: 480, lineHeight: 1.7 }}>
          No tiers, no hidden fees, no contracts. Cancel anytime.
        </p>
      </section>

      {/* Single plan card */}
      <section style={{ padding: '0 24px 80px', background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0A1128, #0E2040)',
            borderRadius: 20, padding: '40px',
            border: '2px solid #0077CC',
            boxShadow: '0 16px 56px rgba(0,119,204,0.22)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow orb */}
            <div style={{
              position: 'absolute', top: -60, right: -60,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,119,204,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <div style={{ fontSize: 12, fontWeight: 700, color: '#8EA8C3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              {settings.PLAN_NAME}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{price}</span>
              <span style={{ fontSize: 15, color: '#8EA8C3', paddingBottom: 8 }}>/ {interval}</span>
            </div>
            <p style={{ fontSize: 14, color: '#8EA8C3', margin: '0 0 28px', lineHeight: 1.6 }}>
              Everything you need to run your lottery store operations — from day one.
            </p>

            {/* CTA */}
            {settings.PAYMENTS_ENABLED ? (
              <Link to="/get-started" style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 15,
                background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
                color: '#fff', marginBottom: 28,
                boxShadow: '0 4px 16px rgba(0,119,204,0.3)',
              }}>
                Get Started
              </Link>
            ) : (
              <button
                onClick={() => setShowWaitlist(true)}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 15,
                  background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
                  color: '#fff', border: 'none', cursor: 'pointer', marginBottom: 28,
                  boxShadow: '0 4px 16px rgba(0,119,204,0.3)',
                }}
              >
                Join Waitlist
              </button>
            )}

            {/* Features */}
            <div style={{ borderTop: '1px solid #1E3A5F', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {settings.PLAN_FEATURES.map((f) => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#2DAE1A', fontWeight: 700, fontSize: 15, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 14, color: '#C8D8E8', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>

            {/* App store badges when published */}
            {settings.APP_PUBLISHED && (settings.GOOGLE_PLAY_URL || settings.APP_STORE_URL) && (
              <div style={{ borderTop: '1px solid #1E3A5F', paddingTop: 20, marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {settings.APP_STORE_URL && (
                  <a href={settings.APP_STORE_URL} target="_blank" rel="noreferrer"
                    style={{ background: '#1E3A5F', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                    Download on App Store
                  </a>
                )}
                {settings.GOOGLE_PLAY_URL && (
                  <a href={settings.GOOGLE_PLAY_URL} target="_blank" rel="noreferrer"
                    style={{ background: '#1E3A5F', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                    Get on Google Play
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Waitlist inline form */}
      {showWaitlist && (
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <div style={{
              background: '#F8FAFF', borderRadius: 16, padding: '36px',
              border: '1.5px solid #E2EAF4', boxShadow: '0 4px 24px rgba(0,77,140,0.08)',
            }}>
              {wlStatus === 'success' ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🎉</div>
                  <h3 style={{ fontWeight: 700, fontSize: 20, margin: '0 0 10px' }}>You are on the list!</h3>
                  <p style={{ fontSize: 14, color: '#46627F', lineHeight: 1.6, margin: 0 }}>
                    We will notify <strong>{wlForm.email}</strong> as soon as LottoMeter launches.
                  </p>
                </div>
              ) : (
                <>
                  <h3 style={{ fontWeight: 700, fontSize: 18, margin: '0 0 6px' }}>Join the Waitlist</h3>
                  <p style={{ fontSize: 14, color: '#46627F', margin: '0 0 24px', lineHeight: 1.5 }}>
                    Be first to know when we launch. No spam — one email when we go live.
                  </p>
                  <form onSubmit={handleWaitlist} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { key: 'name', label: 'Your Name', placeholder: 'Jane Smith', required: true },
                      { key: 'email', label: 'Email Address', placeholder: 'jane@example.com', type: 'email', required: true },
                      { key: 'store_name', label: 'Store Name', placeholder: 'Lucky Stars Lottery' },
                      { key: 'phone', label: 'Phone Number', placeholder: '+1 (555) 000-0000', type: 'tel' },
                    ].map(({ key, label, placeholder, type = 'text', required }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>
                          {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
                        </label>
                        <input
                          type={type}
                          placeholder={placeholder}
                          value={wlForm[key]}
                          onChange={setWl(key)}
                          style={{
                            padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E2EAF4',
                            fontSize: 14, outline: 'none', background: '#fff',
                          }}
                        />
                      </div>
                    ))}
                    {wlStatus === 'error' && (
                      <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{wlError}</p>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button type="submit" disabled={wlStatus === 'loading'}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 9, border: 'none',
                          cursor: wlStatus === 'loading' ? 'not-allowed' : 'pointer',
                          fontWeight: 700, fontSize: 14, color: '#fff',
                          background: wlStatus === 'loading' ? '#9CA3AF' : 'linear-gradient(to right, #0077CC, #2DAE1A)',
                        }}>
                        {wlStatus === 'loading' ? 'Submitting...' : 'Join Waitlist'}
                      </button>
                      <button type="button" onClick={() => setShowWaitlist(false)}
                        style={{ padding: '12px 18px', borderRadius: 9, border: '1.5px solid #E2EAF4', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#46627F' }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section style={{ padding: '72px 24px 80px', background: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Frequently asked questions
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FAQ.map((item) => (
              <div key={item.q} style={{ background: '#F8FAFF', borderRadius: 12, padding: '20px 24px', border: '1px solid #E2EAF4' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{item.q}</div>
                <div style={{ fontSize: 14, color: '#46627F', lineHeight: 1.65 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '64px 24px', background: '#F0F7FF', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          Ready to modernize your store?
        </h2>
        <p style={{ fontSize: 15, color: '#46627F', margin: '0 0 32px', lineHeight: 1.7 }}>
          {settings.PAYMENTS_ENABLED
            ? 'Start your subscription today. No setup fees.'
            : 'Join the waitlist and be first to know when we launch.'}
        </p>
        {settings.PAYMENTS_ENABLED ? (
          <Link to="/get-started" style={{
            textDecoration: 'none', fontSize: 15, fontWeight: 700, color: '#fff',
            padding: '14px 32px', borderRadius: 10,
            background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
            boxShadow: '0 4px 16px rgba(0,119,204,0.25)',
          }}>
            Get Started
          </Link>
        ) : (
          <button onClick={() => { setShowWaitlist(true); window.scrollTo({ top: 400, behavior: 'smooth' }) }}
            style={{
              fontSize: 15, fontWeight: 700, color: '#fff',
              padding: '14px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
              boxShadow: '0 4px 16px rgba(0,119,204,0.25)',
            }}>
            Join Waitlist
          </button>
        )}
      </section>

      <Footer />
    </div>
  )
}
