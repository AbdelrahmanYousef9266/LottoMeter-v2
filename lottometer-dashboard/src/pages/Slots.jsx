import { useState, useCallback } from 'react'
import { listSlots, createSlot, deleteSlot, bulkCreateSlots, assignBookToSlot } from '../api/slots'
import useApi from '../hooks/useApi'
import Modal from '../components/UI/Modal'
import Button from '../components/UI/Button'
import Badge from '../components/UI/Badge'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../utils/currency'

const PRICE_OPTIONS = ['1.00', '2.00', '3.00', '5.00', '10.00', '20.00']

export default function Slots() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // ── List ─────────────────────────────────────────────────────────────────────
  const apiFn = useCallback(() => listSlots(), [])
  const { data, loading, error, refetch } = useApi(apiFn)
  const slots = Array.isArray(data) ? data : data?.slots || data?.data || []

  // ── Create single ────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ slot_name: '', ticket_price: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!form.slot_name.trim()) return setFormError('Slot name is required.')
    if (!form.ticket_price || isNaN(Number(form.ticket_price))) return setFormError('A valid ticket price is required.')
    setSaving(true); setFormError('')
    try {
      await createSlot({ slot_name: form.slot_name, ticket_price: parseFloat(form.ticket_price) })
      setCreateOpen(false); setForm({ slot_name: '', ticket_price: '' }); refetch()
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to create slot.')
    } finally { setSaving(false) }
  }

  // ── Bulk create ───────────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkTiers, setBulkTiers] = useState([{ ticket_price: '1.00', count: 1 }])
  const [bulkPrefix, setBulkPrefix] = useState('Slot ')
  const [bulkError, setBulkError] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)

  const addTier = () => {
    if (bulkTiers.length >= 10) return
    setBulkTiers((t) => [...t, { ticket_price: '1.00', count: 1 }])
  }

  const updateTier = (i, field, value) =>
    setBulkTiers((t) => t.map((tier, idx) => idx === i ? { ...tier, [field]: value } : tier))

  const removeTier = (i) =>
    setBulkTiers((t) => t.filter((_, idx) => idx !== i))

  const handleBulkCreate = async () => {
    setBulkError('')
    for (const tier of bulkTiers) {
      const c = parseInt(tier.count, 10)
      if (!c || c < 1 || c > 200) return setBulkError('Each tier needs a count between 1 and 200.')
    }
    setBulkSaving(true)
    try {
      const res = await bulkCreateSlots({
        tiers: bulkTiers.map((t) => ({ count: parseInt(t.count, 10), ticket_price: t.ticket_price })),
        name_prefix: bulkPrefix || 'Slot ',
      })
      setBulkResult({ created_count: res.data.created_count })
      refetch()
    } catch (err) {
      setBulkError(err?.response?.data?.message || 'Failed to create slots.')
    } finally { setBulkSaving(false) }
  }

  const closeBulk = () => {
    setBulkOpen(false); setBulkTiers([{ ticket_price: '1.00', count: 1 }])
    setBulkPrefix('Slot '); setBulkError(''); setBulkResult(null)
  }

  // ── Assign / Reassign ─────────────────────────────────────────────────────────
  const [assignTarget, setAssignTarget] = useState(null)
  const [assignBarcode, setAssignBarcode] = useState('')
  const [assignError, setAssignError] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignConfirming, setAssignConfirming] = useState(false)

  const openAssign = (slot) => {
    setAssignTarget(slot); setAssignBarcode(''); setAssignError(''); setAssignConfirming(false)
  }

  const closeAssign = () => {
    setAssignTarget(null); setAssignBarcode(''); setAssignError(''); setAssignConfirming(false)
  }

  const handleAssign = async (confirmReassign = false) => {
    const trimmed = assignBarcode.trim()
    if (!trimmed) return setAssignError('Barcode is required.')
    setAssignBusy(true); setAssignError('')
    try {
      await assignBookToSlot(assignTarget.slot_id, { barcode: trimmed, confirm_reassign: confirmReassign })
      closeAssign(); refetch()
    } catch (err) {
      const code = err?.response?.data?.code
      if (code === 'REASSIGN_CONFIRMATION_REQUIRED') {
        setAssignConfirming(true)
      } else {
        setAssignError(err?.response?.data?.message || 'Failed to assign book.')
      }
    } finally { setAssignBusy(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError('')
    try {
      await deleteSlot(deleteTarget.slot_id)
      setDeleteTarget(null); refetch()
    } catch (err) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete slot.')
    } finally { setDeleting(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Slots</h1>
          <p className="page-header-sub">Manage lottery machine slot configurations</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => { setBulkOpen(true); setBulkResult(null) }}>
              Bulk Add Slots
            </Button>
            <Button onClick={() => { setCreateOpen(true); setFormError('') }}>
              + Create Slot
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>Error: {error}</div>
      )}

      {/* Slot Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: 180, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎰</div>
          <p style={{ fontSize: 14 }}>No slots configured yet.</p>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setBulkOpen(true)}>Bulk Add Slots</Button>
              <Button onClick={() => setCreateOpen(true)}>Create First Slot</Button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {slots.map((slot) => {
            const hasBook = !!(slot.current_book)
            const book = slot.current_book
            return (
              <div
                key={slot.slot_id}
                style={{
                  background: hasBook ? 'var(--bg-card)' : '#F8FAFF',
                  border: `1.5px solid ${hasBook ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: 20,
                  boxShadow: 'var(--shadow)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Status dot */}
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 10, height: 10, borderRadius: '50%',
                  background: hasBook ? 'var(--green)' : 'var(--border)',
                }} />

                <div>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🎰</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{slot.slot_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Ticket Price: <strong>{formatCurrency(slot.ticket_price)}</strong>
                  </div>
                </div>

                {/* Book status pill */}
                <div style={{ fontSize: 12 }}>
                  {hasBook ? (
                    <span style={{ background: 'rgba(45,174,26,0.1)', color: '#1a8c0e', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                      Book Assigned
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(70,98,127,0.1)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                      Empty Slot
                    </span>
                  )}
                </div>

                {/* Current book barcode */}
                {hasBook && book && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {book.static_code || book.barcode || 'N/A'}
                  </div>
                )}

                {/* Actions */}
                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {hasBook ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => openAssign(slot)}>
                        Reassign Book
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => openAssign(slot)}>
                        Assign Book
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => { setDeleteTarget(slot); setDeleteError('') }}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create Single Modal ───────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setFormError(''); setForm({ slot_name: '', ticket_price: '' }) }}
        title="Create New Slot"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create Slot</Button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Slot Name <span style={{ color: 'var(--red)' }}>*</span></label>
          <input
            className="input-field"
            placeholder="e.g. Slot A, Machine 1"
            value={form.slot_name}
            onChange={(e) => setForm((p) => ({ ...p, slot_name: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Ticket Price ($) <span style={{ color: 'var(--red)' }}>*</span></label>
          <select
            className="input-field"
            value={form.ticket_price}
            onChange={(e) => setForm((p) => ({ ...p, ticket_price: e.target.value }))}
          >
            <option value="">Select price…</option>
            {PRICE_OPTIONS.map((p) => <option key={p} value={p}>${p}</option>)}
          </select>
        </div>
        {formError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{formError}</p>}
      </Modal>

      {/* ── Bulk Add Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={bulkOpen}
        onClose={closeBulk}
        title="Bulk Add Slots"
        footer={
          bulkResult ? (
            <Button onClick={closeBulk}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeBulk}>Cancel</Button>
              <Button onClick={handleBulkCreate} loading={bulkSaving}>
                Create Slots
              </Button>
            </>
          )
        }
      >
        {bulkResult ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {bulkResult.created_count} slot{bulkResult.created_count !== 1 ? 's' : ''} created
            </p>
          </div>
        ) : (
          <>
            {/* Name prefix */}
            <div className="form-group">
              <label className="form-label">Name Prefix</label>
              <input
                className="input-field"
                placeholder="Slot "
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
              />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Slots will be named "{bulkPrefix || 'Slot '}1", "{bulkPrefix || 'Slot '}2", etc.
              </p>
            </div>

            {/* Tiers */}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Tiers</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bulkTiers.map((tier, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="input-field"
                      style={{ flex: 1 }}
                      value={tier.ticket_price}
                      onChange={(e) => updateTier(i, 'ticket_price', e.target.value)}
                    >
                      {PRICE_OPTIONS.map((p) => <option key={p} value={p}>${p} tickets</option>)}
                    </select>
                    <input
                      className="input-field"
                      type="number"
                      min="1"
                      max="200"
                      style={{ width: 80 }}
                      placeholder="Count"
                      value={tier.count}
                      onChange={(e) => updateTier(i, 'count', e.target.value)}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>slots</span>
                    {bulkTiers.length > 1 && (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ flexShrink: 0 }}
                        onClick={() => removeTier(i)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {bulkTiers.length < 10 && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={addTier}
                >
                  + Add Tier
                </button>
              )}
            </div>

            {/* Summary */}
            <div style={{ background: '#F8FAFF', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Total: <strong style={{ color: 'var(--text-primary)' }}>
                {bulkTiers.reduce((sum, t) => sum + (parseInt(t.count, 10) || 0), 0)} slots
              </strong> will be created
            </div>

            {bulkError && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{bulkError}</p>}
          </>
        )}
      </Modal>

      {/* ── Assign / Reassign Modal ───────────────────────────────────────────── */}
      <Modal
        open={!!assignTarget}
        onClose={closeAssign}
        title={assignTarget?.current_book ? `Reassign — ${assignTarget?.slot_name}` : `Assign Book — ${assignTarget?.slot_name}`}
        footer={
          assignConfirming ? (
            <>
              <Button variant="secondary" onClick={() => setAssignConfirming(false)}>Back</Button>
              <Button variant="danger" onClick={() => handleAssign(true)} loading={assignBusy}>
                Confirm Reassign
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={closeAssign}>Cancel</Button>
              <Button onClick={() => handleAssign(false)} loading={assignBusy}>
                {assignTarget?.current_book ? 'Reassign' : 'Assign'}
              </Button>
            </>
          )
        }
      >
        {assignConfirming ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>Reassign Confirmation Required</p>
              <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                This book is currently assigned to another slot. Confirming will move it to <strong>{assignTarget?.slot_name}</strong>.
              </p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Barcode: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{assignBarcode}</span>
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assignTarget?.current_book && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                <span style={{ color: '#92400E', fontWeight: 600 }}>Current book: </span>
                <span style={{ fontFamily: 'monospace', color: '#92400E' }}>
                  {assignTarget.current_book.static_code || assignTarget.current_book.barcode}
                </span>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Book Barcode <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                className="input-field"
                placeholder="Scan or type barcode…"
                value={assignBarcode}
                onChange={(e) => setAssignBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAssign(false)}
                autoFocus
              />
            </div>
            {assignError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{assignError}</p>}
          </div>
        )}
      </Modal>

      {/* ── Delete Confirmation ───────────────────────────────────────────────── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError('') }}
        title="Delete Slot"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Are you sure you want to delete slot <strong>{deleteTarget?.slot_name}</strong>? This action cannot be undone.
        </p>
        {deleteError && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{deleteError}</p>}
      </Modal>
    </div>
  )
}
