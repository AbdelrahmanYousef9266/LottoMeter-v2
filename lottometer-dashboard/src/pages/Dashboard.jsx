import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTodaysBusinessDay, getBusinessDayTicketBreakdown } from '../api/businessDays'
import { listShifts } from '../api/shifts'
import { getBooksSummary } from '../api/books'
import StatCard from '../components/UI/StatCard'
import Table from '../components/UI/Table'
import Badge from '../components/UI/Badge'
import SalesChart from '../components/Charts/SalesChart'
import { formatCurrency, formatVariance } from '../utils/currency'
import { formatLocalTime, formatLocalDate } from '../utils/dateTime'

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
  { key: 'started_at', label: 'Started', render: (v) => formatLocalTime(v) },
  { key: 'ended_at', label: 'Ended', render: (v) => v ? formatLocalTime(v) : <Badge variant="green">Active</Badge> },
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
  const [ticketBreakdown, setTicketBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.allSettled([
      getTodaysBusinessDay(),
      getBooksSummary(),
    ]).then(async ([bizDayResult, booksResult]) => {
      if (cancelled) return

      let bizDay = null
      if (bizDayResult.status === 'fulfilled') {
        const d = bizDayResult.value.data
        bizDay = d?.business_day || d
        setTodaysBizDay(bizDay)
      }
      if (booksResult.status === 'fulfilled') setBooksSummary(booksResult.value.data)

      if (bizDay?.id) {
        try {
          const [shiftsRes, breakdownRes] = await Promise.allSettled([
            listShifts({ business_day_id: bizDay.id }),
            getBusinessDayTicketBreakdown(bizDay.id),
          ])
          if (!cancelled) {
            if (shiftsRes.status === 'fulfilled') {
              const d = shiftsRes.value.data
              setRecentShifts(Array.isArray(d) ? d : d?.shifts || d?.data || [])
            }
            if (breakdownRes.status === 'fulfilled') {
              setTicketBreakdown(breakdownRes.value.data)
            }
          }
        } catch {}
      }

      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const closedShifts = recentShifts.filter((s) => s.status === 'closed' && !s.voided)

  const totalOver = closedShifts
    .filter((s) => s.shift_status === 'over')
    .reduce((sum, s) => sum + Math.abs(parseFloat(s.difference || 0)), 0)

  const totalShort = closedShifts
    .filter((s) => s.shift_status === 'short')
    .reduce((sum, s) => sum + Math.abs(parseFloat(s.difference || 0)), 0)

  const totalSales = recentShifts.reduce((sum, s) => sum + parseFloat(s.tickets_total || 0), 0)

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
          <p className="page-header-sub">{formatLocalDate(new Date().toISOString())}</p>
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
      <div className="grid-stats">
        <StatCard
          icon="📚"
          label="Active Books"
          value={loading ? '...' : (booksSummary?.active ?? '—')}
        />
        <StatCard
          icon="🔄"
          label="Shifts Today"
          value={loading ? '...' : recentShifts.length}
        />
        <StatCard
          icon="💰"
          label="Ticket Sales"
          value={loading ? '...' : formatCurrency(totalSales)}
        />
        <StatCard
          icon={varianceInfo.isPositive ? '📈' : varianceInfo.isNegative ? '📉' : '➖'}
          label="Today's Variance"
          value={loading ? '...' : varianceInfo.text}
          valueColor={variance > 0 ? '#2DAE1A' : variance < 0 ? '#EF4444' : undefined}
        />
      </div>

      {/* Sales Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="stack-row">
          <h2 className="card-title">Sales — Last 7 Days</h2>
          <span className="muted">Daily revenue</span>
        </div>
        <SalesChart data={MOCK_SALES_DATA} />
      </div>

      {/* Ticket Breakdown */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="stack-row">
          <h2 className="card-title">Tickets Sold Today</h2>
          {ticketBreakdown && !loading && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {ticketBreakdown.total_tickets} tickets &middot; {formatCurrency(parseFloat(ticketBreakdown.total_value))}
            </span>
          )}
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</div>
        ) : !ticketBreakdown || ticketBreakdown.breakdown.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No tickets sold today.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ticketBreakdown.breakdown.map((row) => (
              <div key={row.ticket_price} className="tick-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, minWidth: 52 }}>
                    {formatCurrency(parseFloat(row.ticket_price))}
                  </span>
                  <span className="muted">tickets</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>
                    {row.tickets_sold}
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>sold</span>
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#16A34A', minWidth: 72, textAlign: 'right' }}>
                    {formatCurrency(parseFloat(row.subtotal))}
                  </span>
                </div>
              </div>
            ))}
            <div className="tick-total-row">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Total</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 18 }}>
                  {ticketBreakdown.total_tickets}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>tickets</span>
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#16A34A', minWidth: 72, textAlign: 'right' }}>
                  {formatCurrency(parseFloat(ticketBreakdown.total_value))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Shifts */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="stack-row">
          <h2 className="card-title">Recent Shifts</h2>
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
