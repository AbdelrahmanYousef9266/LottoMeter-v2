import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'
import settings from '../../config/settings'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputStyle = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1.5px solid #E2EAF4',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle = { fontSize: 13, fontWeight: 600, marginBottom: 5, display: 'block' }

function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Waitlist mode (PAYMENTS_ENABLED = false) ──────────────────────────────

function WaitlistForm() {
  const [form, setForm] = useState({ name: '', email: '', store_name: '', phone: '' })
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !EMAIL_RE.test(form.email)) {
      setError('Please enter your name and a valid email.')
      return
    }
    setStatus('loading')
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed.')
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError(err.message)
    }
  }

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h3 style={{ fontWeight: 800, fontSize: 22, margin: '0 0 12px' }}>You are on the list!</h3>
        <p style={{ fontSize: 15, color: '#46627F', lineHeight: 1.7, margin: '0 0 28px' }}>
          We will notify <strong>{form.email}</strong> as soon as LottoMeter launches.
        </p>
        <Link to="/" style={{
          textDecoration: 'none', fontSize: 14, fontWeight: 600, color: '#0077CC',
          padding: '10px 22px', borderRadius: 8, border: '1.5px solid #B3D9F5',
        }}>
          ← Back to Home
        </Link>
      </div>
    )
  }

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #FFF8E1, #FFF3CD)',
        border: '1px solid #FFD54F',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 28,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 18 }}>🚀</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#7C5A00', marginBottom: 2 }}>Coming Soon</div>
          <div style={{ fontSize: 13, color: '#92690A', lineHeight: 1.5 }}>
            We are not accepting subscriptions yet. Join the waitlist and we will reach out the moment we launch.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Your Name" required>
          <input type="text" placeholder="Jane Smith" value={form.name} onChange={set('name')} style={inputStyle} />
        </Field>
        <Field label="Email Address" required>
          <input type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} style={inputStyle} />
        </Field>
        <Field label="Store Name">
          <input type="text" placeholder="Lucky Stars Lottery" value={form.store_name} onChange={set('store_name')} style={inputStyle} />
        </Field>
        <Field label="Phone Number">
          <input type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={set('phone')} style={inputStyle} />
        </Field>

        {status === 'error' && (
          <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            padding: '13px', borderRadius: 9, border: 'none',
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 15, color: '#fff', marginTop: 4,
            background: status === 'loading' ? '#9CA3AF' : 'linear-gradient(to right, #0077CC, #2DAE1A)',
            boxShadow: status === 'loading' ? 'none' : '0 4px 16px rgba(0,119,204,0.25)',
          }}
        >
          {status === 'loading' ? 'Submitting…' : 'Join Waitlist'}
        </button>
      </form>
    </>
  )
}

// ─── Subscription form (PAYMENTS_ENABLED = true) ───────────────────────────

function SubscriptionForm() {
  const [form, setForm] = useState({
    store_name: '', store_code: '', admin_username: '', admin_email: '',
    admin_password: '', confirm_password: '',
  })
  const [status, setStatus] = useState(null)
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => {
    const val = e.target.value
    setForm((p) => {
      const next = { ...p, [k]: val }
      if (k === 'store_name' && !p._codeEdited) {
        next.store_code = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
      }
      return next
    })
  }

  const handleCodeChange = (e) => {
    setForm((p) => ({ ...p, store_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), _codeEdited: true }))
  }

  const validate = () => {
    const e = {}
    if (!form.store_name.trim()) e.store_name = 'Store name is required.'
    if (!form.store_code.trim()) e.store_code = 'Store code is required.'
    if (!form.admin_username.trim()) e.admin_username = 'Username is required.'
    if (!EMAIL_RE.test(form.admin_email)) e.admin_email = 'Valid email required.'
    if (form.admin_password.length < 8) e.admin_password = 'Password must be at least 8 characters.'
    if (form.admin_password !== form.confirm_password) e.confirm_password = 'Passwords do not match.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStatus('loading')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/get-started`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed.')
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrors({ _global: err.message })
    }
  }

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h3 style={{ fontWeight: 800, fontSize: 22, margin: '0 0 12px' }}>Store created!</h3>
        <p style={{ fontSize: 15, color: '#46627F', lineHeight: 1.7, margin: '0 0 28px' }}>
          Your account is ready. Log in at the staff portal to get started.
        </p>
        <Link to="/login" style={{
          textDecoration: 'none', fontSize: 15, fontWeight: 700, color: '#fff',
          padding: '12px 28px', borderRadius: 9,
          background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
        }}>
          Go to Login
        </Link>
      </div>
    )
  }

  const err = (k) => errors[k] ? <p style={{ fontSize: 12, color: '#EF4444', margin: '4px 0 0' }}>{errors[k]}</p> : null

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#46627F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: -4 }}>
        Store Info
      </div>
      <Field label="Store Name" required>
        <input type="text" placeholder="Lucky Stars Lottery" value={form.store_name} onChange={set('store_name')} style={inputStyle} />
        {err('store_name')}
      </Field>
      <Field label="Store Code" required>
        <input type="text" placeholder="LUCKY8" value={form.store_code} onChange={handleCodeChange} style={inputStyle} maxLength={8} />
        <span style={{ fontSize: 11, color: '#8EA8C3', marginTop: 4 }}>Short unique ID for your store (letters + numbers, max 8).</span>
        {err('store_code')}
      </Field>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#46627F', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, marginBottom: -4 }}>
        Admin Account
      </div>
      <Field label="Username" required>
        <input type="text" placeholder="jane_admin" value={form.admin_username} onChange={set('admin_username')} style={inputStyle} />
        {err('admin_username')}
      </Field>
      <Field label="Email Address" required>
        <input type="email" placeholder="jane@example.com" value={form.admin_email} onChange={set('admin_email')} style={inputStyle} />
        {err('admin_email')}
      </Field>
      <Field label="Password" required>
        <input type="password" placeholder="Min. 8 characters" value={form.admin_password} onChange={set('admin_password')} style={inputStyle} />
        {err('admin_password')}
      </Field>
      <Field label="Confirm Password" required>
        <input type="password" placeholder="Repeat password" value={form.confirm_password} onChange={set('confirm_password')} style={inputStyle} />
        {err('confirm_password')}
      </Field>

      {errors._global && (
        <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{errors._global}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          padding: '13px', borderRadius: 9, border: 'none', marginTop: 4,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: 15, color: '#fff',
          background: status === 'loading' ? '#9CA3AF' : 'linear-gradient(to right, #0077CC, #2DAE1A)',
          boxShadow: status === 'loading' ? 'none' : '0 4px 16px rgba(0,119,204,0.25)',
        }}
      >
        {status === 'loading' ? 'Creating account…' : `Start Subscription — ${settings.PLAN_CURRENCY}${settings.PLAN_PRICE}/${settings.PLAN_INTERVAL}`}
      </button>

      <p style={{ fontSize: 12, color: '#8EA8C3', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
        You will be redirected to Stripe to complete payment. No charges until you confirm.
      </p>
    </form>
  )
}

