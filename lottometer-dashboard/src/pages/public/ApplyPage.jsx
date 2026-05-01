import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form) {
  const errs = {}
  if (!form.full_name.trim()) errs.full_name = 'Name is required.'
  if (!form.email.trim()) {
    errs.email = 'Email is required.'
  } else if (!EMAIL_RE.test(form.email)) {
    errs.email = 'Enter a valid email address.'
  }
  if (!form.phone.trim()) errs.phone = 'Phone number is required.'
  return errs
}

export default function ApplyPage() {
  const [form, setForm] = useState({
    full_name: '', business_name: '', email: '', phone: '',
    city: '', num_employees: '', how_heard: '',
  })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setStatus('loading')
    setSubmitError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'Submission failed.')
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setSubmitError(err.message)
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      <section style={{ padding: '80px 24px 96px', background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)' }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#EAF6FF', border: '1px solid #B3D9F5', borderRadius: 999,
              padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#0077CC', marginBottom: 20,
            }}>
              Free — No credit card required
            </div>
            <h1 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              Request a Free Demo
            </h1>
            <p style={{ fontSize: 15, color: '#46627F', margin: 0, lineHeight: 1.7 }}>
              Fill in your details and we will set up a personalized walkthrough of LottoMeter for your store — at no cost.
            </p>
          </div>

          {status === 'success' ? (
            <div style={{
              background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 14,
              padding: '40px 32px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontWeight: 700, fontSize: 20, margin: '0 0 10px' }}>Application received!</h2>
              <p style={{ fontSize: 14, color: '#46627F', margin: '0 0 24px', lineHeight: 1.6 }}>
                Thanks, <strong>{form.full_name}</strong>! We will reach out to <strong>{form.email}</strong> within one business day to schedule your demo.
              </p>
              <Link to="/" style={{
                textDecoration: 'none', fontSize: 14, fontWeight: 600, color: '#0077CC',
                padding: '10px 22px', borderRadius: 8, border: '1.5px solid #B3D9F5',
              }}>
                Back to Home
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              style={{ background: '#fff', borderRadius: 16, padding: '36px', boxShadow: '0 4px 24px rgba(0,77,140,0.08)', border: '1px solid #E2EAF4' }}
            >
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Field
                  label="Full Name" placeholder="Jane Smith" required
                  value={form.full_name} onChange={set('full_name')} error={errors.full_name}
                />
                <Field
                  label="Business / Store Name" placeholder="Lucky Stars Lottery"
                  value={form.business_name} onChange={set('business_name')}
                />
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
                <Field
                  label="Email Address" placeholder="jane@example.com" type="email" required
                  value={form.email} onChange={set('email')} error={errors.email}
                />
                <Field
                  label="Phone Number" placeholder="+1 (555) 000-0000" type="tel" required
                  value={form.phone} onChange={set('phone')} error={errors.phone}
                />
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
                <Field
                  label="City / Location" placeholder="Toronto, ON"
                  value={form.city} onChange={set('city')}
                />
                <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Number of Employees</label>
                  <select value={form.num_employees} onChange={set('num_employees')} style={inputStyle}>
                    <option value="">Select range</option>
                    <option value="1-2">1–2</option>
                    <option value="3-5">3–5</option>
                    <option value="6-10">6–10</option>
                    <option value="10+">10+</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
                <label style={labelStyle}>How did you hear about us?</label>
                <select value={form.how_heard} onChange={set('how_heard')} style={inputStyle}>
                  <option value="">Select an option</option>
                  <option value="google">Google Search</option>
                  <option value="social">Social Media</option>
                  <option value="referral">Referred by someone</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {status === 'error' && (
                <p style={{ fontSize: 13, color: '#EF4444', margin: '12px 0 0' }}>{submitError}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  marginTop: 28, width: '100%',
                  padding: '14px', borderRadius: 10, border: 'none',
                  cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                  fontSize: 15, fontWeight: 700, color: '#fff',
                  background: status === 'loading' ? '#9CA3AF' : 'linear-gradient(to right, #0077CC, #2DAE1A)',
                  boxShadow: status === 'loading' ? 'none' : '0 4px 16px rgba(0,119,204,0.25)',
                }}
              >
                {status === 'loading' ? 'Submitting...' : 'Request My Free Demo'}
              </button>

              <p style={{ fontSize: 12, color: '#8EA8C3', textAlign: 'center', margin: '16px 0 0' }}>
                No spam. No obligations. We will only contact you about your demo.
              </p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}

function Field({ label, placeholder, required, type = 'text', value, onChange, error }) {
  return (
    <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ ...inputStyle, borderColor: error ? '#EF4444' : '#E2EAF4' }}
      />
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  )
}

const labelStyle = { fontSize: 13, fontWeight: 600, color: '#0A1128' }
const errorStyle = { fontSize: 12, color: '#EF4444', marginTop: 2 }
const inputStyle = {
  padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E2EAF4',
  fontSize: 14, color: '#0A1128', outline: 'none', background: '#FAFCFF',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
}
