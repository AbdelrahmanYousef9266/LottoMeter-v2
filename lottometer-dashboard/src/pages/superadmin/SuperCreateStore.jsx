import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSuperStore } from '../../api/superadmin'

const PURPLE = '#7C3AED'

function slugify(name) {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

const inputStyle = (hasError) => hasError ? { borderColor: 'var(--red)' } : {}

export default function SuperCreateStore() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    store_name: '', store_code: '', admin_username: '', admin_password: '', confirm_password: '',
    owner_name: '', email: '', phone: '', address: '', city: '', state: '', zip_code: '', notes: '',
    _code_edited: false,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const set = (k) => (e) => {
    const val = e.target.value
    setForm((p) => {
      const next = { ...p, [k]: val }
      if (k === 'store_name' && !p._code_edited) next.store_code = slugify(val)
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
    if (!form.store_name.trim())      errs.store_name = 'Store name is required.'
    if (!form.store_code.trim())      errs.store_code = 'Store code is required.'
    if (!form.admin_username.trim())  errs.admin_username = 'Admin username is required.'
    if (!form.admin_password)         errs.admin_password = 'Password is required.'
    else if (form.admin_password.length < 8) errs.admin_password = 'Password must be at least 8 characters.'
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
      const payload = {
        store_name:     form.store_name.trim(),
        store_code:     form.store_code.trim(),
        admin_username: form.admin_username.trim(),
        admin_password: form.admin_password,
      }
      if (form.owner_name.trim()) payload.owner_name = form.owner_name.trim()
      if (form.email.trim())      payload.email      = form.email.trim()
      if (form.phone.trim())      payload.phone      = form.phone.trim()
      if (form.address.trim())    payload.address    = form.address.trim()
      if (form.city.trim())       payload.city       = form.city.trim()
      if (form.state.trim())      payload.state      = form.state.trim()
      if (form.zip_code.trim())   payload.zip_code   = form.zip_code.trim()
      if (form.notes.trim())      payload.notes      = form.notes.trim()

      const res = await createSuperStore(payload)
      navigate('/superadmin/stores', { state: { created: res.data.store.store_name } })
    } catch (err) {
      setSubmitError(err?.response?.data?.error?.message || 'Failed to create store.')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ k, label, placeholder, type = 'text', onChange, hint, required = false }) => (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--red)' }}> *</span>}
      </label>
      <input
        className="input-field"
        type={type}
        placeholder={placeholder}
        value={form[k]}
        onChange={onChange || set(k)}
        style={inputStyle(errors[k])}
      />
      {hint && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{hint}</div>}
      {errors[k] && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors[k]}</div>}
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>➕ Create New Store</h1>
          <p className="page-header-sub">Set up a new customer store and their admin account</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, borderTop: `3px solid ${PURPLE}` }}>
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Required fields ── */}
          <Field k="store_name"     label="Store Name"     placeholder="Lucky Stars Lottery"       required />
          <Field k="store_code"     label="Store Code"     placeholder="LUCKY1 (auto-suggested)"
            onChange={setCode}
            hint="Uppercase letters and numbers only. Employees use this to log in."
            required
          />
          <Field k="admin_username" label="Admin Username" placeholder="admin"                     required />
          <Field k="admin_password" label="Admin Password" placeholder="Temporary password" type="password" required />
          <Field k="confirm_password" label="Confirm Password" placeholder="Repeat password" type="password" required />

          {/* ── Optional store information ── */}
          <div style={{ margin: '24px 0 16px', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Store Information <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </div>
            <Field k="owner_name" label="Owner Name"   placeholder="Jane Smith" />
            <Field k="email"      label="Store Email"  placeholder="jane@example.com" type="email" />
            <Field k="phone"      label="Phone"        placeholder="+1 (555) 000-0000" />
            <Field k="address"    label="Street Address" placeholder="123 Main St" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field k="city"     label="City"      placeholder="New York" />
              <Field k="state"    label="State"     placeholder="NY" />
            </div>
            <div style={{ maxWidth: 160 }}>
              <Field k="zip_code" label="Zip Code"  placeholder="10001" />
            </div>
            <div className="form-group">
              <label className="form-label">Internal Notes</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Notes visible only to LottoMeter staff..."
                value={form.notes}
                onChange={set('notes')}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>
          </div>

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
              {loading ? 'Creating…' : 'Create Store'}
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
