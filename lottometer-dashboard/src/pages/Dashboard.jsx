import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTodaysBusinessDay } from '../api/businessDays'
import { listShifts } from '../api/shifts'
import { getBooksSummary } from '../api/books'
import StatCard from '../components/UI/StatCard'
import Table from '../components/UI/Table'
import Badge from '../components/UI/Badge'
import SalesChart from '../components/Charts/SalesChart'
import { formatCurrency, formatVariance } from '../utils/currency'
import { formatDateTime, formatDate } from '../utils/dateTime'

// Mock sales data for last 7 days
function getMockSalesData() {
  const data = []
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    data.push({
      date: `${months[d.getMonth()]} ${d.getDate()}`,
      sales: Math.floor(800 + Math.random() * 1400),
    })
  }
  return data
}

const MOCK_SALES_DATA = getMockSalesData()

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

const SHIFT_COLUMNS = [
  { key: 'shift_number', label: 'Shift #' },
  { key: 'employee', label: 'Employee', render: (_, row) => row.employee?.username || row.employee_name || '—' },
  { key: 'started_at', label: 'Started', render: (v) => formatDateTime(v) },
  { key: 'ended_at', label: 'Ended', render: (v) => v ? formatDateTime(v) : <Badge variant="green">Active</Badge> },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <Badge variant={getShiftStatusVariant(v)}>{v || '—'}</Badge>,
  },
  {
    key: 'total_sales',
    label: 'Sales',
    render: (v) => <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>,
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [todaysBizDay, setTodaysBizDay] = useState(null)
  const [recentShifts, setRecentShifts] = useState([])
  const [booksSummary, setBooksSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.allSettled([
      getTodaysBusinessDay(),
      listShifts({ limit: 5, sort: '-created_at' }),
      getBooksSummary(),
    ]).then(([bizDayResult, shiftsResult, booksResult]) => {
      if (cancelled) return
      if (bizDayResult.status === 'fulfilled') setTodaysBizDay(bizDayResult.value.data)
      if (shiftsResult.status === 'fulfilled') {
        const d = shiftsResult.value.data
        setRecentShifts(Array.isArray(d) ? d : d?.shifts || d?.data || [])
      }
      if (booksResult.status === 'fulfilled') setBooksSummary(booksResult.value.data)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const todayShifts = todaysBizDay
    ? recentShifts.filter((s) => s.business_day_id === todaysBizDay.id)
    : []

  const totalOver = todayShifts
    .filter((s) => s.shift_status === 'over')
    .reduce((sum, s) => sum + Math.abs(parseFloat(s.difference || 0)), 0)

  const totalShort = todayShifts
    .filter((s) => s.shift_status === 'short')
    .reduce((sum, s) => sum + Math.abs(parseFloat(s.difference || 0)), 0)

  const totalSales = todayShifts.reduce((sum, s) => sum + parseFloat(s.gross_sales || 0), 0)

  const variance = totalOver - totalShort
  const varianceInfo = formatVariance(variance)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>
            {greeting()}, {user?.username || 'there'} 👋
          </h1>
          <p className="page-header-sub">{formatDate(new Date().toISOString())}</p>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {todaysBizDay ? (
            <Badge variant={todaysBizDay.status === 'open' ? 'green' : 'gray'}>
              Business Day: {todaysBizDay.status}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          icon="📚"
          label="Active Books"
          value={loading ? '...' : (booksSummary?.active ?? '—')}
        />
        <StatCard
          icon="🔄"
          label="Shifts Today"
          value={loading ? '...' : (todaysBizDay?.shifts_count ?? recentShifts.length ?? '—')}
        />
        <StatCard
          icon="💰"
          label="Total Sales"
          value={loading ? '...' : formatCurrency(totalSales)}
        />
        <StatCard
          icon={varianceInfo.isPositive ? '📈' : varianceInfo.isNegative ? '📉' : '➖'}
          label="Today's Variance"
          value={
            loading ? '...' : (
              <div>
                <span
                  style={{
                    color: variance >= 0 ? '#2DAE1A' : '#EF4444',
                    fontSize: 22,
                    fontWeight: 700,
                    display: 'block',
                  }}
                >
                  {varianceInfo.text}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                  Over: {formatCurrency(totalOver)} | Short: {formatCurrency(totalShort)}
                </span>
              </div>
            )
          }
        />
      </div>

      {/* Sales Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Sales — Last 7 Days</h2>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Daily revenue</span>
        </div>
        <SalesChart data={MOCK_SALES_DATA} />
      </div>

      {/* Recent Shifts */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Shifts</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/dashboard/shifts')}
          >
            View All
          </button>
        </div>
        <Table
          columns={SHIFT_COLUMNS}
          data={recentShifts.slice(0, 5)}
          loading={loading}
          emptyMessage="No shifts found. Start tracking shifts using the mobile app."
        />
      </div>

      {/* Quick Actions */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/dashboard/business-days')}
        >
          📅 View Business Days
        </button>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/dashboard/reports')}
        >
          📈 View Reports
        </button>
      </div>
    </div>
  )
}