// ─── Plan Summary sidebar ──────────────────────────────────────────────────

function PlanSummary() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0A1128, #0E2040)',
      borderRadius: 20,
      padding: '36px 32px',
      border: '2px solid #0077CC',
      boxShadow: '0 16px 56px rgba(0,119,204,0.18)',
      position: 'sticky',
      top: 88,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8EA8C3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {settings.PLAN_NAME} Plan
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
          {settings.PLAN_CURRENCY}{settings.PLAN_PRICE}
        </span>
        <span style={{ fontSize: 14, color: '#8EA8C3', paddingBottom: 6 }}>/ {settings.PLAN_INTERVAL}</span>
      </div>
      <p style={{ fontSize: 13, color: '#8EA8C3', margin: '0 0 24px', lineHeight: 1.6 }}>
        Everything you need to run your lottery store operations.
      </p>

      <div style={{ borderTop: '1px solid #1E3A5F', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {settings.PLAN_FEATURES.map((f) => (
          <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: '#2DAE1A', fontWeight: 700, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ fontSize: 13, color: '#C8D8E8', lineHeight: 1.5 }}>{f}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #1E3A5F', paddingTop: 18, marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 12, color: '#8EA8C3', fontWeight: 600 }}>No contracts · Cancel anytime</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <span style={{ fontSize: 12, color: '#8EA8C3', fontWeight: 600 }}>Email support included</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function GetStartedPage() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      <section style={{ padding: '56px 24px 80px', background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Page heading */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
              {settings.PAYMENTS_ENABLED ? 'Create Your Account' : 'Get Early Access'}
            </p>
            <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              {settings.PAYMENTS_ENABLED ? 'Start Your Subscription' : 'Join the Waitlist'}
            </h1>
            <p style={{ fontSize: 15, color: '#46627F', margin: 0, lineHeight: 1.7 }}>
              {settings.PAYMENTS_ENABLED
                ? 'Set up your store in minutes. No setup fees.'
                : 'Be first to know when LottoMeter launches. One email, no spam.'}
            </p>
          </div>

          {/* Two-column layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)',
            gap: 40,
            alignItems: 'start',
          }} className="gs-grid">
            {/* Left — form */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              padding: '36px',
              border: '1.5px solid #E2EAF4',
              boxShadow: '0 4px 24px rgba(0,77,140,0.07)',
            }}>
              <h2 style={{ fontWeight: 800, fontSize: 18, margin: '0 0 24px' }}>
                {settings.PAYMENTS_ENABLED ? 'Store & Account Details' : 'Reserve Your Spot'}
              </h2>
              {settings.PAYMENTS_ENABLED ? <SubscriptionForm /> : <WaitlistForm />}
            </div>

            {/* Right — plan summary */}
            <PlanSummary />
          </div>

          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#8EA8C3' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#0077CC', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
          </p>
        </div>
      </section>

      <style>{`
        @media (max-width: 700px) {
          .gs-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </div>
  )
}
