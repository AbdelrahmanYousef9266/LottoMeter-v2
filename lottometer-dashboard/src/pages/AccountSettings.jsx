import { useEffect, useState } from 'react'
import Input from '../components/UI/Input'
import Badge from '../components/UI/Badge'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import {
  getStoreProfile,
  updateStoreProfile,
  getStoreSettings,
  updateStoreSettings,
  changePassword,
  getSubscription,
  setStorePin,
} from '../api/account'
import { submitComplaint } from '../api/complaints'

const TABS = [
  { id: 'profile',   label: 'Profile & Store',     icon: '🏪' },
  { id: 'settings',  label: 'Hours & Reports',      icon: '⚙️' },
  { id: 'security',  label: 'Security',             icon: '🔒' },
  { id: 'support',   label: 'Contact Support',      icon: '💬' },
  { id: 'subscription', label: 'Subscription',      icon: '💳' },
]

const TIMEZONES = [
  { value: 'America/New_York',    label: 'America/New_York — Eastern' },
  { value: 'America/Chicago',     label: 'America/Chicago — Central' },
  { value: 'America/Denver',      label: 'America/Denver — Mountain' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles — Pacific' },
  { value: 'America/Anchorage',   label: 'America/Anchorage — Alaska' },
  { value: 'Pacific/Honolulu',    label: 'Pacific/Honolulu — Hawaii' },
]

const DELAY_OPTIONS = [
  { value: 0,    label: 'Immediately after close' },
  { value: 0.5,  label: '30 minutes after close' },
  { value: 1,    label: '1 hour after close' },
  { value: 2,    label: '2 hours after close' },
  { value: 3,    label: '3 hours after close' },
  { value: 6,    label: 'Next morning at 6 AM' },
]

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const bg = type === 'success' ? '#16A34A' : '#DC2626'
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: bg, color: '#fff', borderRadius: 8,
      padding: '12px 20px', fontSize: 14, fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{type === 'success' ? '✓' : '✗'}</span>
      {message}
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8, fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  )
}

