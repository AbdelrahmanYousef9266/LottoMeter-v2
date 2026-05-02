import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listSuperStores, suspendStore, activateStore, getSuperStore, updateSuperStore,
  listSubscriptions, cancelStoreSubscription, reactivateStoreSubscription, extendStoreTrial,
} from '../../api/superadmin'
import Badge from '../../components/UI/Badge'
import Modal from '../../components/UI/Modal'
import Button from '../../components/UI/Button'

const PURPLE = '#7C3AED'

const SUB_STATUS_VARIANT = {
  trial: 'amber', active: 'green', expired: 'red', suspended: 'red', cancelled: 'gray',
}

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
}

export default function SuperStores() {
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Suspend / activate confirmation modal
  const [actionTarget, setActionTarget] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Detail modal
  const [detail, setDetail] = useState(null)
  const [detailTab, setDetailTab] = useState('info')
  const [notesEdit, setNotesEdit] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  // Subscription tab
  const [subscription, setSubscription] = useState(null)
  const [subLoading, setSubLoading] = useState(false)
  const [extendDays, setExtendDays] = useState(7)
  const [subActionLoading, setSubActionLoading] = useState(false)
  const [subActionError, setSubActionError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    listSuperStores()
      .then((res) => setStores(res.data?.stores || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Load subscription when switching to the subscription tab
  useEffect(() => {
    if (detailTab === 'subscription' && detail?.store?.store_id) {
      setSubLoading(true)
      setSubActionError('')
      listSubscriptions({ store_id: detail.store.store_id })
        .then((res) => setSubscription(res.data.subscriptions?.[0] || null))
        .catch(() => setSubscription(null))
        .finally(() => setSubLoading(false))
    }
  }, [detailTab, detail?.store?.store_id])

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
    setDetailTab('info')
    setSubscription(null)
    setSubActionError('')
    try {
      const res = await getSuperStore(store.store_id)
      const full = res.data.store
      setDetail({ loading: false, store: full })
      setNotesEdit(full.notes || '')
    } catch {
      setDetail(null)
    }
  }

  const handleSaveNotes = async () => {
    if (!detail?.store) return
    setNotesSaving(true)
    try {
      const res = await updateSuperStore(detail.store.store_id, { notes: notesEdit })
      setDetail((prev) => ({ ...prev, store: { ...prev.store, notes: res.data.store.notes } }))
    } catch {}
    finally { setNotesSaving(false) }
  }

  const handleSubAction = async (action) => {
    if (!detail?.store) return
    setSubActionLoading(true)
    setSubActionError('')
    try {
      let res
      if (action === 'cancel')         res = await cancelStoreSubscription(detail.store.store_id, {})
      else if (action === 'reactivate') res = await reactivateStoreSubscription(detail.store.store_id)
      else if (action === 'extend')     res = await extendStoreTrial(detail.store.store_id, { days: Number(extendDays) })
      if (res?.data?.subscription) setSubscription(res.data.subscription)
    } catch (err) {
      setSubActionError(err?.response?.data?.error?.message || 'Action failed.')
    } finally {
      setSubActionLoading(false)
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
              <th>Owner</th>
              <th>City / State</th>
              <th>Users</th>
              <th>Shifts</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>{[1,2,3,4,5,6,7,8,9].map((j) => (
                  <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                No stores found.
              </td></tr>
            ) : filtered.map((s) => (
              <tr key={s.store_id} className="clickable" onClick={() => openDetail(s)}>
                <td><span style={{ fontWeight: 600 }}>{s.store_name}</span></td>
                <td>
                  <code style={{ fontSize: 12, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                    {s.store_code}
                  </code>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.owner_name || '—'}</td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td>{s.user_count ?? '—'}</td>
                <td>{s.shift_count ?? '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Badge variant={s.is_active !== false ? 'green' : 'red'}>
                      {s.is_active !== false ? 'Active' : 'Inactive'}
                    </Badge>
                    {s.suspended && <Badge variant="red">Suspended</Badge>}
                  </div>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.suspended ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#2DAE1A', borderColor: '#2DAE1A' }}
                        onClick={() => { setActionTarget({ store: s, action: 'activate' }); setActionError('') }}
                      >
                        Activate
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                        onClick={() => { setActionTarget({ store: s, action: 'suspend' }); setActionError('') }}
                      >
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
        open={!!actionTarget}
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
        onClose={() => { setDetail(null); setSubscription(null) }}
        title={detail?.store?.store_name || 'Store Details'}
      >
        {detail?.loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Loading...</div>
        ) : detail?.store ? (
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              {[{ key: 'info', label: 'Info' }, { key: 'subscription', label: 'Subscription' }].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDetailTab(key)}
                  style={{
                    padding: '8px 18px', border: 'none', background: 'none',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    color: detailTab === key ? PURPLE : 'var(--text-secondary)',
                    borderBottom: detailTab === key ? `2px solid ${PURPLE}` : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Info Tab ── */}
            {detailTab === 'info' && (
              <div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
                  {[
                    { label: 'Store Code', value: detail.store.store_code },
                    { label: 'Users', value: detail.store.user_count },
                    { label: 'Books', value: detail.store.book_count },
                    { label: 'Shifts', value: detail.store.shift_count },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={labelStyle}>{label}</div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{value ?? '—'}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
                  {[
                    { label: 'Owner', value: detail.store.owner_name },
                    { label: 'Email', value: detail.store.email },
                    { label: 'Phone', value: detail.store.phone },
                    { label: 'Address', value: detail.store.address },
                    { label: 'City', value: detail.store.city },
                    { label: 'State', value: detail.store.state },
                    { label: 'Zip', value: detail.store.zip_code },
                  ].filter(({ value }) => value).map(({ label, value }) => (
                    <div key={label}>
                      <div style={labelStyle}>{label}</div>
                      <div style={{ fontSize: 14 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <Badge variant={detail.store.is_active !== false ? 'green' : 'red'}>
                    {detail.store.is_active !== false ? 'Active' : 'Inactive'}
                  </Badge>
                  {detail.store.suspended && <Badge variant="red">Suspended</Badge>}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={labelStyle}>Internal Notes</div>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={notesEdit}
                    onChange={(e) => setNotesEdit(e.target.value)}
                    placeholder="Add internal notes about this store..."
                    style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                  >
                    {notesSaving ? 'Saving…' : 'Save Notes'}
                  </button>
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
            )}

            {/* ── Subscription Tab ── */}
            {detailTab === 'subscription' && (
              <div>
                {subLoading ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Loading...</div>
                ) : !subscription ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>No subscription found.</div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
                      <div>
                        <div style={labelStyle}>Status</div>
                        <Badge variant={SUB_STATUS_VARIANT[subscription.status] || 'gray'}>
                          {subscription.status}
                        </Badge>
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
                      {subscription.trial_ends_at && (
                        <div>
                          <div style={labelStyle}>Trial Ends</div>
                          <div style={{ fontSize: 14 }}>{new Date(subscription.trial_ends_at).toLocaleDateString()}</div>
                        </div>
                      )}
                      {subscription.current_period_end && (
                        <div>
                          <div style={labelStyle}>Period End</div>
                          <div style={{ fontSize: 14 }}>{new Date(subscription.current_period_end).toLocaleDateString()}</div>
                        </div>
                      )}
                      {subscription.card_brand && (
                        <div>
                          <div style={labelStyle}>Card</div>
                          <div style={{ fontSize: 14, textTransform: 'capitalize' }}>
                            {subscription.card_brand} •••• {subscription.card_last4}
                          </div>
                        </div>
                      )}
                      {subscription.cancel_at_period_end && (
                        <div>
                          <div style={labelStyle}>Cancels</div>
                          <Badge variant="amber">End of Period</Badge>
                        </div>
                      )}
                    </div>

                    {subscription.cancelled_reason && (
                      <div style={{ marginBottom: 16, background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                        <strong>Cancel reason:</strong> {subscription.cancelled_reason}
                      </div>
                    )}

                    {subActionError && (
                      <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{subActionError}</div>
                    )}

                    <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Extend / Restore Trial</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="number"
                          className="input-field"
                          value={extendDays}
                          onChange={(e) => setExtendDays(e.target.value)}
                          min={1}
                          style={{ width: 80 }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>days</span>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSubAction('extend')}
                          disabled={subActionLoading}
                        >
                          {subActionLoading ? 'Saving…' : 'Extend Trial'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {!subscription.cancel_at_period_end ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                          onClick={() => handleSubAction('cancel')}
                          disabled={subActionLoading}
                        >
                          Cancel Subscription
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#2DAE1A', borderColor: '#2DAE1A' }}
                          onClick={() => handleSubAction('reactivate')}
                          disabled={subActionLoading}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
