import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSuperStores, suspendStore, activateStore, getSuperStore } from '../../api/superadmin'
import Badge from '../../components/UI/Badge'
import Modal from '../../components/UI/Modal'
import Button from '../../components/UI/Button'

const PURPLE = '#7C3AED'

export default function SuperStores() {
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionTarget, setActionTarget] = useState(null) // { store, action: 'suspend'|'activate'|'detail' }
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [detail, setDetail] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    listSuperStores()
      .then((res) => setStores(res.data?.stores || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = stores.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return s.store_name.toLowerCase().includes(q) || s.store_code.toLowerCase().includes(q)
  })

  const handleAction = async () => {
    if (!actionTarget) return
    setActionLoading(true)
    setActionError('')
    try {
      if (actionTarget.action === 'suspend') await suspendStore(actionTarget.store.store_id)
      else await activateStore(actionTarget.store.store_id)
      setActionTarget(null)
      load()
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || 'Action failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const openDetail = async (store) => {
    setDetail({ loading: true, store })
    try {
      const res = await getSuperStore(store.store_id)
      setDetail({ loading: false, store: res.data.store })
    } catch {
      setDetail(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🏪 Stores</h1>
          <p className="page-header-sub">All customer stores on the platform</p>
        </div>
        <Button onClick={() => navigate('/superadmin/stores/create')}>➕ Create Store</Button>
      </div>

      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          className="input-field"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {filtered.length} store{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Store Name</th>
              <th>Code</th>
              <th>Users</th>
              <th>Books</th>
              <th>Shifts</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>{[1,2,3,4,5,6,7,8].map((j) => (
                  <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                No stores found.
              </td></tr>
            ) : filtered.map((s) => (
              <tr key={s.store_id} className="clickable" onClick={() => openDetail(s)}>
                <td><span style={{ fontWeight: 600 }}>{s.store_name}</span></td>
                <td><code style={{ fontSize: 12, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{s.store_code}</code></td>
                <td>{s.user_count ?? '—'}</td>
                <td>{s.book_count ?? '—'}</td>
                <td>{s.shift_count ?? '—'}</td>
                <td>
                  <Badge variant={s.suspended ? 'red' : 'green'}>
                    {s.suspended ? 'Suspended' : 'Active'}
                  </Badge>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.suspended ? (
                      <button className="btn btn-secondary btn-sm" style={{ color: '#2DAE1A', borderColor: '#2DAE1A' }}
                        onClick={() => { setActionTarget({ store: s, action: 'activate' }); setActionError('') }}>
                        Activate
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                        onClick={() => { setActionTarget({ store: s, action: 'suspend' }); setActionError('') }}>
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Suspend / Activate Confirmation */}
      <Modal
        open={!!actionTarget && actionTarget.action !== 'detail'}
        onClose={() => { setActionTarget(null); setActionError('') }}
        title={actionTarget?.action === 'suspend' ? 'Suspend Store' : 'Activate Store'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setActionTarget(null); setActionError('') }}>Cancel</Button>
            <Button
              variant={actionTarget?.action === 'suspend' ? 'danger' : 'primary'}
              onClick={handleAction}
              loading={actionLoading}
            >
              {actionTarget?.action === 'suspend' ? 'Suspend' : 'Activate'}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {actionTarget?.action === 'suspend'
            ? <>Are you sure you want to suspend <strong>{actionTarget?.store?.store_name}</strong>? All users will be blocked from logging in.</>
            : <>Re-activate <strong>{actionTarget?.store?.store_name}</strong>? Users will be able to log in again.</>
          }
        </p>
        {actionError && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{actionError}</p>}
      </Modal>

      {/* Store Detail Modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.store?.store_name || 'Store Details'}
      >
        {detail?.loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Loading...</div>
        ) : detail?.store ? (
          <div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { label: 'Store Code', value: detail.store.store_code },
                { label: 'Users', value: detail.store.user_count },
                { label: 'Books', value: detail.store.book_count },
                { label: 'Shifts', value: detail.store.shift_count },
                { label: 'Status', value: detail.store.suspended ? 'Suspended' : 'Active' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{value}</div>
                </div>
              ))}
            </div>
            {detail.store.users?.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Users</div>
                <table className="table">
                  <thead><tr><th>Username</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>
                    {detail.store.users.map((u) => (
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
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
