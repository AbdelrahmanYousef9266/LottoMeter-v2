import { useState, useCallback } from 'react'
import { listSlots, createSlot, deleteSlot } from '../api/slots'
import useApi from '../hooks/useApi'
import Modal from '../components/UI/Modal'
import Button from '../components/UI/Button'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../utils/currency'

export default function Slots() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({ slot_name: '', ticket_price: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const apiFn = useCallback(() => listSlots(), [])
  const { data, loading, error, refetch } = useApi(apiFn)
  const slots = Array.isArray(data) ? data : data?.slots || data?.data || []

  const handleCreate = async () => {
    if (!form.slot_name.trim()) {
      setFormError('Slot name is required.')
      return
    }
    if (!form.ticket_price || isNaN(Number(form.ticket_price))) {
      setFormError('A valid ticket price is required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await createSlot({ slot_name: form.slot_name, ticket_price: parseFloat(form.ticket_price) })
      setCreateOpen(false)
      setForm({ slot_name: '', ticket_price: '' })
      refetch()
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to create slot.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteSlot(deleteTarget.id || deleteTarget._id)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete slot.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Slots</h1>
          <p className="page-header-sub">Manage lottery machine slot configurations</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setCreateOpen(true); setFormError('') }}>
            + Create Slot
          </Button>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>Error: {error}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 140, borderRadius: 'var(--radius)' }}
            />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎰</div>
          <p style={{ fontSize: 14 }}>No slots configured yet.</p>
          {isAdmin && (
            <Button
              onClick={() => setCreateOpen(true)}
              style={{ marginTop: 16 }}
            >
              Create First Slot
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {slots.map((slot) => {
            const id = slot.id || slot._id
            const hasBook = !!(slot.current_book || slot.book || slot.book_id)
            return (
              <div
                key={id}
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
                {/* Status indicator */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 14,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: hasBook ? 'var(--green)' : 'var(--border)',
                  }}
                />

                <div>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🎰</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{slot.slot_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Ticket Price: <strong>{formatCurrency(slot.ticket_price)}</strong>
                  </div>
                </div>

                <div style={{ fontSize: 12 }}>
                  {hasBook ? (
                    <span
                      style={{
                        background: 'rgba(45, 174, 26, 0.1)',
                        color: '#1a8c0e',
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontWeight: 600,
                      }}
                    >
                      Book Assigned
                    </span>
                  ) : (
                    <span
                      style={{
                        background: 'rgba(70, 98, 127, 0.1)',
                        color: 'var(--text-secondary)',
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontWeight: 600,
                      }}
                    >
                      Empty Slot
                    </span>
                  )}
                </div>

                {hasBook && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Book: {slot.current_book?.static_code || slot.book?.static_code || 'N/A'}
                  </div>
                )}

                {isAdmin && (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: 4 }}
                    onClick={() => { setDeleteTarget(slot); setDeleteError('') }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
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
          <label className="form-label">
            Slot Name <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            className="input-field"
            placeholder="e.g. Slot A, Machine 1"
            value={form.slot_name}
            onChange={(e) => setForm((p) => ({ ...p, slot_name: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">
            Ticket Price ($) <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            className="input-field"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1.00"
            value={form.ticket_price}
            onChange={(e) => setForm((p) => ({ ...p, ticket_price: e.target.value }))}
          />
        </div>
        {formError && (
          <p style={{ color: 'var(--red)', fontSize: 13 }}>{formError}</p>
        )}
      </Modal>

      {/* Delete Confirmation */}
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
          Are you sure you want to delete slot{' '}
          <strong>{deleteTarget?.slot_name}</strong>? This action cannot be undone.
        </p>
        {deleteError && (
          <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{deleteError}</p>
        )}
      </Modal>
    </div>
  )
}
