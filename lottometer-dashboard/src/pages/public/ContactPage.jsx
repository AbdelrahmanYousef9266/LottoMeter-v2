import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'

export default function ContactPage() {
  const [form, setForm] = useState({ full_name: '', business_name: '', phone: '', email: '', message: '' })
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Submission failed.')
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      <section style={{ padding: '80px 24px 96px', background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              Get In Touch
            </p>
            <h1 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              Contact Us
            </h1>
            <p style={{ fontSize: 15, color: '#46627F', margin: 0, lineHeight: 1.7 }}>
              Have a question or want to learn more? Send us a message and we'll get back to you within one business day.
            </p>
          </div>

          {status === 'success' ? (
            <div style={{
              background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 14,
              padding: '40px 32px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontWeight: 700, fontSize: 20, margin: '0 0 10px' }}>Message received!</h2>
              <p style={{ fontSize: 14, color: '#46627F', margin: '0 0 24px', lineHeight: 1.6 }}>
                Thanks for reaching out. We'll reply to <strong>{form.email}</strong> shortly.
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
              style={{ background: '#fff', borderRadius: 16, padding: '36px', boxShadow: '0 4px 24px rgba(0,77,140,0.08)', border: '1px solid #E2EAF4' }}
            >
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { key: 'full_name', label: 'Full Name', placeholder: 'Jane Smith', required: true },
                  { key: 'business_name', label: 'Business Name', placeholder: 'Lucky Stars Lottery', required: true },
                ].map(({ key, label, placeholder, required }) => (
                  <div key={key} style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={labelStyle}>{label} {required && <span style={{ color: '#EF4444' }}>*</span>}</label>
                    <input
                      required={required}
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={set(key)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
                {[
                  { key: 'phone', label: 'Phone Number', placeholder: '+1 (555) 000-0000', type: 'tel' },
                  { key: 'email', label: 'Email Address', placeholder: 'jane@example.com', type: 'email', required: true },
                ].map(({ key, label, placeholder, type = 'text', required }) => (
                  <div key={key} style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={labelStyle}>{label} {required && <span style={{ color: '#EF4444' }}>*</span>}</label>
                    <input
                      required={required}
                      type={type}
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={set(key)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
                <label style={labelStyle}>Message <span style={{ color: '#EF4444' }}>*</span></label>
                <textarea
                  required
                  rows={5}
                  placeholder="Tell us about your store and what you're looking for..."
                  value={form.message}
                  onChange={set('message')}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {status === 'error' && (
                <p style={{ fontSize: 13, color: '#EF4444', margin: '12px 0 0' }}>{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  marginTop: 24, width: '100%',
                  padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 700, color: '#fff',
                  background: status === 'loading' ? '#9CA3AF' : 'linear-gradient(to right, #0077CC, #2DAE1A)',
                  transition: 'opacity 0.15s',
                }}
              >
                {status === 'loading' ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}

const labelStyle = { fontSize: 13, fontWeight: 600, color: '#0A1128' }
const inputStyle = {
  padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E2EAF4',
  fontSize: 14, color: '#0A1128', outline: 'none', background: '#FAFCFF',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
}
