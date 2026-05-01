import { useState, useCallback } from 'react'
import { listBooks, getBooksSummary } from '../api/books'
import useApi from '../hooks/useApi'
import Badge from '../components/UI/Badge'
import Table from '../components/UI/Table'
import { formatDate } from '../utils/dateTime'
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

const PAGE_SIZE = 20

export default function Books() {
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [page, setPage] = useState(1)

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Books</h1>
          <p className="page-header-sub">Manage lottery ticket books inventory</p>
        </div>
      </div>

      {/* Summary chips */}
      {summaryData && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          {[
            { label: 'Total', value: summaryData.total_count ?? summaryData.total, color: 'var(--text-primary)' },
            { label: 'Active', value: summaryData.active_count ?? summaryData.active, color: 'var(--green)' },
            { label: 'Sold', value: summaryData.sold_count ?? summaryData.sold, color: 'var(--text-secondary)' },
            { label: 'Returned', value: summaryData.returned_count ?? summaryData.returned, color: 'var(--amber)' },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{chip.label}:</span>
              <span style={{ fontWeight: 700, color: chip.color }}>{chip.value ?? '—'}</span>
            </div>
          ))}
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

      <div className="card" style={{ padding: 0 }}>
        <Table
          columns={columns}
          data={books}
          loading={loading}
          emptyMessage="No books found. Books are created when scanned using the mobile app."
        />
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
    </div>
  )
}
