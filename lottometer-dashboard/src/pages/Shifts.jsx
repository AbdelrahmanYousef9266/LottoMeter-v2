import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listShifts } from '../api/shifts'
import { listBusinessDays } from '../api/businessDays'
import useApi from '../hooks/useApi'
import Badge from '../components/UI/Badge'
import Table from '../components/UI/Table'
import { formatDateTime, formatDuration } from '../utils/dateTime'
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

  const bizDayApiFn = useCallback(() => listBusinessDays({ limit: 100 }), [])
  const { data: bizDayData } = useApi(bizDayApiFn)
  const businessDays = Array.isArray(bizDayData)
    ? bizDayData
    : bizDayData?.business_days || bizDayData?.data || []

  const apiFn = useCallback(
    () => listShifts(activeFilters),
    [activeFilters]
  )
  const { data, loading, error } = useApi(apiFn)
  const shifts = Array.isArray(data) ? data : data?.shifts || data?.data || []

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
      render: (v, row) => row.employee?.username || row.employee_name || '—',
    },
    {
      key: 'business_day',
      label: 'Business Day',
      render: (v, row) => row.business_day?.date || row.business_date || '—',
    },
    {
      key: 'started_at',
      label: 'Started',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'ended_at',
      label: 'Ended',
      render: (v) => v ? formatDateTime(v) : <Badge variant="green">Active</Badge>,
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (_, row) => formatDuration(row.started_at, row.ended_at),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <Badge variant={getStatusVariant(v)}>{v || '—'}</Badge>,
    },
    {
      key: 'total_sales',
      label: 'Sales',
      render: (v) => <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>,
    },
    {
      key: 'total_variance',
      label: 'Variance',
      render: (v) => {
        const info = formatVariance(v ?? 0)
        return (
          <span
            style={{
              color: info.isPositive ? 'var(--green)' : info.isNegative ? 'var(--red)' : 'inherit',
              fontWeight: 600,
            }}
          >
            {info.text}
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
            navigate(`/reports?shift_id=${row.id || row._id}`)
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
          onRowClick={(row) => navigate(`/reports?shift_id=${row.id || row._id}`)}
        />
      </div>
    </div>
  )
}
