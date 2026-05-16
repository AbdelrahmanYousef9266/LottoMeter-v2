import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { getStoreHealth, suspendStore, activateStore } from '../../api/superadmin'
import Badge from '../../components/UI/Badge'
import Button from '../../components/UI/Button'

const PURPLE = '#7C3AED'

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
}

const SYNC_VARIANT = { ok: 'green', stale: 'amber', errors: 'red', no_data: 'gray' }
const SHIFT_VARIANT = { correct: 'green', over: 'amber', short: 'red' }
const SUB_VARIANT   = { trial: 'amber', active: 'green', expired: 'red', suspended: 'red', cancelled: 'gray' }

function StatCard({ label, value, variant, sub }) {
  const colors = {
    green: '#16A34A', amber: '#D97706', red: '#DC2626', gray: 'var(--text-secondary)',
    purple: PURPLE, default: 'var(--text-primary)',
  }
  return (
    <div className="card" style={{ flex: 1, minWidth: 140 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: colors[variant] || colors.default, marginBottom: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  )
}

function SectionCard({ title, children, style }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14,
          textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function StoreHealthPage() {
  const { storeId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    getStoreHealth(storeId)
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load store health data.'))
      .finally(() => setLoading(false))
  }, [storeId])

  useEffect(() => { load() }, [load])

  const handleSuspendToggle = async () => {
    if (!data?.store) return
    setActionLoading(true)
    try {
      if (data.store.suspended) await activateStore(data.store.store_id)
      else await suspendStore(data.store.store_id)
      load()
    } catch {}
    finally { setActionLoading(false) }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300,
        color: 'var(--text-secondary)', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: 32 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/superadmin/stores')} style={{ marginBottom: 20 }}>
          ← Back to Stores
        </button>
        <p style={{ color: 'var(--red)' }}>{error || 'Store not found.'}</p>
      </div>
    )
  }

  const { store, subscription, sync_health, complaints_open, active_shift, recent_shifts, variance_trend, recent_audit } = data

  // ── stat card values ───────────────────────────────────────────────────
  const syncVariant = SYNC_VARIANT[sync_health.status] || 'gray'
  const syncLabel   = sync_health.status === 'no_data' ? 'No Data'
    : sync_health.status === 'errors' ? `${sync_health.failed_count} Failed`
    : sync_health.status === 'stale'  ? 'Stale'
    : 'OK'

  const subVariant = subscription ? (SUB_VARIANT[subscription.status] || 'gray') : 'gray'
  const subLabel   = subscription
    ? `${subscription.plan} / ${subscription.status}`
    : 'No subscription'

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/superadmin/stores')}
        >
          ← Stores
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{store.store_name}</h1>
            <code style={{ fontSize: 12, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4 }}>
              {store.store_code}
            </code>
            <Badge variant={store.is_active !== false ? 'green' : 'red'}>
              {store.is_active !== false ? 'Active' : 'Inactive'}
            </Badge>
            {store.suspended && <Badge variant="red">Suspended</Badge>}
            {active_shift && <Badge variant="amber">Shift Open</Badge>}
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ color: store.suspended ? '#2DAE1A' : 'var(--red)', borderColor: store.suspended ? '#2DAE1A' : 'var(--red)' }}
          onClick={handleSuspendToggle}
          disabled={actionLoading}
        >
          {store.suspended ? 'Activate' : 'Suspend'}
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Shifts"
          value={store.shift_count ?? 0}
          variant="purple"
        />
        <StatCard
          label="Open Complaints"
          value={complaints_open}
          variant={complaints_open > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Sync Health"
          value={syncLabel}
          variant={syncVariant}
          sub={sync_health.last_event_at ? `Last: ${fmtDate(sync_health.last_event_at)}` : undefined}
        />
        <StatCard
          label="Subscription"
          value={subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : '—'}
          variant={subVariant}
          sub={subscription?.status || undefined}
        />
      </div>

      {/* ── Activity Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 14, marginBottom: 24 }}>

        {/* Recent Shifts */}
        <SectionCard title="Recent Shifts">
          {recent_shifts.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
              No shifts yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent_shifts.map((sh) => (
                <div key={sh.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', fontSize: 12,
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>#{sh.shift_number} — {sh.employee_name}</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{fmtDate(sh.opened_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {sh.voided && <Badge variant="gray">Voided</Badge>}
                    {sh.shift_status && !sh.voided && (
                      <Badge variant={SHIFT_VARIANT[sh.shift_status] || 'gray'}>{sh.shift_status}</Badge>
                    )}
                    {sh.status === 'open' && !sh.shift_status && <Badge variant="amber">Open</Badge>}
                    {sh.difference != null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: sh.difference > 0 ? '#16A34A' : sh.difference < 0 ? '#DC2626' : 'var(--text-secondary)',
                      }}>
                        {sh.difference >= 0 ? '+' : ''}{sh.difference.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Variance Trend */}
        <SectionCard title="Variance Trend (last 30 shifts)">
          {variance_trend.length < 2 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '60px 0' }}>
              Not enough closed shifts to display
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={variance_trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="shift_number" tick={{ fontSize: 10 }} label={{ value: 'Shift #', position: 'insideBottom', offset: -2, fontSize: 10 }} height={30} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Difference']}
                  labelFormatter={(label) => `Shift #${label}`}
                />
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="difference"
                  stroke={PURPLE}
                  strokeWidth={2}
                  dot={{ r: 3, fill: PURPLE }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Audit Log */}
        <SectionCard title="Recent Activity">
          {recent_audit.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
              No activity recorded
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {recent_audit.map((l) => (
                <div key={l.id} style={{ fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.action}</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 1 }}>
                    {l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ''} · {fmtDate(l.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Bottom Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Store Details */}
        <SectionCard title="Store Details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 16 }}>
            {[
              { label: 'Owner', value: store.owner_name },
              { label: 'Email', value: store.email },
              { label: 'Phone', value: store.phone },
              { label: 'Address', value: store.address },
              { label: 'City', value: store.city },
              { label: 'State', value: store.state },
              { label: 'Zip', value: store.zip_code },
              { label: 'Books', value: store.book_count },
              { label: 'PIN Set', value: store.store_pin_set ? 'Yes' : 'No' },
              { label: 'Created', value: fmtDateShort(store.created_at) },
            ].filter(({ value }) => value !== undefined && value !== null && value !== '').map(({ label, value }) => (
              <div key={label}>
                <div style={labelStyle}>{label}</div>
                <div style={{ fontSize: 13 }}>{value}</div>
              </div>
            ))}
          </div>

          {store.notes && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Notes: </span>{store.notes}
            </div>
          )}

          {store.users?.length > 0 && (
            <>
              <div style={{ ...labelStyle, marginTop: 8 }}>Users ({store.users.length})</div>
              <table className="table" style={{ marginTop: 6 }}>
                <thead>
                  <tr><th>Username</th><th>Role</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {store.users.map((u) => (
                    <tr key={u.user_id}>
                      <td>{u.username}</td>
                      <td><Badge variant={u.role === 'admin' ? 'amber' : 'gray'}>{u.role}</Badge></td>
                      <td><Badge variant={u.deleted_at ? 'red' : 'green'}>{u.deleted_at ? 'Deleted' : 'Active'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </SectionCard>

        {/* Subscription Details */}
        <SectionCard title="Subscription">
          {!subscription ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '20px 0' }}>No subscription found.</div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                  <div style={labelStyle}>Status</div>
                  <Badge variant={SUB_VARIANT[subscription.status] || 'gray'}>{subscription.status}</Badge>
                </div>
                <div>
                  <div style={labelStyle}>Plan</div>
                  <div style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{subscription.plan}</div>
                </div>
                {subscription.plan_price != null && (
                  <div>
                    <div style={labelStyle}>Price</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>${subscription.plan_price}/mo</div>
                  </div>
                )}
                {subscription.cancel_at_period_end && (
                  <div>
                    <div style={labelStyle}>Cancels</div>
                    <Badge variant="amber">End of Period</Badge>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                {[
                  { label: 'Trial Ends', value: subscription.trial_ends_at ? fmtDateShort(subscription.trial_ends_at) : null },
                  { label: 'Period End', value: subscription.current_period_end ? fmtDateShort(subscription.current_period_end) : null },
                  { label: 'Billing Email', value: subscription.billing_email },
                  { label: 'Card', value: subscription.card_brand ? `${subscription.card_brand} •••• ${subscription.card_last4}` : null },
                  { label: 'Cancelled At', value: subscription.cancelled_at ? fmtDateShort(subscription.cancelled_at) : null },
                  { label: 'Started', value: fmtDateShort(subscription.created_at) },
                ].filter(({ value }) => value).map(({ label, value }) => (
                  <div key={label}>
                    <div style={labelStyle}>{label}</div>
                    <div style={{ fontSize: 13 }}>{value}</div>
                  </div>
                ))}
              </div>

              {subscription.cancelled_reason && (
                <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>Cancel reason: </span>{subscription.cancelled_reason}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
