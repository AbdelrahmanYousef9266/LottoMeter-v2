import { useState, useCallback } from 'react'
import { listBooks, getBooksSummary, getBookDetail } from '../api/books'
import useApi from '../hooks/useApi'
import Badge from '../components/UI/Badge'
import StatCard from '../components/UI/StatCard'
import Table from '../components/UI/Table'
import Modal from '../components/UI/Modal'
import { formatDate, formatLocalDateTime } from '../utils/dateTime'
import { formatCurrency } from '../utils/currency'

function getBookStatus(book) {
  if (book.returned_at) return 'Returned'
  if (book.is_sold) return 'Sold'
  if (book.is_active) return 'Active'
  return 'Inactive'
}

function getStatusVariant(status) {
  switch (status) {
    case 'Active': return 'green'
    case 'Sold': return 'gray'
    case 'Returned': return 'amber'
    case 'Inactive': return 'red'
    default: return 'gray'
  }
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

const PAGE_SIZE = 20

export default function Books() {
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [page, setPage] = useState(1)

  const [selectedBook, setSelectedBook] = useState(null)
  const [bookDetail, setBookDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const summaryFn = useCallback(() => getBooksSummary(), [])
  const { data: summaryData } = useApi(summaryFn)

  const booksFn = useCallback(
    () => listBooks({ search: activeSearch || undefined, page, limit: PAGE_SIZE }),
    [activeSearch, page]
  )
  const { data: booksData, loading, error } = useApi(booksFn)

  const books = Array.isArray(booksData) ? booksData : booksData?.books || booksData?.data || []
  const total = booksData?.total || books.length
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  const handleSearch = () => {
    setActiveSearch(search)
    setPage(1)
  }

  const handleClear = () => {
    setSearch('')
    setActiveSearch('')
    setPage(1)
  }

  const handleBookClick = async (book) => {
    setSelectedBook(book)
    setBookDetail(null)
    setLoadingDetail(true)
    try {
      const res = await getBookDetail(book.book_id)
      setBookDetail(res.data)
    } catch {
      setBookDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeModal = () => {
    setSelectedBook(null)
    setBookDetail(null)
  }

  const columns = [
    {
      key: 'static_code',
      label: 'Barcode',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'slot',
      label: 'Slot',
      render: (v, row) => row.slot?.slot_name || row.slot_name || v || '—',
    },
    {
      key: 'ticket_price',
      label: 'Ticket Price',
      render: (v, row) => formatCurrency(v ?? row.slot?.ticket_price),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => {
        const status = getBookStatus(row)
        return <Badge variant={getStatusVariant(status)}>{status}</Badge>
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (v) => formatDate(v),
    },
  ]

  const detail = bookDetail?.book
  const history = bookDetail?.assignment_history || []
  const status = selectedBook ? getBookStatus(selectedBook) : null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Books</h1>
          <p className="page-header-sub">Manage lottery ticket books inventory</p>
        </div>
      </div>

      {/* Stat Cards */}
      {summaryData && (
        <div className="grid-stats">
          <StatCard icon="📚" label="Total Books" value={summaryData.total_count ?? summaryData.total} />
          <StatCard icon="✅" label="Active" value={summaryData.active_count ?? summaryData.active} />
          <StatCard icon="💲" label="Sold" value={summaryData.sold_count ?? summaryData.sold} />
          <StatCard icon="↩️" label="Returned" value={summaryData.returned_count ?? summaryData.returned} />
        </div>
      )}

            {/* Search */}
      <div
        className="card"
        style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
          <label className="form-label">Search by Barcode</label>
          <input
            className="input-field"
            placeholder="Enter barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSearch}>Search</button>
        {activeSearch && (
          <button className="btn btn-secondary btn-sm" onClick={handleClear}>Clear</button>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>Error: {error}</div>
      )}

      <div className="card" style={{ paddingBottom: 0 }}>
        <div className="stack-row">
          <h2 className="card-title">Book Inventory</h2>
          {!loading && books.length > 0 && (
            <span className="muted">{total} total</span>
          )}
        </div>
        <div style={{ margin: '0 -20px' }}>
          <Table
            columns={columns}
            data={books}
            loading={loading}
            emptyMessage="No books found. Books are created when scanned using the mobile app."
            onRowClick={handleBookClick}
          />
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            marginTop: 20,
          }}
        >
          <button
            className="btn btn-secondary btn-sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Book Detail Modal */}
      <Modal
        open={!!selectedBook}
        onClose={closeModal}
        title={`Book — ${selectedBook?.barcode || selectedBook?.static_code || ''}`}
        footer={
          <button className="btn btn-secondary btn-sm" onClick={closeModal}>
            Close
          </button>
        }
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="loading-spinner md" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              Loading book details...
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Section 1 — Book Information */}
            <div>
              <h4 style={sectionHeadStyle}>Book Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                {[
                  {
                    label: 'Status',
                    value: status ? <Badge variant={getStatusVariant(status)}>{status}</Badge> : '—',
                  },
                  { label: 'Barcode', value: selectedBook?.barcode || '—', mono: true },
                  { label: 'Static Code', value: selectedBook?.static_code || detail?.static_code || '—', mono: true },
                  { label: 'Ticket Price', value: formatCurrency(detail?.ticket_price ?? selectedBook?.ticket_price) },
                  {
                    label: 'Current Slot',
                    value: selectedBook?.slot_name || selectedBook?.slot?.slot_name || '—',
                  },
                  { label: 'Created', value: formatDate(selectedBook?.created_at) },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, fontFamily: item.mono ? 'monospace' : undefined }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2 — Assignment History */}
            <div>
              <h4 style={sectionHeadStyle}>
                Assignment History {history.length > 0 && `(${history.length})`}
              </h4>
              {history.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '12px 0' }}>
                  No assignment history.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Slot', 'Price', 'Assigned At', 'Assigned By', 'Unassigned At', 'Reason'].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '6px 10px',
                              textAlign: 'left',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-secondary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry, i) => (
                        <tr
                          key={entry.assignment_id ?? i}
                          style={{ borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}
                        >
                          <td style={tdStyle}>{entry.slot_name || '—'}</td>
                          <td style={tdStyle}>{formatCurrency(entry.ticket_price)}</td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatLocalDateTime(entry.assigned_at)}</td>
                          <td style={tdStyle}>{entry.assigned_by?.username || '—'}</td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            {entry.unassigned_at ? formatLocalDateTime(entry.unassigned_at) : (
                              <Badge variant="green">Active</Badge>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {entry.unassign_reason
                              ? <Badge variant={reasonVariant(entry.unassign_reason)}>{unassignReasonLabel(entry.unassign_reason)}</Badge>
                              : '—'
                            }
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

function reasonVariant(reason) {
  switch (reason) {
    case 'sold': return 'gray'
    case 'returned_to_vendor': return 'amber'
    case 'reassigned': return 'blue'
    default: return 'gray'
  }
}

const sectionHeadStyle = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 10,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const tdStyle = {
  padding: '8px 10px',
  verticalAlign: 'top',
}
