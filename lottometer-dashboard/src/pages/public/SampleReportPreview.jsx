import StatCard from '../../components/UI/StatCard'
import Badge from '../../components/UI/Badge'

// ── Sample data (mirrors design kit ReportsPage.jsx) ─────────────────────

const TICKETS = [
  { price: 1,  sold: 312, returned: 8,  net: 304, value: 304.00 },
  { price: 2,  sold: 248, returned: 4,  net: 244, value: 488.00 },
  { price: 3,  sold: 187, returned: 3,  net: 184, value: 552.00 },
  { price: 5,  sold:  94, returned: 1,  net:  93, value: 465.00 },
  { price: 10, sold:  62, returned: 0,  net:  62, value: 620.00 },
  { price: 20, sold:  72, returned: 2,  net:  70, value: 1400.00 },
]

const totals = TICKETS.reduce(
  (a, r) => ({ sold: a.sold + r.sold, returned: a.returned + r.returned, net: a.net + r.net, value: a.value + r.value }),
  { sold: 0, returned: 0, net: 0, value: 0 }
)

const cashIn   = totals.value
const cancels  = 24.50
const expected = cashIn - cancels
const counted  = expected + 12.00
const variance = counted - expected

const fmt = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Static sidebar nav ────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',     icon: '📊' },
  { id: 'business-days', label: 'Business Days', icon: '📅' },
  { id: 'shifts',        label: 'Shifts',        icon: '🔄' },
  { id: 'books',         label: 'Books',         icon: '📚' },
  { id: 'slots',         label: 'Slots',         icon: '🎰' },
  { id: 'users',         label: 'Users',         icon: '👥' },
  { id: 'reports',       label: 'Reports',       icon: '📈' },
  { id: 'subscription',  label: 'Subscription',  icon: '💳' },
]

// ── Page ─────────────────────────────────────────────────────────────────

export default function SampleReportPreview() {
  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">
            <span className="lm-wordmark" style={{ fontSize: 20 }}>
              <span>Lotto</span><span>Meter</span>
            </span>
          </div>
          <div className="sidebar-logo-sub">Digital Shift Tracking</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`sidebar-nav-item${item.id === 'reports' ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-nav-item" style={{ marginBottom: 8 }}>
            <span className="nav-icon">⚙️</span>
            <span>Account Settings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--gradient)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>AY</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>aysha</div>
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--blue)',
                background: 'rgba(0,119,204,0.12)', borderRadius: 4,
                padding: '1px 5px', textTransform: 'capitalize', display: 'inline-block', marginTop: 2,
              }}>admin</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => window.close()}>
            🚪 Close Preview
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', paddingTop: 10, opacity: 0.6 }}>
            LottoMeter v2.0
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-title">Reports</div>
        <div className="topbar-right">
          <div style={{ textAlign: 'right' }}>
            <div className="topbar-user-name">aysha</div>
            <div className="topbar-user-meta">LM001</div>
          </div>
          <Badge variant="blue">admin</Badge>
          <div className="topbar-avatar">AY</div>
        </div>
      </header>

      {/* Main content */}
      <main className="page-content">
        <div className="page-inner">

          {/* Demo banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(0,119,204,0.07)', border: '1px solid rgba(0,119,204,0.2)',
            borderRadius: 10, padding: '10px 16px', marginBottom: 24,
            fontSize: 13, color: '#005a9e',
          }}>
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <span>
              <strong>Sample Report</strong> — this is a static demo with example data.
              Real reports are available after signing in.
            </span>
          </div>

          {/* Page header */}
          <div className="page-header">
            <div>
              <h1>Reports</h1>
              <p className="page-header-sub">
                Shift · aysha · Jul 23, 2026 · 06:02 AM → 02:15 PM
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm">📅 Today</button>
              <button className="btn btn-primary btn-sm">📄 Export PDF</button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid-stats" style={{ marginBottom: 24 }}>
            <StatCard label="Gross Sales"   value={fmt(cashIn)}         valueColor="#0A1128" />
            <StatCard label="Cancels"       value={'-' + fmt(cancels)}  valueColor="#EF4444" />
            <StatCard label="Expected Cash" value={fmt(expected)}       valueColor="#0A1128" />
            <StatCard label="Variance"      value={'+' + fmt(variance)} valueColor="#2DAE1A" />
          </div>

          {/* Ticket breakdown */}
          <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div className="stack-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Ticket Breakdown</h2>
              <span className="muted">{totals.net} tickets sold · {totals.returned} returned</span>
            </div>
            <div className="table-wrap" style={{ margin: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Price</th>
                    <th>Sold</th>
                    <th>Returned</th>
                    <th>Net</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {TICKETS.map((row) => (
                    <tr key={row.price}>
                      <td><span style={{ fontWeight: 700 }}>${row.price}.00</span></td>
                      <td>{row.sold}</td>
                      <td>
                        {row.returned > 0
                          ? <span style={{ color: '#D97706', fontWeight: 600 }}>{row.returned}</span>
                          : '0'}
                      </td>
                      <td>{row.net}</td>
                      <td><span style={{ fontWeight: 600, color: '#16A34A' }}>{fmt(row.value)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tick-total-row" style={{ padding: '12px 16px' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Total</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <span style={{ fontWeight: 700 }}>{totals.net} tickets</span>
                <span style={{ fontWeight: 800, color: '#16A34A', fontSize: 15 }}>{fmt(totals.value)}</span>
              </div>
            </div>
          </div>

          {/* Cash reconciliation */}
          <div className="card">
            <div className="stack-row" style={{ marginBottom: 14 }}>
              <h2 className="card-title" style={{ margin: 0 }}>Cash Reconciliation</h2>
              <Badge variant="green">Correct / Over</Badge>
            </div>
            {[
              { label: 'Gross Sales',   note: 'From scans',       value: fmt(cashIn),         bold: false, color: undefined },
              { label: 'Cancels',       note: 'Cancelled draws',  value: '-' + fmt(cancels),  bold: false, color: '#EF4444' },
              { label: 'Expected Cash', note: 'Sales − cancels',  value: fmt(expected),       bold: true,  color: undefined },
              { label: 'Cash Counted',  note: 'Entered at close', value: fmt(counted),        bold: true,  color: undefined },
              { label: 'Difference',    note: 'Over',             value: '+' + fmt(variance), bold: true,  color: '#2DAE1A' },
            ].map((row) => (
              <div key={row.label} className="tick-row" style={{ marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: row.bold ? 700 : 500 }}>{row.label}</div>
                  <div className="muted">{row.note}</div>
                </div>
                <div style={{
                  fontSize: row.bold ? 18 : 16,
                  fontWeight: row.bold ? 800 : 600,
                  color: row.color || 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{row.value}</div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
