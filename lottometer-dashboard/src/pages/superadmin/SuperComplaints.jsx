import { useState, useEffect, useCallback } from 'react'
import Badge from '../../components/UI/Badge'
import { listComplaints, updateComplaint } from '../../api/complaints'

const PURPLE = '#7C3AED'

const PRIORITY_BADGE = {
  high:   'red',
  medium: 'amber',
  low:    'gray',
}

const PRIORITY_BORDER = {
  high:   '#EF4444',
  medium: '#D97706',
  low:    '#8FA3B8',
}

const FILTER_TABS = ['All', 'Open', 'Resolved']

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d !== 1 ? 's' : ''} ago`
  return new Date(isoString).toLocaleDateString()
}

function ComplaintCard({ complaint, selected, onClick }) {
  const preview = complaint.message.length > 100
    ? complaint.message.slice(0, 100) + '…'
    : complaint.message

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        marginBottom: 10,
        padding: '16px 20px',
        cursor: 'pointer',
        borderLeft: selected ? `3px solid ${PURPLE}` : '3px solid transparent',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? '0 0 0 2px rgba(124,58,237,0.15)' : undefined,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderLeftColor = 'var(--border)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderLeftColor = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
          {complaint.subject}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <Badge variant={PRIORITY_BADGE[complaint.priority]}>{complaint.priority}</Badge>
          <Badge variant={complaint.status === 'open' ? 'amber' : 'green'}>{complaint.status}</Badge>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 10 }}>
        {preview}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
          background: 'rgba(124,58,237,0.10)', color: PURPLE,
          padding: '2px 8px', borderRadius: 6,
        }}>
          {complaint.store_code}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{complaint.store_name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
          {relativeTime(complaint.created_at)}
        </span>
      </div>
    </div>
  )
}

function DetailPanel({ complaint, onUpdate, onClose }) {
  const [reply, setReply] = useState(complaint.staff_reply || '')
  const [saving, setSaving] = useState(false)

  const replyChanged = reply.trim() !== (complaint.staff_reply || '')

  const handleResolve = async () => {
    setSaving(true)
    try {
      const payload = { status: 'resolved' }
      if (replyChanged && reply.trim()) payload.reply = reply.trim()
      const res = await updateComplaint(complaint.id, payload)
      onUpdate(res.data.complaint)
      onClose()
    } catch {
      // keep panel open on failure
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReply = async () => {
    if (!reply.trim()) return
    setSaving(true)
    try {
      const res = await updateComplaint(complaint.id, { reply: reply.trim() })
      onUpdate(res.data.complaint)
    } catch {
      // no-op
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: 0, position: 'sticky', top: 24 }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            {complaint.subject}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge variant={PRIORITY_BADGE[complaint.priority]}>{complaint.priority}</Badge>
            <Badge variant={complaint.status === 'open' ? 'amber' : 'green'}>{complaint.status}</Badge>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1, flexShrink: 0,
            padding: 4,
          }}
          aria-label="Close"
        >×</button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Meta row */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Store</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              <span style={{
                fontFamily: 'monospace', background: 'rgba(124,58,237,0.10)', color: PURPLE,
                padding: '1px 6px', borderRadius: 4, marginRight: 6, fontSize: 12,
              }}>{complaint.store_code}</span>
              {complaint.store_name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Received</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{relativeTime(complaint.created_at)}</div>
          </div>
        </div>

        {/* Full message */}
        <div style={{
          borderLeft: `3px solid ${PRIORITY_BORDER[complaint.priority]}`,
          background: 'var(--bg-primary)',
          borderRadius: '0 8px 8px 0',
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--text-primary)',
          lineHeight: 1.7,
        }}>
          {complaint.message}
        </div>

        {/* Staff reply */}
        <div className="form-group">
          <label className="form-label">Staff Reply</label>
          <textarea
            className="input-field"
            rows={4}
            placeholder="Type a reply for your records…"
            value={reply}
            onChange={e => setReply(e.target.value)}
            disabled={saving}
            style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8 }}>
          {complaint.status === 'open' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleResolve}
              disabled={saving}
            >
              {saving ? 'Saving…' : '✓ Mark as resolved'}
            </button>
          )}
          {replyChanged && reply.trim() && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSaveReply}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save reply'}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SuperComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)

  const fetchComplaints = useCallback(() => {
    setLoading(true)
    listComplaints()
      .then(r => setComplaints(r.data.complaints))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchComplaints() }, [fetchComplaints])

  const filtered = complaints.filter(c => {
    if (filter === 'Open')     return c.status === 'open'
    if (filter === 'Resolved') return c.status === 'resolved'
    return true
  })

  const openCount = complaints.filter(c => c.status === 'open').length

  const handleUpdate = (updated) => {
    setComplaints(cs => cs.map(c => c.id === updated.id ? updated : c))
  }

  const exportCSV = () => {
    const rows = [
      ['ID', 'Store Code', 'Store Name', 'Subject', 'Status', 'Priority', 'Submitted'],
      ...complaints.map(c => [
        c.id, c.store_code, c.store_name,
        `"${c.subject.replace(/"/g, '""')}"`,
        c.status, c.priority,
        new Date(c.created_at).toLocaleString(),
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'complaints.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const selectedComplaint = selected !== null ? complaints.find(c => c.id === selected) : null

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Store Complaints</h1>
          <p className="page-header-sub">Messages sent by store owners via Contact Support</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {openCount > 0 && <Badge variant="amber">{openCount} open</Badge>}
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={loading || complaints.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: filter === tab ? PURPLE : 'var(--bg-primary)',
              color: filter === tab ? '#fff' : 'var(--text-secondary)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {tab}
            {tab === 'Open' && openCount > 0 && (
              <span style={{
                marginLeft: 6, background: 'rgba(239,68,68,0.18)', color: '#c02020',
                borderRadius: 999, padding: '1px 6px', fontSize: 11, fontWeight: 700,
              }}>{openCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading complaints…
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedComplaint ? '1fr 420px' : '1fr',
          gap: 20,
          alignItems: 'start',
        }}>
          {/* Complaint list */}
          <div>
            {filtered.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
                No complaints in this category.
              </div>
            ) : (
              filtered.map(c => (
                <ComplaintCard
                  key={c.id}
                  complaint={c}
                  selected={selected === c.id}
                  onClick={() => setSelected(selected === c.id ? null : c.id)}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          {selectedComplaint && (
            <DetailPanel
              key={selectedComplaint.id}
              complaint={selectedComplaint}
              onUpdate={handleUpdate}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
