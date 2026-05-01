import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSuperStore } from '../../api/superadmin'

const PURPLE = '#7C3AED'

function slugify(name) {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

export default function SuperCreateStore() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    store_name: '', store_code: '', admin_username: '', admin_password: '', confirm_password: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const set = (k) => (e) => {
    const val = e.target.value
    setForm((p) => {
      const next = { ...p, [k]: val }
      if (k === 'store_name' && !p._code_edited) {
        next.store_code = slugify(val)
      }
      return next
    })
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }))
  }

  const setCode = (e) => {
    setForm((p) => ({ ...p, store_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''), _code_edited: true }))
    if (errors.store_code) setErrors((p) => ({ ...p, store_code: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.store_name.trim()) errs.store_name = 'Store name is required.'
    if (!form.store_code.trim()) errs.store_code = 'Store code is required.'
    if (!form.admin_username.trim()) errs.admin_username = 'Admin username is required.'
    if (!form.admin_password) errs.admin_password = 'Password is required.'
    else if (form.admin_password.length < 6) errs.admin_password = 'Password must be at least 6 characters.'
    if (form.admin_password !== form.confirm_password) errs.confirm_password = 'Passwords do not match.'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true)
    setSubmitError('')
    try {
      const res = await createSuperStore({
        store_name: form.store_name.trim(),
        store_code: form.store_code.trim(),
        admin_username: form.admin_username.trim(),
        admin_password: form.admin_password,
      })
      navigate('/superadmin/stores', {
        state: { created: res.data.store.store_name },
      })
    } catch (err) {
      setSubmitError(err?.response?.data?.error?.message || 'Failed to create store.')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key: 'store_name', label: 'Store Name', placeholder: 'Lucky Stars Lottery', onChange: set('store_name') },
    { key: 'store_code', label: 'Store Code', placeholder: 'LUCKY1 (auto-suggested)', onChange: setCode,
      hint: 'Uppercase letters and numbers only. Employees use this to log in.' },
    { key: 'admin_username', label: 'Admin Username', placeholder: 'admin', onChange: set('admin_username') },
    { key: 'admin_password', label: 'Admin Password', placeholder: 'Temporary password', type: 'password', onChange: set('admin_password') },
    { key: 'confirm_password', label: 'Confirm Password', placeholder: 'Repeat password', type: 'password', onChange: set('confirm_password') },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>➕ Create New Store</h1>
          <p className="page-header-sub">Set up a new customer store and their admin account</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520, borderTop: `3px solid ${PURPLE}` }}>
        <form onSubmit={handleSubmit} noValidate>
          {fields.map(({ key, label, placeholder, type = 'text', onChange, hint }) => (
            <div key={key} className="form-group">
              <label className="form-label">{label} <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                className="input-field"
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={onChange}
                style={errors[key] ? { borderColor: 'var(--red)' } : {}}
              />
              {hint && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{hint}</div>}
              {errors[key] && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors[key]}</div>}
            </div>
          ))}

          {submitError && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ flex: 1, background: loading ? undefined : `linear-gradient(to right, ${PURPLE}, #9F67F5)` }}
            >
              {loading ? 'Creating...' : 'Create Store'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/superadmin/stores')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
