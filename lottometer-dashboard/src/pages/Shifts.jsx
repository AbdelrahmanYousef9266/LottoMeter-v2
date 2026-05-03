import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listShifts } from '../api/shifts'
import { listBusinessDays } from '../api/businessDays'
import { listUsers } from '../api/users'
import useApi from '../hooks/useApi'
import Badge from '../components/UI/Badge'
import Table from '../components/UI/Table'
import { formatLocalTime, formatDuration } from '../utils/dateTime'
import { formatCurrency, formatVariance } from '../utils/currency'

function getStatusVariant(status) {
  switch (status) {
    case 'open': return 'green'
    case 'correct': return 'green'
    case 'over': return 'amber'
    case 'short': return 'red'
    case 'voided': return 'red'
    default: return 'gray'
  }
}

export default function Shifts() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ business_day_id: '', status: '' })
  const [activeFilters, setActiveFilters] = useState({})
  const [shifts, setShifts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listUsers({ include_deleted: true }),
      listShifts(activeFilters),
    ]).then(([usersRes, shiftsRes]) => {
      if (cancelled) return
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || [])
      const d = shiftsRes.data
      setShifts(Array.isArray(d) ? d : d?.shifts || d?.data || [])
    }).catch((err) => {
      if (cancelled) return
      setError(err?.response?.data?.message || err.message || 'Failed to load shifts.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeFilters])

  const getEmployeeName = (employeeId) => {
    const user = users.find((u) => u.user_id === employeeId)
    return user ? user.username : '—'
  }

  const getSales = (shift) => {
    if (shift.status !== 'closed') return '—'
    if (shift.tickets_total === null || shift.tickets_total === undefined) return '—'
    return formatCurrency(shift.tickets_total)
  }

  const getVariance = (shift) => {
    if (shift.status !== 'closed') return null
    if (shift.difference === null || shift.difference === undefined) return null
    const diff = parseFloat(shift.difference)
    const color = diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#16A34A'
    const label = diff > 0 ? 'Over' : diff < 0 ? 'Short' : 'Correct'
    return { value: `$${Math.abs(diff).toFixed(2)}`, color, label }
  }

  const bizDayApiFn = useCallback(() => listBusinessDays({ limit: 100 }), [])
  const { data: bizDayData } = useApi(bizDayApiFn)
  const businessDays = Array.isArray(bizDayData)
    ? bizDayData
    : bizDayData?.business_days || bizDayData?.data || []

  const getBusinessDate = (businessDayId) => {
    const day = businessDays.find((d) => d.id === businessDayId)
    return day ? (day.business_date || day.date || '—') : '—'
  }

  const handleFilter = () => {
    const params = {}
    if (filters.business_day_id) params.business_day_id = filters.business_day_id
    if (filters.status) params.status = filters.status
    setActiveFilters(params)
  }

  const handleClear = () => {
    setFilters({ business_day_id: '', status: '' })
    setActiveFilters({})
  }

  const columns = [
    {
      key: 'shift_number',
      label: 'Shift #',
      render: (v, row) => <span style={{ fontWeight: 600 }}>#{v || row.id}</span>,
    },
    {
      key: 'employee',
      label: 'Employee',
      render: (_, row) => getEmployeeName(row.employee_id),
    },
    {
      key: 'business_day_id',
      label: 'Business Day',
      render: (v) => getBusinessDate(v),
    },
    {
      key: 'opened_at',
      label: 'Started',
      render: (v) => formatLocalTime(v),
    },
    {
      key: 'closed_at',
      label: 'Ended',
      render: (v) => v ? formatLocalTime(v) : <Badge variant="green">Active</Badge>,
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (_, row) => formatDuration(row.opened_at, row.closed_at),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <Badge variant={getStatusVariant(v)}>{v || '—'}</Badge>,
    },
    {
      key: 'tickets_total',
      label: 'Ticket Sales',
      render: (_, row) => <span style={{ fontWeight: 600 }}>{getSales(row)}</span>,
    },
    {
      key: 'difference',
      label: 'Variance',
      render: (_, row) => {
        const v = getVariance(row)
        if (!v) return <span style={{ color: 'var(--text-secondary)' }}>—</span>
        return (
          <span style={{ color: v.color, fontWeight: 600 }}>
            {v.value} <span style={{ fontSize: 11, opacity: 0.8 }}>{v.label}</span>
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/dashboard/reports?shift_id=${row.id || row._id}`)
          }}
        >
          Report
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Shifts</h1>
          <p className="page-header-sub">View all employee shifts and their details</p>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="card"
        style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
          <label className="form-label">Business Day</label>
          <select
            className="input-field"
            value={filters.business_day_id}
            onChange={(e) => setFilters((p) => ({ ...p, business_day_id: e.target.value }))}
          >
            <option value="">All Business Days</option>
            {businessDays.map((bd) => (
              <option key={bd.id || bd._id} value={bd.id || bd._id}>
                {bd.date || bd.business_date} — {bd.status}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label className="form-label">Status</label>
          <select
            className="input-field"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="correct">Correct</option>
            <option value="over">Over</option>
            <option value="short">Short</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleFilter}>Apply</button>
        {(activeFilters.business_day_id || activeFilters.status) && (
          <button className="btn btn-secondary btn-sm" onClick={handleClear}>Clear</button>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>
          Error: {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <Table
          columns={columns}
          data={shifts}
          loading={loading}
          emptyMessage="No shifts found for the selected filters."
          onRowClick={(row) => navigate(`/dashboard/reports?shift_id=${row.id || row._id}`)}
        />
      </div>
    </div>
  )
}
