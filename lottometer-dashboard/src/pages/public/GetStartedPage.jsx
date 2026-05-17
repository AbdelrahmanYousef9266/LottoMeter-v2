import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'

// ── Validation ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[\d\s\-\(\)]{7,20}$/
const ZIP_RE   = /^\d{5}(-\d{4})?$/

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],
  ['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],
  ['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],
  ['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],
  ['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],
  ['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],
  ['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],
  ['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],
  ['WI','Wisconsin'],['WY','Wyoming'],
]

function validateForm(f) {
  const e = {}
  if (!f.business_name.trim())       e.business_name       = 'Required.'
  if (!f.store_location_name.trim()) e.store_location_name = 'Required.'
  if (!f.full_name.trim())           e.full_name           = 'Required.'
  if (!EMAIL_RE.test(f.email))       e.email               = 'Enter a valid email address.'
  if (!f.phone.trim())               e.phone               = 'Required.'
  else if (!PHONE_RE.test(f.phone))  e.phone               = 'Enter a valid phone number.'
  if (!f.address.trim())             e.address             = 'Required.'
  if (!f.city.trim())                e.city                = 'Required.'
  if (!f.state)                      e.state               = 'Please select a state.'
  if (!ZIP_RE.test(f.zip_code))      e.zip_code            = 'Enter a valid ZIP (e.g. 29201).'
  if (f.shipping_differs) {
    if (!f.shipping_address.trim())  e.shipping_address    = 'Required.'
    if (!f.shipping_city.trim())     e.shipping_city       = 'Required.'
    if (!f.shipping_state)           e.shipping_state      = 'Required.'
    if (!ZIP_RE.test(f.shipping_zip)) e.shipping_zip       = 'Enter a valid ZIP.'
  }
  if (!f.num_employees)              e.num_employees       = 'Required.'
  if (!f.jurisdiction_confirmed)     e.jurisdiction_confirmed = 'You must confirm this to continue.'
  if (!f.terms_agreed)               e.terms_agreed        = 'You must agree to the Terms of Service.'
  return e
}

// ── Style constants ───────────────────────────────────────────────────────────

const GRAD_TEXT = {
  background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}
const GRAD_BTN = (disabled) => ({
  background: disabled ? '#9CA3AF' : 'linear-gradient(to right, #0077CC, #2DAE1A)',
  boxShadow: disabled ? 'none' : '0 4px 16px rgba(0,119,204,0.25)',
  color: '#fff', border: 'none', borderRadius: 10,
  fontWeight: 700, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
})
const INPUT = (hasErr) => ({
  padding: '10px 14px', borderRadius: 8, fontSize: 14, outline: 'none',
  background: '#FAFCFF', width: '100%', boxSizing: 'border-box',
  transition: 'border-color 0.15s', color: '#0A1128',
  border: `1.5px solid ${hasErr ? '#EF4444' : '#E2EAF4'}`,
})
const LABEL = { fontSize: 13, fontWeight: 600, color: '#0A1128', display: 'block', marginBottom: 5 }
const ERR   = { fontSize: 12, color: '#EF4444', marginTop: 3, display: 'block' }

// ── Small reusable pieces ─────────────────────────────────────────────────────

function CheckSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="9" cy="9" r="9" fill="#2DAE1A" fillOpacity="0.15" />
      <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#2DAE1A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Field({ label, required, helper, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={LABEL}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
      {helper && !error && <span style={{ fontSize: 12, color: '#8EA8C3', marginTop: 3 }}>{helper}</span>}
      {error && <span style={ERR}>{error}</span>}
    </div>
  )
}

function SelectField({ label, required, error, value, onChange, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#EF4444' }}> *</span>}</label>
      <select value={value} onChange={onChange} style={INPUT(!!error)}>
        {children}
      </select>
      {error && <span style={ERR}>{error}</span>}
    </div>
  )
}

function StateSelect({ value, onChange, error }) {
  return (
    <select value={value} onChange={onChange} style={INPUT(!!error)}>
      <option value="">Select state</option>
      {US_STATES.map(([code, name]) => (
        <option key={code} value={code}>{name}</option>
      ))}
    </select>
  )
}

function AddressBlock({ prefix, form, set, errors }) {
  const p = prefix ? prefix + '_' : ''
  const f = (k) => form[p + k]
  const e = (k) => errors[p + k]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Address" required error={e('address')}>
        <input type="text" placeholder="123 Main St" value={f('address')} onChange={set(p + 'address')} style={INPUT(!!e('address'))} />
      </Field>
      <Field label="Address line 2" helper="Suite, unit, etc. (optional)">
        <input type="text" placeholder="Suite 4B" value={f('address2')} onChange={set(p + 'address2')} style={INPUT(false)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }} className="addr-grid">
        <Field label="City" required error={e('city')}>
          <input type="text" placeholder="Columbia" value={f('city')} onChange={set(p + 'city')} style={INPUT(!!e('city'))} />
        </Field>
        <Field label="State" required error={e('state')}>
          <StateSelect value={f('state')} onChange={set(p + 'state')} error={e('state')} />
        </Field>
        <Field label="ZIP" required error={e('zip_code') || e('zip')}>
          <input type="text" placeholder="29201" value={f('zip_code') ?? f('zip')} onChange={set(p + (prefix ? 'zip' : 'zip_code'))} style={INPUT(!!(e('zip_code') || e('zip')))} maxLength={10} />
        </Field>
      </div>
    </div>
  )
}

// ── Inline SVG icons (Lucide-style) ───────────────────────────────────────────

function IconTruck() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0077CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
      <rect x="9" y="11" width="14" height="10" rx="2" />
      <circle cx="12" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
    </svg>
  )
}

