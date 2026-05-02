import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function SuperAdminLogin() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await login({ store_code: import.meta.env.VITE_SUPERADMIN_STORE_CODE, username: form.username, password: form.password })
      if (data?.user?.role === 'superadmin') {
        navigate('/superadmin/dashboard')
      } else {
        logout()
        setError('Unauthorized access. This portal is for LottoMeter staff only.')
      }
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Invalid credentials.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: 16,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 40 }}>
        {/* Icon + title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
          }}>
            🔐
          </div>
          <h1 style={{
            fontSize: 22, fontWeight: 800, margin: '0 0 6px',
            background: 'linear-gradient(to right, #5B21B6, #7C3AED)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            LottoMeter Staff Portal
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            Internal access only
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
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
              autoFocus
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
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
              color: 'var(--red)', marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-lg"
            disabled={loading}
            style={{
              width: '100%', marginTop: 4, border: 'none',
              background: loading ? '#9CA3AF' : 'linear-gradient(to right, #5B21B6, #7C3AED)',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <><div className="loading-spinner sm" style={{ borderTopColor: '#fff' }} /> Signing in...</>
            ) : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
          >
            ← Back to website
          </Link>
        </div>
      </div>
    </div>
  )
}
