import { useState, useCallback, useEffect } from 'react'
import { listBusinessDays, closeBusinessDay, getBusinessDay } from '../api/businessDays'
import { listShifts } from '../api/shifts'
import { listUsers } from '../api/users'
import useApi from '../hooks/useApi'
import Badge from '../components/UI/Badge'
import Table from '../components/UI/Table'
import Modal from '../components/UI/Modal'
import Button from '../components/UI/Button'
import { formatBusinessDate, getDayLabel } from '../utils/dateTime'
import { formatCurrency, formatVariance } from '../utils/currency'

function getStatusVariant(status) {
  if (status === 'open') return 'green'
  if (status === 'closed') return 'gray'
  return 'gray'
}

function getShiftStatusVariant(status) {
  switch (status) {
    case 'open': return 'green'
    case 'correct': return 'green'
    case 'over': return 'amber'
    case 'short': return 'red'
    case 'voided': return 'red'
    default: return 'gray'
  }
}

export default function BusinessDays() {
  const [filters, setFilters] = useState({ from: '', to: '' })
  const [activeFilters, setActiveFilters] = useState({})
  const [expandedRows, setExpandedRows] = useState({})
  const [shiftsCache, setShiftsCache] = useState({})
  const [users, setUsers] = useState([])
  const [closeTarget, setCloseTarget] = useState(null)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')

  const getEmployeeName = (employeeId) => {
    const user = users.find((u) => u.user_id === employeeId)
    return user ? user.username : '—'
  }

  const getDaySales = (day, dayShifts) => {
    if (day.status === 'closed' && day.total_sales !== null && day.total_sales !== undefined) {
      return parseFloat(day.total_sales)
    }
    return dayShifts
      .filter((s) => !s.voided)
      .reduce((sum, s) => sum + parseFloat(s.tickets_total || 0), 0)
  }

  const apiFn = useCallback(
    () => listBusinessDays(activeFilters),
    [activeFilters]
  )
  const { data, loading, error, refetch } = useApi(apiFn)

  const rows = Array.isArray(data) ? data : data?.business_days || data?.data || []

  // Preload users + all shifts whenever the business days list changes
  useEffect(() => {
    if (!rows.length) return
    let cancelled = false
    const shiftPromises = rows.map((row) =>
      listShifts({ business_day_id: row.id })
        .then((res) => ({ id: row.id, shifts: res.data?.shifts || [] }))
        .catch(() => ({ id: row.id, shifts: [] }))
    )
    Promise.all([listUsers({ include_deleted: true }), ...shiftPromises])
      .then(([usersRes, ...shiftResults]) => {
        if (cancelled) return
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || [])
        const cache = {}
        shiftResults.forEach(({ id, shifts }) => { cache[id] = shifts })
        setShiftsCache(cache)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilter = () => {
    const params = {}
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    setActiveFilters(params)
  }

  const handleClearFilter = () => {
    setFilters({ from: '', to: '' })
    setActiveFilters({})
  }

  const toggleRow = (row) => {
    const id = row.id || row._id
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleClose = async () => {
    if (!closeTarget) return
    setClosing(true)
    setCloseError('')
    try {
      await closeBusinessDay(closeTarget.id || closeTarget._id)
      setCloseTarget(null)
      refetch()
    } catch (err) {
      setCloseError(err?.response?.data?.message || 'Failed to close business day.')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Business Days</h1>
          <p className="page-header-sub">Track and manage daily business operations</p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="card"
        style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label className="form-label">From Date</label>
          <input
            type="date"
            className="input-field"
            value={filters.from}
            onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label className="form-label">To Date</label>
          <input
            type="date"
            className="input-field"
            value={filters.to}
            onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
          />
        </div>
        <Button onClick={handleFilter} size="sm">Apply Filter</Button>
        {(activeFilters.from || activeFilters.to) && (
          <Button onClick={handleClearFilter} variant="secondary" size="sm">Clear</Button>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>
          Error loading business days: {error}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Date</th>
              <th>Status</th>
              <th>Shifts</th>
              <th>Total Sales</th>
              <th>Variance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <td key={j}>
                      <div className="skeleton" style={{ height: 14, width: '80%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No business days found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = row.id || row._id
                const isExpanded = expandedRows[id]
                const variance = formatVariance(row.total_variance ?? 0)

                return (
                  <>
                    <tr
                      key={id}
                      className="clickable"
                      onClick={() => toggleRow(row)}
                      style={{ borderBottom: isExpanded ? 'none' : undefined }}
                    >
                      <td style={{ width: 40, color: 'var(--text-secondary)' }}>
                        {isExpanded ? '▾' : '▸'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{getDayLabel(row.date || row.business_date)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {formatBusinessDate(row.date || row.business_date)}
                        </div>
                      </td>
                      <td>
                        <Badge variant={getStatusVariant(row.status)}>{row.status || '—'}</Badge>
                      </td>
                      <td>{row.shifts_count ?? '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(getDaySales(row, shiftsCache[id] || []))}</td>
                      <td>
                        <span
                          style={{
                            color: variance.isPositive
                              ? 'var(--green)'
                              : variance.isNegative
                              ? 'var(--red)'
                              : 'var(--text-primary)',
                            fontWeight: 600,
                          }}
                        >
                          {variance.text}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {row.status === 'open' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => { setCloseTarget(row); setCloseError('') }}
                          >
                            Close Day
                          </Button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${id}-expanded`}>
                        <td colSpan={7} style={{ background: '#F8FAFF', padding: '12px 24px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
                            Shifts for this day
                          </div>
                          {(shiftsCache[id] || []).length === 0 ? (
                            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No shifts found.</div>
                          ) : (
                            <table className="table" style={{ background: 'white', borderRadius: 8 }}>
                              <thead>
                                <tr>
                                  <th>Shift #</th>
                                  <th>Employee</th>
                                  <th>Status</th>
                                  <th>Sales</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(shiftsCache[id] || []).map((s) => (
                                  <tr key={s.id || s._id}>
                                    <td>#{s.shift_number || s.id}</td>
                                    <td>{getEmployeeName(s.employee_id)}</td>
                                    <td>
                                      <Badge variant={getShiftStatusVariant(s.status)}>{s.status || '—'}</Badge>
                                    </td>
                                    <td>{formatCurrency(s.tickets_total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Close Confirmation Modal */}
      <Modal
        open={!!closeTarget}
        onClose={() => { setCloseTarget(null); setCloseError('') }}
        title="Close Business Day"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCloseTarget(null); setCloseError('') }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleClose} loading={closing}>
              Close Day
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Are you sure you want to close the business day for{' '}
          <strong>
            {formatBusinessDate(closeTarget?.date || closeTarget?.business_date)}
          </strong>
          ? This action cannot be undone.
        </p>
        {closeError && (
          <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{closeError}</p>
        )}
      </Modal>
    </div>
  )
}
