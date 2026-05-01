import { useState, useCallback, useEffect } from 'react'
import { listSubmissions, updateSubmission, approveSubmission } from '../../api/superadmin'
import Badge from '../../components/UI/Badge'
import Modal from '../../components/UI/Modal'
import Button from '../../components/UI/Button'

function getStatusVariant(status) {
  if (status === 'new') return 'blue'
  if (status === 'approved') return 'green'
  return 'gray'
}

function getTypeVariant(type) {
  return type === 'apply' ? 'amber' : 'gray'
}

export default function SuperSubmissions() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [approveModal, setApproveModal] = useState(null)
  const [approveForm, setApproveForm] = useState({ store_name: '', store_code: '', admin_username: '', admin_password: '' })
  const [approveLoading, setApproveLoading] = useState(false)
  const [approveError, setApproveError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (typeFilter) params.type = typeFilter
    if (statusFilter) params.status = statusFilter
    listSubmissions(params)
      .then((res) => setSubmissions(res.data?.submissions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const handleMarkReviewed = async (sub) => {
    setActionLoading(true)
    try {
      await updateSubmission(sub.id, { mark_reviewed: true })
      load()
      if (selected?.id === sub.id) setSelected((p) => ({ ...p, status: 'reviewed' }))
    } catch {
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    setApproveLoading(true)
    setApproveError('')
    try {
      const res = await approveSubmission(approveModal.id, approveForm)
      setApproveModal(null)
      setApproveForm({ store_name: '', store_code: '', admin_username: '', admin_password: '' })
      load()
      if (selected?.id === approveModal.id) setSelected((p) => ({ ...p, status: 'approved' }))
      alert(`Store "${res.data.store.store_name}" created. Admin: ${res.data.admin.username}`)
    } catch (err) {
      setApproveError(err?.response?.data?.error?.message || 'Failed to approve.')
    } finally {
      setApproveLoading(false)
    }
  }

  const openApproveModal = (sub) => {
    const suggestedCode = (sub.business_name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setApproveForm({
      store_name: sub.business_name || '',
      store_code: suggestedCode,
      admin_username: '',
      admin_password: '',
    })
    setApproveError('')
    setApproveModal(sub)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📬 Submissions</h1>
          <p className="page-header-sub">Contact and demo request submissions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Type</label>
          <select className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="contact">Contact</option>
            <option value="apply">Apply</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Status</label>
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Business</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0,1,2].map((i) => (
                <tr key={i}>{[1,2,3,4,5,6,7,8].map((j) => (
                  <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                ))}</tr>
              ))
            ) : submissions.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                No submissions found.
              </td></tr>
            ) : submissions.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setSelected(s)}>
                <td><Badge variant={getTypeVariant(s.submission_type)}>{s.submission_type}</Badge></td>
                <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                <td>{s.business_name || '—'}</td>
                <td style={{ fontSize: 13 }}>{s.email}</td>
                <td style={{ fontSize: 13 }}>{s.phone || '—'}</td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
                <td><Badge variant={getStatusVariant(s.status)}>{s.status}</Badge></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.status === 'new' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleMarkReviewed(s)} disabled={actionLoading}>
                        Review
                      </button>
                    )}
                    {s.submission_type === 'apply' && s.status !== 'approved' && (
                      <button className="btn btn-primary btn-sm" style={{ background: '#7C3AED', borderColor: '#7C3AED' }}
                        onClick={() => openApproveModal(s)}>
                        Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`${selected?.submission_type === 'apply' ? 'Demo Request' : 'Contact'} — ${selected?.full_name}`}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            {selected?.status === 'new' && (
              <Button variant="secondary" onClick={() => { handleMarkReviewed(selected); setSelected(null) }} loading={actionLoading}>
                Mark Reviewed
              </Button>
            )}
            {selected?.submission_type === 'apply' && selected?.status !== 'approved' && (
              <Button onClick={() => { setSelected(null); openApproveModal(selected) }}
                style={{ background: '#7C3AED' }}>
                Approve & Create Store
              </Button>
            )}
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
          </div>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14 }}>
            <Row label="Status"><Badge variant={getStatusVariant(selected.status)}>{selected.status}</Badge></Row>
            <Row label="Type"><Badge variant={getTypeVariant(selected.submission_type)}>{selected.submission_type}</Badge></Row>
            <Row label="Full Name">{selected.full_name}</Row>
            {selected.business_name && <Row label="Business">{selected.business_name}</Row>}
            <Row label="Email"><a href={`mailto:${selected.email}`} style={{ color: 'var(--blue)' }}>{selected.email}</a></Row>
            {selected.phone && <Row label="Phone">{selected.phone}</Row>}
            {selected.city && <Row label="City">{selected.city}</Row>}
            {selected.num_employees && <Row label="Employees">{selected.num_employees}</Row>}
            {selected.how_heard && <Row label="How Heard">{selected.how_heard}</Row>}
            {selected.message && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Message</div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.message}</div>
              </div>
            )}
            {selected.notes && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes</div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6 }}>{selected.notes}</div>
              </div>
            )}
            <Row label="Submitted">{new Date(selected.created_at).toLocaleString()}</Row>
            {selected.reviewed_at && <Row label="Reviewed">{new Date(selected.reviewed_at).toLocaleString()}</Row>}
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        open={!!approveModal}
        onClose={() => { setApproveModal(null); setApproveError('') }}
        title={`Approve & Create Store — ${approveModal?.full_name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setApproveModal(null); setApproveError('') }}>Cancel</Button>
            <Button onClick={handleApprove} loading={approveLoading} style={{ background: '#7C3AED' }}>
              Create Store & Approve
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          This will create a new store and admin account, then mark the submission as approved.
        </p>
        {[
          { key: 'store_name', label: 'Store Name', placeholder: approveModal?.business_name || '' },
          { key: 'store_code', label: 'Store Code', placeholder: 'e.g. LUCKY1' },
          { key: 'admin_username', label: 'Admin Username', placeholder: 'e.g. admin' },
          { key: 'admin_password', label: 'Admin Password', placeholder: 'Temporary password', type: 'password' },
        ].map(({ key, label, placeholder, type = 'text' }) => (
          <div key={key} className="form-group">
            <label className="form-label">{label}</label>
            <input
              className="input-field"
              type={type}
              placeholder={placeholder}
              value={approveForm[key]}
              onChange={(e) => setApproveForm((p) => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
        {approveError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{approveError}</p>}
      </Modal>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 100, paddingTop: 2 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}
