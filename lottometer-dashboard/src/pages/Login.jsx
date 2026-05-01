import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TAGLINES = [
  'Track lottery shifts in seconds',
  'Scan books faster with zero errors',
  'Simplify daily store operations',
]

export default function Login() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()

  const [taglineIndex, setTaglineIndex] = useState(0)
  const [taglineVisible, setTaglineVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineVisible(false)
      setTimeout(() => {
        setTaglineIndex((i) => (i + 1) % TAGLINES.length)
        setTaglineVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  const [form, setForm] = useState({ store_code: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.store_code || !form.username || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await login(form)
      const role = data?.user?.role
      if (role === 'superadmin') {
        navigate('/superadmin/dashboard')
      } else if (role === 'admin') {
        navigate('/dashboard')
      } else {
        logout()
        setError('Employees cannot access the web dashboard. Please use the mobile app.')
      }
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Invalid credentials. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 40,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <img
              src="/app-icon.png"
              alt="LottoMeter"
              style={{
                width: 88,
                height: 88,
                borderRadius: 22,
                boxShadow: '0 8px 24px rgba(0, 119, 204, 0.18)',
              }}
            />
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              background: 'var(--gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px',
              margin: 0,
            }}
          >
            LottoMeter
          </h1>

          {/* Subtitle row with decorative lines */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '8px 0 14px' }}>
            <div style={{ height: 1, width: 28, background: 'var(--border)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
              Digital Shift Tracking
            </span>
            <div style={{ height: 1, width: 28, background: 'var(--border)' }} />
          </div>

          {/* Animated tagline pill */}
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, rgba(0,119,204,0.08), rgba(45,174,26,0.08))',
                border: '1px solid rgba(0,119,204,0.15)',
                borderRadius: 999,
                padding: '5px 14px',
                transition: 'opacity 300ms ease, transform 300ms ease',
                opacity: taglineVisible ? 1 : 0,
                transform: taglineVisible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.97)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gradient)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0077CC', whiteSpace: 'nowrap' }}>
                {TAGLINES[taglineIndex]}
              </span>
            </div>
          </div>

          {/* Indicator dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
            {TAGLINES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === taglineIndex ? 16 : 5,
                  height: 5,
                  borderRadius: 999,
                  background: i === taglineIndex ? 'var(--blue)' : 'var(--border)',
                  transition: 'width 300ms ease, background 300ms ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="store_code">
              Store Code <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              id="store_code"
              name="store_code"
              type="text"
              className="input-field"
              placeholder="Enter store code"
              value={form.store_code}
              onChange={handleChange}
              autoComplete="organization"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="input-field"
              placeholder="Enter username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="input-field"
              placeholder="Enter password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--red)',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: 4 }}
          >
            {loading ? (
              <>
                <div className="loading-spinner sm" style={{ borderTopColor: '#fff' }} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginTop: 24,
          }}
        >
          LottoMeter &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
