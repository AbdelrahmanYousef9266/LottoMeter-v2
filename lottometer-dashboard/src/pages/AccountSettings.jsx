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
} from '../api/account'

const TABS = [
  { id: 'profile',   label: 'Profile & Store',     icon: '🏪' },
  { id: 'settings',  label: 'Hours & Reports',      icon: '⚙️' },
  { id: 'security',  label: 'Security',             icon: '🔒' },
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

function SectionCard({ title, children, onSave, saving, saveLabel = 'Save Changes' }) {
  return (
    <div className="card">
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>{title}</h2>
      {children}
      {onSave && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
    <div className="card">
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Subscription</h2>

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
          {activeTab === 'security'     && <SecuritySection     showToast={showToast} />}
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
