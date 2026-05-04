import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listReports, getShiftReport } from '../api/reports'
import { listBusinessDays } from '../api/businessDays'
import { listUsers } from '../api/users'
import Badge from '../components/UI/Badge'
import Modal from '../components/UI/Modal'
import Button from '../components/UI/Button'
import { formatLocalTime, formatLocalDateTime, formatDate, formatBusinessDate, getDayLabel, formatDuration } from '../utils/dateTime'
import { formatCurrency, formatVariance } from '../utils/currency'
import { getTicketsRemaining } from '../utils/bookConstants'
import { getBookDetail } from '../api/books'

function getDetailBookStatus(book) {
  if (book.returned_at) return { label: 'Returned', variant: 'amber' }
  if (book.is_sold) return { label: 'Sold', variant: 'gray' }
  if (book.is_active) return { label: 'Active', variant: 'green' }
  return { label: 'Inactive', variant: 'red' }
}

function unassignReasonLabel(reason) {
  switch (reason) {
    case 'reassigned': return 'Reassigned'
    case 'unassigned': return 'Unassigned'
    case 'sold': return 'Sold'
    case 'returned_to_vendor': return 'Returned'
    default: return reason || '—'
  }
}

function reasonVariant(reason) {
  switch (reason) {
    case 'sold': return 'gray'
    case 'returned_to_vendor': return 'amber'
    case 'reassigned': return 'blue'
    default: return 'gray'
  }
}