function IconCalendarX() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0077CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m14 14-4 4M10 14l4 4" />
    </svg>
  )
}

function IconShieldCheck() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0077CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "What if my state isn't supported yet?",
    a: "We're starting in South Carolina to make sure we provide great support to our first customers. Submit an application and we'll let you know the moment we launch in your state — no obligation.",
  },
  {
    q: "What happens after I submit my application?",
    a: "A team member reviews your application within one business day. Once approved, you'll receive an email with a secure payment link. After payment, we'll configure your device and ship it within 3–5 business days.",
  },
  {
    q: "What's the $149 for, exactly?",
    a: "$100 covers your Android device, configuration, and the one-time setup we do on our end. $49 is your first month of service. Going forward, you only pay $49/month.",
  },
  {
    q: "Can I use my own device instead?",
    a: "Not yet. For now, every store gets a LottoMeter-configured Android device. This ensures your team has the right hardware, properly locked down for store use, with full support if anything goes wrong.",
  },
  {
    q: "What if the device breaks?",
    a: "We replace any device that fails through normal use within the first 12 months at no cost. After that, replacements are available at our cost — typically around $100.",
  },
  {
    q: "What if I want to cancel?",
    a: "Cancel anytime from your dashboard. If you cancel within 14 days of receiving your device, return it in good condition and we'll refund the full $149. After 14 days, you can keep the device for use as a backup or general Android tablet — we just deactivate the LottoMeter service.",
  },
  {
    q: "Do you handle payment processing or money?",
    a: "No. LottoMeter tracks lottery shifts and cash reconciliation. We don't handle customer payments or process money. We're a tool that helps you and your team know exactly what's owed at the end of every shift.",
  },
]

// ── How it works steps ────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    title: 'You apply (5 minutes)',
    body: 'Tell us about your store and shipping address. We\'ll confirm your application within one business day.',
  },
  {
    title: 'You pay $149',
    body: 'Secure one-time payment covers your device, setup, and your first month of service. No long-term contract.',
  },
  {
    title: 'We prepare your device',
    body: 'Our team configures your Android device with LottoMeter, locks it to your store, and tests it end-to-end before it ships.',
  },
  {
    title: 'You unbox and go live',
    body: 'Plug it in, log in with the credentials we email you, and start scanning. Most stores are live within 10 minutes of opening the box.',
  },
]

// ── Initial form state ────────────────────────────────────────────────────────

