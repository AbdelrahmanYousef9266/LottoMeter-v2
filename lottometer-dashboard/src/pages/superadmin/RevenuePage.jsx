import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { getRevenueOverview, extendStoreTrial } from '../../api/superadmin'
import { formatCurrency } from '../../utils/currency'

const PURPLE   = '#7C3AED'
const GREEN    = '#16A34A'
const AMBER    = '#F59E0B'
const RED      = '#EF4444'
const BLUE     = '#0077CC'

// ─── Small helpers ────────────────────────────────────────────────────────────

function relDays(isoStr) {
  const diff = Math.ceil((new Date(isoStr) - Date.now()) / 86_400_000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `${diff}d`
}

function fmtMonth(yyyymm) {
  const [y, m] = yyyymm.split('-')
  return new Date(+y, +m - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="card" style={{ flex: '1 1 180px', borderTop: `3px solid ${accent || PURPLE}` }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─── Status breakdown bar ─────────────────────────────────────────────────────

const STATUS_COLORS = {
  active:    GREEN,
  trial:     BLUE,
  expired:   '#9CA3AF',
  suspended: AMBER,
  cancelled: RED,
}

function StatusBar({ subs }) {
  const total = subs.total || 1
  const segments = ['active', 'trial', 'suspended', 'expired', 'cancelled']
  return (
    <div className="card">
      <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>Subscription Status</h3>
      <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
        {segments.map(s => {
          const count = subs[s] || 0
          const pct   = (count / total) * 100
          if (!count) return null
          return (
            <div
              key={s}
              title={`${s}: ${count}`}
              style={{ background: STATUS_COLORS[s], width: `${pct}%`, transition: 'width 0.4s' }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 12 }}>
        {segments.map(s => {
          const count = subs[s] || 0
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[s], display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{s}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Extend trial modal ───────────────────────────────────────────────────────

const DAYS_OPTIONS = [7, 14, 30]

function ExtendModal({ store, onClose, onSuccess }) {
  const [days, setDays]     = useState(14)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleExtend = async () => {
    setLoading(true)
    setError('')
    try {
      await extendStoreTrial(store.store_id, { days })
      onSuccess(store.store_id)
    } catch (e) {
      setError(e.response?.data?.error || 'Extension failed.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="card" style={{ width: 380, maxWidth: '95vw' }}>
        <h3 style={{ marginBottom: 4 }}>Extend Trial</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          <strong>{store.store_name}</strong> ({store.store_code}) — currently expires{' '}
          <strong>{relDays(store.trial_ends_at)}</strong>.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              className={`btn ${days === d ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setDays(d)}
            >
              +{d}d
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleExtend} disabled={loading}>
            {loading ? 'Extending…' : `Extend +${days} days`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Custom tooltip for the MRR chart ─────────────────────────────────────────

function MrrTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 14px', fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ color: PURPLE }}>{formatCurrency(payload[0].value)}</div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const navigate                    = useNavigate()
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [extendTarget, setExtendTarget] = useState(null)
  const timerRef                    = useRef(null)

  const load = useCallback(async () => {
    try {
      const r = await getRevenueOverview()
      setData(r.data)
      setError('')
    } catch {
      setError('Failed to load revenue data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const tick = () => { if (!document.hidden) load() }
    timerRef.current = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  const handleExtendSuccess = (storeId) => {
    setExtendTarget(null)
    // Remove the extended store from the 7-day list optimistically
    setData(prev => prev ? {
      ...prev,
      trials: {
        ...prev.trials,
        expiring_within_7_days: prev.trials.expiring_within_7_days.filter(t => t.store_id !== storeId),
      },
    } : prev)
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const mrr   = data?.mrr   || {}
  const subs  = data?.subscriptions || {}
  const trials = data?.trials || {}
  const churn = data?.churn  || {}
  const hist  = (data?.mrr_history || []).map(h => ({ ...h, label: fmtMonth(h.month) }))

  const growthSign   = mrr.growth_pct > 0 ? '▲' : mrr.growth_pct < 0 ? '▼' : ''
  const growthColor  = mrr.growth_pct > 0 ? GREEN : mrr.growth_pct < 0 ? RED : 'var(--text-secondary)'
  const growthText   = mrr.growth_pct != null
    ? `${growthSign} ${Math.abs(mrr.growth_pct)}% vs last month`
    : 'No prior month data'

  const newSignupsThisMonth = (data?.recent_signups || []).filter(s => {
    const d = new Date(s.created_at)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Loading…</div>
  }
  if (error) {
    return (
      <div style={{ padding: 40, color: RED }}>
        {error}{' '}
        <button className="btn btn-secondary btn-sm" onClick={load}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ color: PURPLE }}>💰 Revenue & Subscriptions</h1>
          <p className="page-header-sub">MRR, subscription health, and trial pipeline</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <StatCard
          icon="💵"
          label="Monthly Recurring Revenue"
          value={formatCurrency(mrr.current)}
          sub={<span style={{ color: growthColor }}>{growthText}</span>}
          accent={PURPLE}
        />
        <StatCard
          icon="✅"
          label="Active Subscriptions"
          value={subs.active ?? '—'}
          sub={`${subs.total ?? 0} total`}
          accent={GREEN}
        />
        <StatCard
          icon="⏳"
          label="Active Trials"
          value={subs.trial ?? '—'}
          sub={`${trials.expiring_within_7_days?.length ?? 0} expiring this week`}
          accent={BLUE}
        />
        <StatCard
          icon="🆕"
          label="New Signups"
          value={newSignupsThisMonth}
          sub="this calendar month"
          accent={AMBER}
        />
      </div>

      {/* MRR trend chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>MRR — Last 12 Months</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={hist} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PURPLE} stopOpacity={0.25} />
                <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip content={<MrrTooltip />} />
            <Area
              type="monotone"
              dataKey="mrr"
              stroke={PURPLE}
              strokeWidth={2}
              fill="url(#mrrGrad)"
              dot={false}
              activeDot={{ r: 4, fill: PURPLE }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
          Approximated from subscription created_at / cancelled_at — not from period-by-period snapshots.
        </p>
      </div>

      {/* Status breakdown */}
      <div style={{ marginBottom: 24 }}>
        <StatusBar subs={subs} />
      </div>

      {/* Two-column row: trials + churn */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {/* Trials expiring within 7 days */}
        <div className="card" style={{ flex: '2 1 400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>
              Trials Expiring Soon
              {trials.expiring_within_7_days?.length > 0 && (
                <span style={{
                  marginLeft: 8, background: RED, color: '#fff',
                  borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '1px 8px',
                }}>
                  {trials.expiring_within_7_days.length}
                </span>
              )}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {trials.expiring_within_30_days_count} in 30 days
            </span>
          </div>

          {trials.expiring_within_7_days?.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No trials expiring this week.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Store</th>
                  <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Expires</th>
                  <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 600 }}>Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trials.expiring_within_7_days.map(t => (
                  <tr key={t.store_id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 0' }}>
                      <span
                        style={{ fontWeight: 600, cursor: 'pointer', color: PURPLE }}
                        onClick={() => navigate(`/superadmin/stores/${t.store_id}`)}
                      >
                        {t.store_code}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 12 }}>{t.store_name}</span>
                    </td>
                    <td style={{ padding: '8px 12px 8px 0', color: RED, fontWeight: 600 }}>
                      {relDays(t.trial_ends_at)}
                    </td>
                    <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>
                      {t.plan_price ? formatCurrency(t.plan_price) : '—'}
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExtendTarget(t)}
                      >
                        Extend
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Churn card */}
        <div className="card" style={{ flex: '1 1 220px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Churn</h3>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{churn.this_month_count ?? 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>This month</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-secondary)' }}>{churn.last_month_count ?? 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last month</div>
            </div>
          </div>

          {churn.reasons?.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reasons (last 2 months)
              </div>
              {churn.reasons.map(r => (
                <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{r.reason}</span>
                  <span style={{ fontWeight: 700 }}>{r.count}</span>
                </div>
              ))}
            </>
          )}
          {(!churn.reasons || churn.reasons.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No cancellations recorded.</p>
          )}
        </div>
      </div>

      {/* Recent signups table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Recent Signups</h3>
        {data?.recent_signups?.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No signups found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Store</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Plan</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 600 }}>Price/mo</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 600 }}>Signed up</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_signups.map(s => (
                <tr key={s.store_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0' }}>
                    <span
                      style={{ fontWeight: 600, cursor: 'pointer', color: PURPLE }}
                      onClick={() => navigate(`/superadmin/stores/${s.store_id}`)}
                    >
                      {s.store_code}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 12 }}>{s.store_name}</span>
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', textTransform: 'capitalize' }}>{s.plan}</td>
                  <td style={{ padding: '8px 12px 8px 0' }}>
                    <span style={{
                      background: STATUS_COLORS[s.status] + '22',
                      color: STATUS_COLORS[s.status],
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      textTransform: 'capitalize',
                    }}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>
                    {s.plan_price ? formatCurrency(s.plan_price) : '—'}
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Extend modal */}
      {extendTarget && (
        <ExtendModal
          store={extendTarget}
          onClose={() => setExtendTarget(null)}
          onSuccess={handleExtendSuccess}
        />
      )}
    </div>
  )
}