function getBookStatus(book) {
  if (book.fully_sold) return { label: 'Sold', color: '#64748B' }
  if (book.returned_at) return { label: 'Returned', color: '#D97706' }
  return { label: 'Active', color: '#16A34A' }
}

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
  const [shifts, setShifts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportShift, setReportShift] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [selectedReportBook, setSelectedReportBook] = useState(null)
  const [reportBookDetail, setReportBookDetail] = useState(null)
  const [loadingBookDetail, setLoadingBookDetail] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listUsers({ include_deleted: true }),
      listReports({ ...activeFilters }),
    ]).then(([usersRes, shiftsRes]) => {
      if (cancelled) return
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || [])
      const d = shiftsRes.data
      setShifts(Array.isArray(d) ? d : d?.shifts || d?.data || [])
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeFilters])

  const getEmployeeName = (employeeId) => {
    const user = users.find((u) => u.user_id === employeeId)
    return user ? user.username : '—'
  }

  const getSales = (shift) => {
    if (shift.tickets_total !== null && shift.tickets_total !== undefined) {
      return formatCurrency(shift.tickets_total)
    }
    return '—'
  }

  // Auto-open report if shift_id in query params
  useEffect(() => {
    if (initialShiftId) {
      openReport({ id: initialShiftId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShiftId])

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
      console.log('REPORT URL: /api/reports/shift/' + id)
      const res = await getShiftReport(id)
      console.log('REPORT DATA:', res.data)
      setReportData(res.data)
    } catch (err) {
      console.log('REPORT ERROR:', err?.response?.status, err?.response?.data)
      setReportError(err?.response?.data?.message || 'Failed to load report.')
    } finally {
      setReportLoading(false)
    }
  }

  const handleReportBookClick = async (book) => {
    setSelectedReportBook(book)
    setReportBookDetail(null)
    setLoadingBookDetail(true)
    try {
      const res = await getBookDetail(book.book_id)
      setReportBookDetail(res.data)
    } catch {
      setReportBookDetail(null)
    } finally {
      setLoadingBookDetail(false)
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
                {formatBusinessDate(date)}
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
                        {getEmployeeName(shift.employee_id)}
                      </div>
                    </div>
                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Time</div>
                      <div style={{ fontSize: 13 }}>
                        {formatLocalTime(shift.opened_at)}
                        {shift.closed_at && ` — ${formatLocalTime(shift.closed_at)}`}
                      </div>
                    </div>
                    <div style={{ minWidth: 80 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Duration</div>
                      <div style={{ fontSize: 13 }}>
                        {formatDuration(shift.opened_at, shift.closed_at)}
                      </div>
                    </div>
                    <div>
                      <Badge variant={getStatusVariant(shift.status)}>{shift.status || '—'}</Badge>
                    </div>
                    <div style={{ minWidth: 90, textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ticket Sales</div>
                      <div style={{ fontWeight: 700 }}>{getSales(shift)}</div>
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
                  { label: 'Ticket Sales', value: formatCurrency(reportData.shift?.tickets_total) },
                  { label: 'Expected', value: formatCurrency(reportData.shift?.expected_cash) },
                  { label: 'Cash in Hand', value: formatCurrency(reportData.shift?.cash_in_hand) },
                  { label: 'Difference', value: formatVariance(reportData.shift?.difference ?? 0).text },
                  ...(reportData.shift?.cancels != null
                    ? [{ label: 'Cancels', value: formatCurrency(reportData.shift.cancels) }]
                    : []),
                  { label: 'Whole Books', value: reportData.shift?.whole_book_sales?.length ?? '—' },
                  { label: 'Returned', value: reportData.shift?.returned_books?.length ?? '—' },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Books List */}
            {reportData.shift?.books?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Books ({reportData.shift.books.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reportData.shift.books.map((book, i) => {
                    const remaining = getTicketsRemaining(book.close_position, book.ticket_price)
                    return (
                      <div
                        key={i}
                        onClick={() => handleReportBookClick(book)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: '#F8FAFF',
                          borderRadius: 6,
                          fontSize: 13,
                          gap: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 120 }}>
                          {book.static_code || book.barcode || `Book ${i + 1}`}
                        </span>
                        <span style={{ fontWeight: 600, color: '#0A1128', whiteSpace: 'nowrap', marginLeft: 32 }}>
                          {book.slot_name || '—'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            backgroundColor: book.fully_sold ? '#F1F5F9' : '#DCFCE7',
                            color: book.fully_sold ? '#64748B' : '#16A34A',
                          }}>
                            {book.fully_sold ? 'Sold' : 'Active'}
                          </span>
                          {remaining !== null && remaining > 0 && (
                            <span style={{ fontWeight: 600, color: '#0A1128', whiteSpace: 'nowrap' }}>
                              <span style={{ color: '#DC2626' }}>{remaining}</span> Tickets Left
                            </span>
                          )}
                          {remaining === 0 && (
                            <span style={{ color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              📦 Book Sold
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Whole Book Sales */}
            {reportData.shift?.whole_book_sales?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Whole Book Sales ({reportData.shift.whole_book_sales.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reportData.shift.whole_book_sales.map((book, i) => (
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
                      <Badge variant="gray">Whole Sale</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Returned Books */}
            {reportData.shift?.returned_books?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Returned Books ({reportData.shift.returned_books.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reportData.shift.returned_books.map((book, i) => (
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
                      <Badge variant="amber">Returned</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ticket Breakdown */}
            {reportData.shift?.ticket_breakdown?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Ticket Breakdown
                </h4>
                <div style={{ background: '#F8FAFF', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Source', 'Ticket Price', 'Tickets Sold', 'Subtotal'].map((h) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.shift.ticket_breakdown.map((item, i) => (
                        <tr key={i} style={{ borderBottom: i < reportData.shift.ticket_breakdown.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '8px 12px', textTransform: 'capitalize', fontWeight: 600 }}>{item.source}</td>
                          <td style={{ padding: '8px 12px' }}>{formatCurrency(item.ticket_price)}</td>
                          <td style={{ padding: '8px 12px' }}>{item.tickets_sold}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700 }}>{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Slot Information */}
            {reportData.shift?.slot_information?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Slot Information ({reportData.shift.slot_information.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reportData.shift.slot_information.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#F8FAFF',
                        borderRadius: 8,
                        padding: '12px 14px',
                        borderLeft: '3px solid #1a73e8',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#222' }}>{item.slot_name}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#1a73e8' }}>${item.ticket_price}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                        <div style={{ color: 'var(--text-secondary)' }}>Barcode</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.book_barcode || '—'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Assigned By</div>
                        <div>{item.assigned_by || '—'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Book Assigned</div>
                        <div>{item.assigned_at ? formatLocalTime(item.assigned_at) : '—'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Open Position</div>
                        <div>{item.open_position ?? '—'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Close Position</div>
                        <div>{item.close_position ?? '—'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Tickets Sold</div>
                        <div style={{ fontWeight: 600 }}>{item.tickets_sold}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Subtotal</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>${item.subtotal}</span>
                      </div>
                      {item.is_last_ticket && (
                        <div style={{ marginTop: 6 }}>
                          <Badge variant="green">Last Ticket Sold</Badge>
                        </div>
                      )}
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

      {/* Book Detail Modal */}
      <Modal
        open={!!selectedReportBook}
        onClose={() => { setSelectedReportBook(null); setReportBookDetail(null) }}
        title={`Book — ${selectedReportBook?.static_code || selectedReportBook?.book_barcode || ''}`}
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedReportBook(null); setReportBookDetail(null) }}>
            Close
          </button>
        }
      >
        {loadingBookDetail ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="loading-spinner md" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>Loading book details...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Book Information */}
            <div>
              <h4 style={detailSectionHead}>Book Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                {(() => {
                  const d = reportBookDetail?.book
                  const status = d ? getDetailBookStatus(d) : null
                  return [
                    { label: 'Status', value: status ? <Badge variant={status.variant}>{status.label}</Badge> : '—' },
                    { label: 'Barcode', value: d?.barcode || selectedReportBook?.book_barcode || '—', mono: true },
                    { label: 'Static Code', value: d?.static_code || selectedReportBook?.static_code || '—', mono: true },
                    { label: 'Ticket Price', value: formatCurrency(d?.ticket_price ?? selectedReportBook?.ticket_price) },
                    { label: 'Current Slot', value: selectedReportBook?.slot_name || '—' },
                    { label: 'Created', value: formatDate(d?.created_at) },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                        {item.label}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, fontFamily: item.mono ? 'monospace' : undefined }}>
                        {item.value}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>

            {/* Assignment History */}
            <div>
              <h4 style={detailSectionHead}>
                Assignment History{reportBookDetail?.assignment_history?.length > 0 && ` (${reportBookDetail.assignment_history.length})`}
              </h4>
              {!reportBookDetail?.assignment_history?.length ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '12px 0' }}>No assignment history.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Slot', 'Price', 'Assigned At', 'Assigned By', 'Unassigned At', 'Reason'].map((h) => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportBookDetail.assignment_history.map((entry, i) => (
                        <tr key={entry.assignment_id ?? i} style={{ borderBottom: i < reportBookDetail.assignment_history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={detailTd}>{entry.slot_name || '—'}</td>
                          <td style={detailTd}>{formatCurrency(entry.ticket_price)}</td>
                          <td style={{ ...detailTd, whiteSpace: 'nowrap' }}>{formatLocalDateTime(entry.assigned_at)}</td>
                          <td style={detailTd}>{entry.assigned_by?.username || '—'}</td>
                          <td style={{ ...detailTd, whiteSpace: 'nowrap' }}>
                            {entry.unassigned_at
                              ? formatLocalDateTime(entry.unassigned_at)
                              : <Badge variant="green">Active</Badge>}
                          </td>
                          <td style={detailTd}>
                            {entry.unassign_reason
                              ? <Badge variant={reasonVariant(entry.unassign_reason)}>{unassignReasonLabel(entry.unassign_reason)}</Badge>
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </Modal>
    </div>
  )
}

const detailSectionHead = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 10,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const detailTd = { padding: '8px 10px', verticalAlign: 'top' }
