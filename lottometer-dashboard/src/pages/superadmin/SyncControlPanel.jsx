import { useState, useEffect, useCallback } from 'react'
import { getSyncOverview, getStoreSyncLog, getSyncFailures, forceResync, discardSyncEvent } from '../../api/sync'

const PURPLE = '#7C3AED'
const PURPLE_LIGHT = 'rgba(124,58,237,0.12)'

const TABS = ['Overview', 'Failures', 'Store Log']

function relativeTime(isoString) {
  if (!isoString) return '—'
  const diff = Date.now() - new Date(isoString).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [forcing, setForcing]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getSyncOverview()
      .then(r => setRows(r.data.stores))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleForce = async (storeId) => {
    setForcing(storeId)
    try {
      await forceResync(storeId)
      setRows(prev => prev.map(r => r.store_id === storeId ? { ...r, force_full_resync: true } : r))
    } catch {
      // no-op
    } finally {
      setForcing(null)
    }
  }

  if (loading) return (
    <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Loading sync overview…
    </div>
  )

  if (rows.length === 0) return (
    <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      No sync activity in the last 7 days.
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
            {['Store', 'Last event', '7d events', '7d errors', 'Resync flag', ''].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12,
                color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.store_id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                  background: PURPLE_LIGHT, color: PURPLE, padding: '2px 8px', borderRadius: 6, marginRight: 8,
                }}>{r.store_code}</span>
                {r.store_name}
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                {relativeTime(r.last_event_at)}
              </td>
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.total_events}</td>
              <td style={{ padding: '12px 16px' }}>
                {r.error_events > 0 ? (
                  <span style={{
                    background: '#FEE2E2', color: '#B91C1C',
                    borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: 12,
                  }}>{r.error_events}</span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>0</span>
                )}
              </td>
              <td style={{ padding: '12px 16px' }}>
                {r.force_full_resync ? (
                  <span style={{
                    background: '#FEF3C7', color: '#92400E',
                    borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: 12,
                  }}>Pending</span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                )}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleForce(r.store_id)}
                  disabled={forcing === r.store_id || r.force_full_resync}
                  title="Ask the mobile app to wipe and re-seed its local database"
                >
                  {forcing === r.store_id ? 'Sending…' : 'Force resync'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Failures tab ─────────────────────────────────────────────────────────────

function FailuresTab() {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [discarding, setDiscarding] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getSyncFailures()
      .then(r => setItems(r.data.failures))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDiscard = async (eventId) => {
    setDiscarding(eventId)
    try {
      await discardSyncEvent(eventId)
      setItems(prev => prev.filter(i => i.id !== eventId))
    } catch {
      // no-op
    } finally {
      setDiscarding(null)
    }
  }

  if (loading) return (
    <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Loading failures…
    </div>
  )

  if (items.length === 0) return (
    <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: '#15803D' }}>
      No active sync failures.
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
            {['Store', 'Operation', 'Error code', 'When', ''].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12,
                color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                  background: PURPLE_LIGHT, color: PURPLE, padding: '2px 8px', borderRadius: 6, marginRight: 8,
                }}>{item.store_code}</span>
                {item.store_name}
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                {item.operation}
              </td>
              <td style={{ padding: '12px 16px' }}>
                {item.error_code ? (
                  <span style={{
                    background: '#FEE2E2', color: '#B91C1C',
                    borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: 12, fontFamily: 'monospace',
                  }}>{item.error_code}</span>
                ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                {relativeTime(item.created_at)}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDiscard(item.id)}
                  disabled={discarding === item.id}
                  title="Remove from failures view"
                >
                  {discarding === item.id ? 'Discarding…' : 'Discard'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Store Log tab ────────────────────────────────────────────────────────────

function StoreLogTab({ stores }) {
  const [storeId, setStoreId]   = useState('')
  const [events, setEvents]     = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)

  const perPage = 50

  const load = useCallback((sid, pg) => {
    if (!sid) return
    setLoading(true)
    getStoreSyncLog(sid, { page: pg, per_page: perPage })
      .then(r => { setEvents(r.data.events); setTotal(r.data.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleStoreChange = (e) => {
    setStoreId(e.target.value)
    setPage(1)
    load(e.target.value, 1)
  }

  const handlePage = (pg) => { setPage(pg); load(storeId, pg) }

  const totalPages = Math.ceil(total / perPage)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <select
          className="input-field"
          value={storeId}
          onChange={handleStoreChange}
          style={{ maxWidth: 320 }}
        >
          <option value="">Select a store…</option>
          {stores.map(s => (
            <option key={s.store_id} value={s.store_id}>
              {s.store_code} — {s.store_name}
            </option>
          ))}
        </select>
      </div>

      {!storeId ? null : loading ? (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading log…
        </div>
      ) : events.length === 0 ? (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No events for this store.
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                  {['Operation', 'Status', 'Error', 'When'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12,
                      color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                      {e.operation}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: e.status === 'ok' ? '#DCFCE7' : '#FEE2E2',
                        color: e.status === 'ok' ? '#15803D' : '#B91C1C',
                        borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 11,
                      }}>{e.status}</span>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#B91C1C' }}>
                      {e.error_code || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {relativeTime(e.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => handlePage(page - 1)}
              >Prev</button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages} ({total} events)
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => handlePage(page + 1)}
              >Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SyncControlPanel() {
  const [tab, setTab]           = useState('Overview')
  const [overview, setOverview] = useState([])
  const [failures, setFailures] = useState([])

  useEffect(() => {
    getSyncOverview().then(r => setOverview(r.data.stores)).catch(() => {})
    getSyncFailures().then(r => setFailures(r.data.failures)).catch(() => {})
  }, [])

  const failureCount = failures.length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sync Health</h1>
          <p className="page-header-sub">Monitor mobile sync activity and resolve failures</p>
        </div>
        {failureCount > 0 && (
          <span style={{
            background: '#EF4444', color: '#fff',
            borderRadius: 999, fontSize: 13, fontWeight: 800,
            padding: '4px 12px',
          }}>{failureCount} failure{failureCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: tab === t ? PURPLE : 'var(--bg-primary)',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {t}
            {t === 'Failures' && failureCount > 0 && (
              <span style={{
                marginLeft: 6, background: 'rgba(239,68,68,0.18)', color: '#c02020',
                borderRadius: 999, padding: '1px 6px', fontSize: 11, fontWeight: 700,
              }}>{failureCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab />}
      {tab === 'Failures' && <FailuresTab />}
      {tab === 'Store Log' && <StoreLogTab stores={overview} />}
    </div>
  )
}
