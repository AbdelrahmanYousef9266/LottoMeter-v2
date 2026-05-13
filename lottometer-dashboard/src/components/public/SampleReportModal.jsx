import { useEffect } from 'react'
import StatCard from '../UI/StatCard'
import Badge from '../UI/Badge'

const TICKETS = [
  { price: 1,  sold: 312, returned: 8, net: 304, value: 304.00 },
  { price: 2,  sold: 248, returned: 4, net: 244, value: 488.00 },
  { price: 3,  sold: 187, returned: 3, net: 184, value: 552.00 },
  { price: 5,  sold:  94, returned: 1, net:  93, value: 465.00 },
  { price: 10, sold:  62, returned: 0, net:  62, value: 620.00 },
  { price: 20, sold:  72, returned: 2, net:  70, value: 1400.00 },
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

export default function SampleReportModal({ open, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,17,40,0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-primary, #F6FAFF)',
        borderRadius: 16,
        width: '100%', maxWidth: 860,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        border: '1px solid var(--border, #E2EAF4)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border, #E2EAF4)',
          background: '#fff',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0A1128' }}>Sample Shift Report</h2>
              <Badge variant="green">correct</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#46627F' }}>
              Shift · aysha · Jul 23, 2026 · 06:02 AM → 02:15 PM
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#46627F',
              background: '#F0F7FF', border: '1px solid #D1E8F8',
              borderRadius: 6, padding: '4px 10px',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Demo — no real data
            </span>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid #E2EAF4',
                background: '#fff', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#46627F',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Stat cards */}
          <div className="grid-stats">
            <StatCard label="Gross Sales"    value={fmt(cashIn)}   valueColor="#0A1128" />
            <StatCard label="Cancels"        value={'-' + fmt(cancels)}   valueColor="#EF4444" />
            <StatCard label="Expected Cash"  value={fmt(expected)} valueColor="#0A1128" />
            <StatCard label="Variance"       value={'+' + fmt(variance)}  valueColor="#2DAE1A" />
          </div>

          {/* Ticket breakdown */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="stack-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Ticket Breakdown</h3>
              <span className="muted">{totals.net} tickets sold · {totals.returned} returned</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFF', borderBottom: '1px solid var(--border)' }}>
                    {['Price', 'Sold', 'Returned', 'Net', 'Subtotal'].map((h) => (
                      <th key={h} style={{
                        padding: '9px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: '#46627F',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TICKETS.map((row, i) => (
                    <tr key={row.price} style={{ borderBottom: i < TICKETS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 700 }}>${row.price}.00</td>
                      <td style={{ padding: '10px 16px' }}>{row.sold}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {row.returned > 0
                          ? <span style={{ color: '#D97706', fontWeight: 600 }}>{row.returned}</span>
                          : '0'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>{row.net}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#16A34A' }}>{fmt(row.value)}</td>
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
              <h3 className="card-title" style={{ margin: 0 }}>Cash Reconciliation</h3>
              <Badge variant="green">Correct / Over</Badge>
            </div>
            {[
              { label: 'Gross Sales',   note: 'From scans',       value: fmt(cashIn),                bold: false, color: undefined },
              { label: 'Cancels',       note: 'Cancelled draws',  value: '-' + fmt(cancels),          bold: false, color: '#EF4444' },
              { label: 'Expected Cash', note: 'Sales − cancels',  value: fmt(expected),              bold: true,  color: undefined },
              { label: 'Cash Counted',  note: 'Entered at close', value: fmt(counted),               bold: true,  color: undefined },
              { label: 'Difference',    note: 'Over',             value: '+' + fmt(variance),        bold: true,  color: '#2DAE1A' },
            ].map((row) => (
              <div key={row.label} className="tick-row" style={{ marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: row.bold ? 700 : 500 }}>{row.label}</div>
                  <div className="muted">{row.note}</div>
                </div>
                <div style={{
                  fontSize: row.bold ? 18 : 16,
                  fontWeight: row.bold ? 800 : 600,
                  color: row.color || 'var(--text-primary, #0A1128)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{row.value}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