const INIT = {
  business_name: '', store_location_name: '',
  full_name: '', email: '', phone: '',
  address: '', address2: '', city: '', state: 'SC', zip_code: '',
  shipping_differs: false,
  shipping_address: '', shipping_address2: '', shipping_city: '', shipping_state: 'SC', shipping_zip: '',
  num_employees: '', how_heard: '',
  jurisdiction_confirmed: false, terms_agreed: false,
  website: '', // honeypot — never shown to user
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GetStartedPage() {
  const formRef    = useRef(null)
  const navigate   = useNavigate()
  const [form, setForm]       = useState(INIT)
  const [errors, setErrors]   = useState({})
  const [topError, setTopError] = useState('')
  const [status, setStatus]   = useState(null)   // null | 'loading' | 'success' | 'error'
  const [openFaqs, setOpenFaqs] = useState({})

  const scrollToForm = () =>
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((p) => ({ ...p, [k]: val }))
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validateForm(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      setTopError('Please complete the highlighted fields below.')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setErrors({})
    setTopError('')
    setStatus('loading')

    const payload = {
      full_name:    form.full_name,
      email:        form.email,
      business_name: form.business_name,
      phone:        form.phone,
      city:         form.city,
      state:        form.state,
      num_employees: form.num_employees,
      how_heard:    form.how_heard || null,
      website:      form.website,
      extra_data: {
        store_location_name: form.store_location_name,
        address:             form.address,
        address2:            form.address2,
        zip_code:            form.zip_code,
        shipping_differs:    form.shipping_differs,
        shipping_address:    form.shipping_differs ? form.shipping_address   : null,
        shipping_address2:   form.shipping_differs ? form.shipping_address2  : null,
        shipping_city:       form.shipping_differs ? form.shipping_city      : null,
        shipping_state:      form.shipping_differs ? form.shipping_state     : null,
        shipping_zip:        form.shipping_differs ? form.shipping_zip       : null,
        jurisdiction_confirmed: form.jurisdiction_confirmed,
        terms_agreed:           form.terms_agreed,
      },
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed.')
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setTopError(typeof err.message === 'string' ? err.message : 'Submission failed. Please try again.')
    }
  }

  const toggleFaq = (i) => setOpenFaqs((p) => ({ ...p, [i]: !p[i] }))

  // ── Section containers ─────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      {/* ── S1: Hero ── */}
      <section style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)', padding: '80px 24px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>
            Get Started
          </p>
          <h1 style={{ fontSize: 'clamp(30px, 4vw, 52px)', fontWeight: 900, margin: '0 0 18px', letterSpacing: '-0.02em', lineHeight: 1.12 }}>
            Everything you need to{' '}
            <span style={GRAD_TEXT}>track shifts properly</span>.
          </h1>
          <p style={{ fontSize: 16, color: '#46627F', margin: '0 auto', maxWidth: 540, lineHeight: 1.75 }}>
            A ready-to-use device, your account set up by us, and software your team will actually use. Shipped to your door.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px', maxWidth: 520, margin: '28px auto 0', fontSize: 14, color: '#46627F', textAlign: 'left' }} className="hero-bullets">
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#2DAE1A', fontWeight: 800, flexShrink: 0 }}>✓</span>
              Configured device shipped to you in 3–5 business days
            </span>
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#2DAE1A', fontWeight: 800, flexShrink: 0 }}>✓</span>
              14-day money-back guarantee
            </span>
          </div>
        </div>
      </section>

      {/* ── S2: Offer card ── */}
      <section style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)', padding: '48px 24px 80px' }}>
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

            <div style={{ fontSize: 11, fontWeight: 700, color: '#8EA8C3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              What You Get
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1 }}>$149</span>
              <span style={{ fontSize: 14, color: '#8EA8C3', paddingBottom: 8 }}>due today</span>
            </div>
            <p style={{ fontSize: 13, color: '#8EA8C3', margin: '0 0 28px' }}>
              then $49/month — cancel anytime
            </p>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {[
                'Configured Android device, pre-set up for your store',
                'All software and dashboard access, ready on day one',
                'Free shipping within South Carolina',
                '14-day money-back guarantee on the device',
              ].map((f) => (
                <div key={f} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <CheckSvg />
                  <span style={{ fontSize: 14, color: '#E0EAF5', lineHeight: 1.55 }}>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={scrollToForm}
              style={{ ...GRAD_BTN(false), display: 'block', width: '100%', padding: '15px', fontSize: 16 }}
            >
              Start Setup
            </button>
            <p style={{ fontSize: 12, color: '#8EA8C3', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.55 }}>
              Currently serving stores in South Carolina only. More states coming soon.
            </p>
          </div>
        </div>
      </section>

      {/* ── S3: How it works ── */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
              How it works
            </p>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
              From application to{' '}
              <span style={GRAD_TEXT}>live in days</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {HOW_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
                {/* Left: circle + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(to bottom right, #0077CC, #2DAE1A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 17, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  {i < HOW_STEPS.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: 'linear-gradient(to bottom, #0077CC33, #2DAE1A33)', margin: '6px 0' }} />
                  )}
                </div>
                {/* Right: text */}
                <div style={{ paddingBottom: i < HOW_STEPS.length - 1 ? 36 : 0, paddingTop: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{step.title}</div>
                  <p style={{ fontSize: 14, color: '#46627F', lineHeight: 1.7, margin: 0 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── S4: Application form ── */}
      <section
        ref={formRef}
        id="apply-form"
        style={{ padding: '80px 24px', background: '#F8FAFF' }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 900, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              Tell us about your{' '}
              <span style={GRAD_TEXT}>store</span>
            </h2>
            <p style={{ fontSize: 15, color: '#46627F', margin: 0, lineHeight: 1.7 }}>
              We'll review your application and email you a payment link within one business day.
            </p>
          </div>

          {status === 'success' ? (
            <div style={{
              background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 16,
              padding: '48px 36px', textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(to right, #0077CC22, #2DAE1A22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DAE1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 style={{ fontWeight: 800, fontSize: 22, margin: '0 0 12px' }}>Application received!</h2>
              <p style={{ fontSize: 15, color: '#46627F', margin: '0 0 8px', lineHeight: 1.7 }}>
                Thanks, <strong>{form.full_name}</strong>! We'll be in touch within one business day.
              </p>
              <p style={{ fontSize: 14, color: '#46627F', margin: '0 0 28px', lineHeight: 1.7 }}>
                Your payment link will arrive at <strong>{form.email}</strong> once your application is approved.
              </p>
              <Link to="/" style={{
                textDecoration: 'none', fontSize: 14, fontWeight: 600, color: '#0077CC',
                padding: '10px 22px', borderRadius: 8, border: '1.5px solid #B3D9F5',
              }}>
                Back to Home
              </Link>
            </div>
          ) : (
            <div style={{
              background: '#fff', borderRadius: 16, padding: '40px',
              border: '1.5px solid #E2EAF4',
              boxShadow: '0 4px 24px rgba(0,77,140,0.07)',
            }}>
              {/* Top error summary */}
              {topError && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                  padding: '12px 16px', marginBottom: 24, fontSize: 13,
                  color: '#DC2626', fontWeight: 600,
                }}>
                  {topError}
                </div>
              )}

              {/* Honeypot — hidden from real users */}
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={set('website')}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Business info */}
                <SectionLabel>Business Info</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-grid">
                  <Field label="Business name" required error={errors.business_name}>
                    <input type="text" placeholder="Lucky Stars LLC" value={form.business_name} onChange={set('business_name')} style={INPUT(!!errors.business_name)} />
                  </Field>
                  <Field label="Store / location name" required helper="What the store is called day-to-day" error={errors.store_location_name}>
                    <input type="text" placeholder="Lucky Stars Lottery" value={form.store_location_name} onChange={set('store_location_name')} style={INPUT(!!errors.store_location_name)} />
                  </Field>
                </div>

                {/* Owner info */}
                <SectionLabel>Owner Info</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-grid">
                  <Field label="Owner full name" required error={errors.full_name}>
                    <input type="text" placeholder="Jane Smith" value={form.full_name} onChange={set('full_name')} style={INPUT(!!errors.full_name)} />
                  </Field>
                  <Field label="Owner email" required error={errors.email}>
                    <input type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} style={INPUT(!!errors.email)} />
                  </Field>
                </div>
                <Field label="Owner phone" required error={errors.phone}>
                  <input type="tel" placeholder="(803) 555-0100" value={form.phone} onChange={set('phone')} style={INPUT(!!errors.phone)} />
                </Field>

                {/* Business address */}
                <SectionLabel>Business Address</SectionLabel>
                <AddressBlock prefix="" form={form} set={set} errors={errors} />

                {/* Non-SC warning */}
                {form.state && form.state !== 'SC' && (
                  <div style={{
                    background: '#FFFBEB', border: '1px solid #FCD34D',
                    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E',
                  }}>
                    We're currently only serving stores in South Carolina. Submit anyway and we'll let you know as soon as we launch in your state.
                  </div>
                )}

                {/* Shipping toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#0A1128', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={form.shipping_differs}
                    onChange={set('shipping_differs')}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0077CC' }}
                  />
                  Shipping address differs from business address
                </label>

                {form.shipping_differs && (
                  <div style={{ border: '1px solid #E2EAF4', borderRadius: 10, padding: '20px', background: '#F8FAFF' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#46627F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                      Shipping address
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <Field label="Address" required error={errors.shipping_address}>
                        <input type="text" placeholder="123 Main St" value={form.shipping_address} onChange={set('shipping_address')} style={INPUT(!!errors.shipping_address)} />
                      </Field>
                      <Field label="Address line 2" helper="Suite, unit, etc. (optional)">
                        <input type="text" placeholder="Suite 4B" value={form.shipping_address2} onChange={set('shipping_address2')} style={INPUT(false)} />
                      </Field>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }} className="addr-grid">
                        <Field label="City" required error={errors.shipping_city}>
                          <input type="text" placeholder="Columbia" value={form.shipping_city} onChange={set('shipping_city')} style={INPUT(!!errors.shipping_city)} />
                        </Field>
                        <Field label="State" required error={errors.shipping_state}>
                          <StateSelect value={form.shipping_state} onChange={set('shipping_state')} error={errors.shipping_state} />
                        </Field>
                        <Field label="ZIP" required error={errors.shipping_zip}>
                          <input type="text" placeholder="29201" value={form.shipping_zip} onChange={set('shipping_zip')} style={INPUT(!!errors.shipping_zip)} maxLength={10} />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}

                {/* Store details */}
                <SectionLabel>About Your Store</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-grid">
                  <SelectField label="Number of employees" required error={errors.num_employees} value={form.num_employees} onChange={set('num_employees')}>
                    <option value="">Select range</option>
                    <option value="1-2">1–2</option>
                    <option value="3-5">3–5</option>
                    <option value="6-10">6–10</option>
                    <option value="11+">11+</option>
                  </SelectField>
                  <SelectField label="How did you hear about us?" value={form.how_heard} onChange={set('how_heard')}>
                    <option value="">Select an option (optional)</option>
                    <option value="google">Google search</option>
                    <option value="social">Social media</option>
                    <option value="referral">A friend / another store owner</option>
                    <option value="lottery_commission">Lottery commission</option>
                    <option value="other">Other</option>
                  </SelectField>
                </div>

                {/* Legal confirmations */}
                <SectionLabel>Confirmations</SectionLabel>

                <CheckboxField
                  error={errors.jurisdiction_confirmed}
                  checked={form.jurisdiction_confirmed}
                  onChange={set('jurisdiction_confirmed')}
                >
                  I confirm that lottery sales are legal in my state and my business is licensed to sell them. I understand LottoMeter is a tracking tool and does not replace any required state lottery commission processes.
                </CheckboxField>

                <CheckboxField
                  error={errors.terms_agreed}
                  checked={form.terms_agreed}
                  onChange={set('terms_agreed')}
                >
                  I have read and agree to the{' '}
                  <a href="#" style={{ color: '#0077CC', textDecoration: 'none' }}>Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" style={{ color: '#0077CC', textDecoration: 'none' }}>Privacy Policy</a>.
                  {' '}I understand my $149 payment is refundable within 14 days of receiving my device, per the satisfaction guarantee.
                </CheckboxField>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  style={{ ...GRAD_BTN(status === 'loading'), padding: '15px', marginTop: 8, width: '100%' }}
                >
                  {status === 'loading' ? 'Submitting…' : 'Submit Application'}
                </button>

                <p style={{ fontSize: 13, color: '#8EA8C3', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                  We respond to every application within one business day. Most stores are live within a week of applying.
                </p>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ── S5: Trust row ── */}
      <section style={{ padding: '64px 24px', background: '#F0F7FF' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }} className="trust-grid">
          {[
            {
              icon: <IconTruck />,
              title: 'Shipped from South Carolina',
              body: 'We are locally based. Devices ship in 1–2 business days after payment.',
            },
            {
              icon: <IconCalendarX />,
              title: 'No long-term contract',
              body: 'Monthly plan. Cancel anytime from your dashboard.',
            },
            {
              icon: <IconShieldCheck />,
              title: '14-day money-back guarantee',
              body: 'Not satisfied? Return the device in good condition and get a full refund.',
            },
          ].map((t) => (
            <div key={t.title} style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.title}</div>
              <p style={{ fontSize: 14, color: '#46627F', margin: 0, lineHeight: 1.65 }}>{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── S6: FAQ ── */}
      <section style={{ padding: '72px 24px 80px', background: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Frequently asked questions
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                style={{
                  background: '#F8FAFF', borderRadius: 12,
                  border: '1px solid #E2EAF4',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => toggleFaq(i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '18px 20px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#0A1128', lineHeight: 1.4 }}>{item.q}</span>
                  <span style={{
                    flexShrink: 0, fontSize: 18, color: '#0077CC', lineHeight: 1,
                    transform: openFaqs[i] ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}>
                    ›
                  </span>
                </button>
                {openFaqs[i] && (
                  <div style={{ padding: '0 20px 18px', fontSize: 14, color: '#46627F', lineHeight: 1.7 }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── S7: Final CTA ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0A1128 0%, #0E2040 100%)',
        padding: '80px 24px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,119,204,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 560, margin: '0 auto', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
            Ready to get your{' '}
            <span style={GRAD_TEXT}>store</span> set up?
          </h2>
          <p style={{ fontSize: 15, color: '#8EA8C3', margin: '0 0 36px', lineHeight: 1.7 }}>
            Submit your application above. We'll handle the rest.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={scrollToForm}
              style={{ ...GRAD_BTN(false), padding: '14px 32px' }}
            >
              Apply Now
            </button>
            <Link to="/contact" style={{
              textDecoration: 'none', fontSize: 15, fontWeight: 700,
              padding: '13px 28px', borderRadius: 10,
              background: 'rgba(255,255,255,0.08)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              color: '#fff', display: 'inline-block',
              transition: 'background 0.15s',
            }}>
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 768px) {
          .hero-bullets { grid-template-columns: 1fr !important; }
          .form-grid { grid-template-columns: 1fr !important; }
          .trust-grid { grid-template-columns: 1fr !important; }
          .addr-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── Tiny layout helpers ────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#46627F',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      borderBottom: '1px solid #E2EAF4', paddingBottom: 8, marginTop: 4,
    }}>
      {children}
    </div>
  )
}

function CheckboxField({ checked, onChange, error, children }) {
  return (
    <div>
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        cursor: 'pointer', fontSize: 13, color: '#46627F', lineHeight: 1.6,
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer', accentColor: '#0077CC', flexShrink: 0 }}
        />
        <span style={{ borderBottom: error ? '1px solid #EF4444' : 'none' }}>{children}</span>
      </label>
      {error && <span style={{ ...ERR, marginLeft: 26 }}>{error}</span>}
    </div>
  )
}