function SectionCard({ title, subtitle, children, onSave, saving, saveLabel = 'Save Changes' }) {
  return (
    <div className="card" style={{ marginBottom: 20, padding: 0 }}>
      <div style={{ padding: '20px 24px 8px' }}>
        <h2 className="card-title" style={{ marginBottom: subtitle ? 4 : 12 }}>{title}</h2>
        {subtitle && <div className="muted" style={{ marginBottom: 12 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '0 24px 16px' }}>{children}</div>
      {onSave && (
        <div style={{
          padding: '12px 24px',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function FieldRow({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
      {children}
    </div>
  )
}

// ─── Section 1: Profile ───────────────────────────────────────────────────────

function ProfileSection({ showToast }) {
  const [form, setForm] = useState({
    owner_name: '', email: '', phone: '',
    store_name: '', address: '', city: '', state: '', zip_code: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getStoreProfile()
      .then(r => setForm({
        owner_name: r.data.owner_name || '',
        email:      r.data.email      || '',
        phone:      r.data.phone      || '',
        store_name: r.data.store_name || '',
        address:    r.data.address    || '',
        city:       r.data.city       || '',
        state:      r.data.state      || '',
        zip_code:   r.data.zip_code   || '',
      }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(er => ({ ...er, [field]: null }))
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.store_name.trim()) errs.store_name = 'Store name is required.'
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      errs.email = 'Enter a valid email address.'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      await updateStoreProfile(form)
      showToast('Profile saved successfully.', 'success')
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to save profile.'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card"><LoadingSpinner /></div>

  return (
    <SectionCard title="Profile & Store Information" onSave={handleSave} saving={saving}>
      <FieldRow>
        <Input label="Owner Name"   value={form.owner_name} onChange={set('owner_name')} placeholder="Jane Smith" />
        <Input label="Email Address" value={form.email}     onChange={set('email')}      placeholder="owner@store.com" error={errors.email} />
      </FieldRow>
      <FieldRow>
        <Input label="Phone Number" value={form.phone}      onChange={set('phone')}      placeholder="(555) 123-4567" />
        <Input label="Store Name"   value={form.store_name} onChange={set('store_name')} placeholder="My Lotto Store" required error={errors.store_name} />
      </FieldRow>
      <Input label="Address" value={form.address} onChange={set('address')} placeholder="123 Main Street" />
      <FieldRow>
        <Input label="City"     value={form.city}     onChange={set('city')}     placeholder="New York" />
        <Input label="State"    value={form.state}    onChange={set('state')}    placeholder="NY" />
      </FieldRow>
      <Input label="Zip Code" value={form.zip_code} onChange={set('zip_code')} placeholder="10001" />
    </SectionCard>
  )
}

// ─── Section 2: Hours & Report Settings ──────────────────────────────────────

function SettingsSection({ showToast }) {
  const [form, setForm] = useState({
    business_hours_start: '',
    business_hours_end:   '',
    timezone:             'America/New_York',
    report_email:         '',
    report_enabled:       true,
    report_format:        'html',
    report_delay_hours:   1,
  })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    getStoreSettings()
      .then(r => {
        const s = r.data.settings
        setForm({
          business_hours_start: s.business_hours_start || '',
          business_hours_end:   s.business_hours_end   || '',
          timezone:             s.timezone             || 'America/New_York',
          report_email:         s.report_email         || '',
          report_enabled:       s.report_enabled       ?? true,
          report_format:        s.report_format        || 'html',
          report_delay_hours:   s.report_delay_hours   ?? 1,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setVal = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateStoreSettings(form)
      showToast('Settings saved successfully.', 'success')
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to save settings.'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card"><LoadingSpinner /></div>

  return (
    <SectionCard title="Business Hours & Report Settings" onSave={handleSave} saving={saving}>
      {/* Business Hours */}
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Business Hours
      </p>
      <FieldRow>
        <div className="form-group">
          <label className="form-label">Opening Time</label>
          <input type="time" className="input-field" value={form.business_hours_start} onChange={set('business_hours_start')} />
        </div>
        <div className="form-group">
          <label className="form-label">Closing Time</label>
          <input type="time" className="input-field" value={form.business_hours_end} onChange={set('business_hours_end')} />
        </div>
      </FieldRow>

      {/* Timezone */}
      <div className="form-group">
        <label className="form-label">Timezone</label>
        <select className="input-field" value={form.timezone} onChange={set('timezone')}>
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      {/* Divider */}
      <div style={{ margin: '20px 0 16px', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Daily Report Email
        </p>
      </div>

      <Input label="Report Email" value={form.report_email} onChange={set('report_email')} placeholder="owner@store.com" />

      {/* Report Enabled toggle */}
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="form-label" style={{ margin: 0 }}>Send Daily Report</label>
        <button
          type="button"
          onClick={() => setVal('report_enabled', !form.report_enabled)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: form.report_enabled ? '#16A34A' : '#CBD5E1',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3,
            left: form.report_enabled ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {/* Report Format */}
      <div className="form-group">
        <label className="form-label">Report Format</label>
        <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
          {['html', 'pdf'].map(fmt => (
            <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="radio"
                name="report_format"
                value={fmt}
                checked={form.report_format === fmt}
                onChange={() => setVal('report_format', fmt)}
              />
              {fmt.toUpperCase()}
            </label>
          ))}
        </div>
      </div>

      {/* Send Delay */}
      <div className="form-group">
        <label className="form-label">Send Delay</label>
        <select
          className="input-field"
          value={form.report_delay_hours}
          onChange={(e) => setVal('report_delay_hours', parseFloat(e.target.value))}
        >
          {DELAY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Amber note */}
      <div style={{
        background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: 8,
        padding: '10px 14px', marginTop: 8, display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
          Email delivery requires SendGrid integration.
          Configure in server settings when ready.
        </p>
      </div>
    </SectionCard>
  )
}

// ─── Section 3a: Store PIN ────────────────────────────────────────────────────

function StorePinSection({ showToast }) {
  const [form, setForm] = useState({ pin: '', confirm_pin: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm(f => ({ ...f, [field]: val }))
    setErrors(er => ({ ...er, [field]: null }))
  }

  const handleSave = async () => {
    const errs = {}
    if (!/^\d{4,6}$/.test(form.pin))         errs.pin = 'PIN must be 4-6 digits.'
    if (!form.confirm_pin)                    errs.confirm_pin = 'Please confirm your PIN.'
    else if (form.pin !== form.confirm_pin)   errs.confirm_pin = 'PINs do not match.'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      await setStorePin(form)
      showToast('Store PIN updated successfully.', 'success')
      setForm({ pin: '', confirm_pin: '' })
      setErrors({})
    } catch (err) {
      const code = err.response?.data?.error?.code
      const msg  = err.response?.data?.error?.message || 'Failed to update store PIN.'
      if (code === 'PIN_MISMATCH') setErrors({ confirm_pin: 'PINs do not match.' })
      else showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Store PIN" onSave={handleSave} saving={saving} saveLabel="Set Store PIN">
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        Used to authorize sensitive actions in the mobile app (e.g. marking a book as sold).
        Must be 4-6 digits.
      </p>
      <Input
        label="New PIN"
        type="password"
        inputMode="numeric"
        maxLength={6}
        value={form.pin}
        onChange={set('pin')}
        placeholder="e.g. 1234"
        error={errors.pin}
      />
      <Input
        label="Confirm PIN"
        type="password"
        inputMode="numeric"
        maxLength={6}
        value={form.confirm_pin}
        onChange={set('confirm_pin')}
        placeholder="Repeat PIN"
        error={errors.confirm_pin}
      />
    </SectionCard>
  )
}

// ─── Section 3: Security ─────────────────────────────────────────────────────

function SecuritySection({ showToast }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(er => ({ ...er, [field]: null }))
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.current_password) errs.current_password = 'Current password is required.'
    if (!form.new_password) errs.new_password = 'New password is required.'
    else if (form.new_password.length < 8) errs.new_password = 'Must be at least 8 characters.'
    if (!form.confirm_password) errs.confirm_password = 'Please confirm your new password.'
    else if (form.new_password !== form.confirm_password) errs.confirm_password = 'Passwords do not match.'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      await changePassword(form)
      showToast('Password updated successfully.', 'success')
      setForm({ current_password: '', new_password: '', confirm_password: '' })
      setErrors({})
    } catch (err) {
      const code = err.response?.data?.error?.code
      const msg  = err.response?.data?.error?.message || 'Failed to update password.'
      if (code === 'WRONG_PASSWORD')    setErrors({ current_password: 'Current password is incorrect.' })
      else if (code === 'PASSWORD_MISMATCH')  setErrors({ confirm_password: 'Passwords do not match.' })
      else if (code === 'PASSWORD_TOO_SHORT') setErrors({ new_password: 'Must be at least 8 characters.' })
      else showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Change Password" onSave={handleSave} saving={saving} saveLabel="Update Password">
      <Input
        label="Current Password"
        type="password"
        value={form.current_password}
        onChange={set('current_password')}
        autoComplete="current-password"
        error={errors.current_password}
      />
      <Input
        label="New Password"
        type="password"
        value={form.new_password}
        onChange={set('new_password')}
        autoComplete="new-password"
        error={errors.new_password}
      />
      <Input
        label="Confirm New Password"
        type="password"
        value={form.confirm_password}
        onChange={set('confirm_password')}
        autoComplete="new-password"
        error={errors.confirm_password}
      />
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
        Minimum 8 characters.
      </p>
    </SectionCard>
  )
}

// ─── Section 4: Subscription ─────────────────────────────────────────────────

function subStatusVariant(status) {
  if (status === 'active') return 'green'
  if (status === 'trial')  return 'amber'
  return 'red'
}

function SubscriptionSection() {
  const [sub, setSub]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubscription()
      .then(r => setSub(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="card" style={{ marginBottom: 20, padding: 0 }}>
      <div style={{ padding: '20px 24px 8px' }}>
        <h2 className="card-title" style={{ marginBottom: 12 }}>Subscription</h2>
      </div>
      <div style={{ padding: '0 24px 16px' }}>

      {loading ? (
        <LoadingSpinner />
      ) : !sub ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Could not load subscription info.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Plan</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{sub.plan_name || 'Basic'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Status</span>
              <Badge variant={subStatusVariant(sub.status)}>{sub.status || '—'}</Badge>
            </div>
            {sub.trial_ends_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Trial ends</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{new Date(sub.trial_ends_at).toLocaleDateString()}</span>
              </div>
            )}
            {sub.current_period_end && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Next billing</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{new Date(sub.current_period_end).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <a
              href="/pricing"
              className="btn btn-primary"
              style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
            >
              Upgrade Plan
            </a>
            <a
              href="mailto:support@lottometer.com"
              className="btn btn-secondary"
              style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
            >
              Contact Support
            </a>
          </div>
        </>
      )}
      </div>
    </div>
  )
}

// ─── Contact Support Section ──────────────────────────────────────────────────

function ContactSupportSection() {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const canSend = subject.trim().length > 0 && message.trim().length > 0

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await Promise.all([
        submitComplaint({ subject: subject.trim(), message: message.trim() }),
        new Promise(r => setTimeout(r, 900)),
      ])
      setSuccess(true)
      setSubject('')
      setMessage('')
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20, padding: 0 }}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(0,119,204,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--blue,#0077CC)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Contact Support</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Get help via email or Facebook</div>
          </div>
        </div>
        <svg
          viewBox="0 0 24 24" width="16" height="16" fill="none"
          stroke="var(--text-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{ padding: '20px 24px' }}>

          {/* Channel cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>

            {/* Email card */}
            <a
              href="mailto:support@lottometer.com"
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                border: '1.5px solid var(--border)', borderRadius: 10, padding: '16px 18px',
                display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                background: 'var(--bg-primary)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0077CC'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,119,204,0.10)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'rgba(0,119,204,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0077CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Email</div>
                  <div style={{ fontSize: 12, color: '#0077CC', marginTop: 2 }}>support@lottometer.com</div>
                </div>
              </div>
            </a>

            {/* Facebook card */}
            <a
              href="https://www.facebook.com/profile.php?id=61589356135499"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                border: '1.5px solid var(--border)', borderRadius: 10, padding: '16px 18px',
                display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                background: 'var(--bg-primary)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1877F2'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(24,119,242,0.10)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'rgba(24,119,242,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#1877F2">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Facebook</div>
                  <div style={{ fontSize: 12, color: '#1877F2', marginTop: 2 }}>LottoMeter Page</div>
                </div>
              </div>
            </a>

          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Send a message
            </p>
          </div>

          {/* Success banner */}
          {success && (
            <div style={{
              background: 'rgba(45,174,26,0.10)', border: '1px solid rgba(45,174,26,0.35)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1a6e0f', fontWeight: 600,
            }}>
              <span>✓</span> Message sent! We'll respond within 1 business day.
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.30)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#b91c1c', fontWeight: 600,
            }}>
              <span>✗</span> {error}
            </div>
          )}

          {/* Complaint form */}
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input
              className="input-field"
              placeholder="Brief description of your issue"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Describe your issue in detail…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={sending}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSend}
              disabled={!canSend || sending}
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountSettings() {
  const [activeTab, setActiveTab] = useState('profile')
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => setToast({ message, type })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Account Settings</h1>
          <p className="page-header-sub">Manage your store profile, hours, security, and billing.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left tab sidebar */}
        <div className="card" style={{ padding: 8 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14,
                fontWeight: activeTab === tab.id ? 700 : 400,
                background: activeTab === tab.id ? 'var(--primary-light, #EFF6FF)' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary, #0077CC)' : 'var(--text-primary)',
                transition: 'background 0.15s',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right content */}
        <div>
          {activeTab === 'profile'      && <ProfileSection      showToast={showToast} />}
          {activeTab === 'settings'     && <SettingsSection     showToast={showToast} />}
          {activeTab === 'security'     && (
            <>
              <SecuritySection showToast={showToast} />
              <StorePinSection showToast={showToast} />
            </>
          )}
          {activeTab === 'support'      && <ContactSupportSection />}
          {activeTab === 'subscription' && <SubscriptionSection />}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
