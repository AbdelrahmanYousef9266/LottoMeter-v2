import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listReports, getShiftReport } from '../api/reports'
import { listBusinessDays } from '../api/businessDays'
import useApi from '../hooks/useApi'
import Badge from '../components/UI/Badge'
import Modal from '../components/UI/Modal'
import Button from '../components/UI/Button'
import { formatDateTime, formatDate, getDayLabel, formatDuration } from '../utils/dateTime'
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

export default function Reports() {
  const [searchParams] = useSearchParams()
  const initialShiftId = searchParams.get('shift_id')

  const [filters, setFilters] = useState({ from: '', to: '', employee: '', status: '' })
  const [activeFilters, setActiveFilters] = useState(
    initialShiftId ? { shift_id: initialShiftId } : {}
  )
  const [reportShift, setReportShift] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  // Auto-open report if shift_id in query params
  useEffect(() => {
    if (initialShiftId) {
      openReport({ id: initialShiftId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShiftId])

  const apiFn = useCallback(
    () => listReports({ ...activeFilters }),
    [activeFilters]
  )
  const { data, loading } = useApi(apiFn)
  const shifts = Array.isArray(data) ? data : data?.shifts || data?.data || []

  // Group shifts by business day date
  const grouped = shifts.reduce((acc, shift) => {
    const date = shift.business_day?.date || shift.business_date || 'Unknown'
    if (!acc[date]) acc[date] = []
    acc[date].push(shift)
    return acc
  }, {})

  const groupedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const applyFilters = () => {
    const params = {}
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    if (filters.employee) params.employee = filters.employee
    if (filters.status) params.status = filters.status
    setActiveFilters(params)
  }

  const clearFilters = () => {
    setFilters({ from: '', to: '', employee: '', status: '' })
    setActiveFilters({})
  }

  const openReport = async (shift) => {
    setReportShift(shift)
    setReportData(null)
    setReportError('')
    setReportLoading(true)
    try {
      const id = shift.id || shift._id
      const res = await getShiftReport(id)
      setReportData(res.data)
    } catch (err) {
      setReportError(err?.response?.data?.message || 'Failed to load report.')
    } finally {
      setReportLoading(false)
    }
  }

  const handleExportPDF = () => {
    alert('PDF export coming soon! This feature will generate a printable shift report.')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-header-sub">Detailed shift reports and sales analytics</p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="card"
        style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
          <label className="form-label">From</label>
          <input
            type="date"
            className="input-field"
            value={filters.from}
            onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
          <label className="form-label">To</label>
          <input
            type="date"
            className="input-field"
            value={filters.to}
            onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
          <label className="form-label">Employee</label>
          <input
            className="input-field"
            placeholder="Username..."
            value={filters.employee}
            onChange={(e) => setFilters((p) => ({ ...p, employee: e.target.value }))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
          <label className="form-label">Status</label>
          <select
            className="input-field"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="correct">Correct</option>
            <option value="over">Over</option>
            <option value="short">Short</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <Button size="sm" onClick={applyFilters}>Apply</Button>
        {Object.keys(activeFilters).length > 0 && (
          <Button size="sm" variant="secondary" onClick={clearFilters}>Clear</Button>
        )}
      </div>

      {/* Grouped list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      ) : groupedDates.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14 }}>No shifts found for the selected filters.</p>
        </div>
      ) : (
        groupedDates.map((date) => (
          <div key={date} style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>{getDayLabel(date)}</h2>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {formatDate(date)}
              </span>
              <Badge variant="gray">{grouped[date].length} shift{grouped[date].length !== 1 ? 's' : ''}</Badge>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[date].map((shift) => {
                const id = shift.id || shift._id
                const variance = formatVariance(shift.total_variance ?? 0)
                return (
                  <div
                    key={id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap',
                      padding: '14px 20px',
                    }}
                  >
                    <div style={{ minWidth: 80 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Shift</div>
                      <div style={{ fontWeight: 700 }}>#{shift.shift_number || id}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Employee</div>
                      <div style={{ fontWeight: 600 }}>
                        {shift.employee?.username || shift.employee_name || '—'}
                      </div>
                    </div>
                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Time</div>
                      <div style={{ fontSize: 13 }}>
                        {formatDateTime(shift.started_at)}
                        {shift.ended_at && ` — ${formatDateTime(shift.ended_at)}`}
                      </div>
                    </div>
                    <div style={{ minWidth: 80 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Duration</div>
                      <div style={{ fontSize: 13 }}>
                        {formatDuration(shift.started_at, shift.ended_at)}
                      </div>
                    </div>
                    <div>
                      <Badge variant={getStatusVariant(shift.status)}>{shift.status || '—'}</Badge>
                    </div>
                    <div style={{ minWidth: 90, textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sales</div>
                      <div style={{ fontWeight: 700 }}>{formatCurrency(shift.total_sales)}</div>
                    </div>
                    <div style={{ minWidth: 90, textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Variance</div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: variance.isPositive
                            ? 'var(--green)'
                            : variance.isNegative
                            ? 'var(--red)'
                            : 'inherit',
                        }}
                      >
                        {variance.text}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openReport(shift)}
                    >
                      View Report
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Report Detail Modal */}
      <Modal
        open={!!reportShift}
        onClose={() => { setReportShift(null); setReportData(null) }}
        title={`Shift Report — #${reportShift?.shift_number || reportShift?.id || ''}`}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => { setReportShift(null); setReportData(null) }}>
              Close
            </Button>
            <Button onClick={handleExportPDF}>
              Export PDF
            </Button>
          </div>
        }
      >
        {reportLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="loading-spinner md" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              Loading report...
            </p>
          </div>
        ) : reportError ? (
          <p style={{ color: 'var(--red)', fontSize: 13 }}>{reportError}</p>
        ) : reportData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Summary
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  background: '#F8FAFF',
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                {[
                  { label: 'Total Sales', value: formatCurrency(reportData.total_sales) },
                  { label: 'Expected', value: formatCurrency(reportData.expected_cash) },
                  { label: 'Actual Cash', value: formatCurrency(reportData.actual_cash) },
                  { label: 'Variance', value: formatVariance(reportData.variance ?? 0).text },
                  { label: 'Whole Books', value: reportData.whole_book_count ?? '—' },
                  { label: 'Returned', value: reportData.returned_count ?? '—' },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Books List */}
            {reportData.books?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Books ({reportData.books.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reportData.books.map((book, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#F8FAFF',
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {book.static_code || book.barcode || `Book ${i + 1}`}
                      </span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {book.tickets_sold ?? '—'} tickets
                        </span>
                        <Badge variant={book.status === 'sold' ? 'gray' : book.status === 'returned' ? 'amber' : 'green'}>
                          {book.status || '—'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ticket Breakdown */}
            {reportData.ticket_breakdown && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Ticket Breakdown
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    background: '#F8FAFF',
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  {Object.entries(reportData.ticket_breakdown).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{key}</div>
                      <div style={{ fontWeight: 700 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No report data available.</p>
        )}
      </Modal>
    </div>
  )
}
