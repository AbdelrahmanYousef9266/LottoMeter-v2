import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listFulfillmentOrders,
  getFulfillmentOrder,
  updateFulfillmentOrder,
  addFulfillmentNote,
  getFulfillmentSummary,
} from '../../api/superadmin'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_STATES = [
  'application_received',
  'payment_link_sent',
  'paid_awaiting_order',
  'device_ordered',
  'device_received_provisioning',
  'ready_to_ship',
  'shipped',
  'delivered',
  'active',
  'cancelled',
]

const KANBAN_STATES = ALL_STATES.filter(s => s !== 'cancelled')

const STATE_LABEL = {
  application_received:         'Application',
  payment_link_sent:            'Link Sent',
  paid_awaiting_order:          'Paid – Pending Order',
  device_ordered:               'Device Ordered',
  device_received_provisioning: 'Provisioning',
  ready_to_ship:                'Ready to Ship',
  shipped:                      'Shipped',
  delivered:                    'Delivered',
  active:                       'Active',
  cancelled:                    'Cancelled',
}

const STATE_COLOR = {
  application_received:         '#6366F1',
  payment_link_sent:            '#F59E0B',
  paid_awaiting_order:          '#3B82F6',
  device_ordered:               '#8B5CF6',
  device_received_provisioning: '#EC4899',
  ready_to_ship:                '#14B8A6',
  shipped:                      '#F97316',
  delivered:                    '#10B981',
  active:                       '#22C55E',
  cancelled:                    '#9CA3AF',
}

const ALLOWED_TRANSITIONS = {
  application_received:         ['payment_link_sent', 'cancelled'],
  payment_link_sent:            ['paid_awaiting_order', 'cancelled'],
  paid_awaiting_order:          ['device_ordered', 'cancelled'],
  device_ordered:               ['device_received_provisioning', 'cancelled'],
  device_received_provisioning: ['ready_to_ship', 'cancelled'],
  ready_to_ship:                ['shipped', 'cancelled'],
  shipped:                      ['delivered', 'cancelled'],
  delivered:                    ['active', 'cancelled'],
  active:                       ['cancelled'],
  cancelled:                    [],
}

const POLL_INTERVAL = 30_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDatetime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function relTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StateBadge({ state, small }) {
  return (
    <span style={{
      background: STATE_COLOR[state] + '22',
      color: STATE_COLOR[state],
      border: `1px solid ${STATE_COLOR[state]}44`,
      borderRadius: 999,
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      padding: small ? '1px 7px' : '2px 10px',
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      {STATE_LABEL[state] ?? state}
    </span>
  )
}

function KanbanCard({ order, onClick }) {
  return (
    <div
      onClick={() => onClick(order)}
      style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
        marginBottom: 8,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: '#111' }}>
        {order.business_name || order.full_name}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
        {order.full_name} · {order.email}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{relTime(order.created_at)}</span>
        {order.state_abbr && (
          <span style={{ fontSize: 10, background: '#F3F4F6', borderRadius: 4, padding: '1px 5px', color: '#6B7280' }}>
            {order.state_abbr}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ state, orders, onCardClick }) {
  const color = STATE_COLOR[state]
  return (
    <div style={{
      minWidth: 220,
      maxWidth: 220,
      flexShrink: 0,
      background: '#F9FAFB',
      borderRadius: 10,
      padding: '10px 8px',
      border: `1px solid #E5E7EB`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10, padding: '0 4px',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 12, color: '#374151', flex: 1 }}>
          {STATE_LABEL[state]}
        </span>
        <span style={{
          background: color + '22', color: color,
          borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px',
        }}>
          {orders.length}
        </span>
      </div>
      <div style={{ minHeight: 60 }}>
        {orders.map(o => (
          <KanbanCard key={o.id} order={o} onClick={onCardClick} />
        ))}
        {orders.length === 0 && (
          <div style={{ color: '#D1D5DB', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
            Empty
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function OrderDrawer({ orderId, onClose, onUpdated }) {
  const [order, setOrder]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [noteText, setNoteText]     = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [modal, setModal]           = useState(null) // { type: 'transition'|'edit', ... }
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getFulfillmentOrder(orderId)
      .then(r => { setOrder(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [orderId])

  useEffect(() => { load() }, [load])

  const handleTransition = async (newState, extra = {}) => {
    setSaving(true)
    setErr('')
    try {
      const res = await updateFulfillmentOrder(orderId, { state: newState, ...extra })
      setOrder(res.data)
      setModal(null)
      onUpdated(res.data)
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update.')
    } finally {
      setSaving(false)
    }
  }

  const handlePatch = async (fields) => {
    setSaving(true)
    setErr('')
    try {
      const res = await updateFulfillmentOrder(orderId, fields)
      setOrder(res.data)
      setModal(null)
      onUpdated(res.data)
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update.')
    } finally {
      setSaving(false)
    }
  }

  const handleNote = async () => {
    if (!noteText.trim()) return
    setNoteSaving(true)
    try {
      const res = await addFulfillmentNote(orderId, noteText.trim())
      setOrder(prev => ({ ...prev, notes: res.data.notes }))
      setNoteText('')
    } catch {
      // silent
    } finally {
      setNoteSaving(false)
    }
  }

  if (loading) return (
    <DrawerShell onClose={onClose}>
      <div style={{ padding: 32, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div>
    </DrawerShell>
  )

  if (!order) return (
    <DrawerShell onClose={onClose}>
      <div style={{ padding: 32, color: '#EF4444', textAlign: 'center' }}>Not found.</div>
    </DrawerShell>
  )

  const transitions = ALLOWED_TRANSITIONS[order.state] || []

  return (
    <DrawerShell onClose={onClose}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
              {order.business_name || order.full_name}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
              {order.full_name} · {order.email}
            </div>
          </div>
          <StateBadge state={order.state} />
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
          Order #{order.id} · Created {fmtDate(order.created_at)}
        </div>
      </div>

      {err && (
        <div style={{ margin: '12px 24px', padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#DC2626', fontSize: 12 }}>
          {err}
        </div>
      )}

      {/* Transition buttons */}
      {transitions.length > 0 && (
        <div style={{ padding: '14px 24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Move to
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {transitions.map(s => (
              <button
                key={s}
                disabled={saving}
                onClick={() => {
                  if (s === 'payment_link_sent') { setModal({ type: 'payment_link', toState: s }); return }
                  if (s === 'shipped')            { setModal({ type: 'shipped', toState: s }); return }
                  handleTransition(s)
                }}
                style={{
                  background: s === 'cancelled' ? '#FEF2F2' : STATE_COLOR[s] + '18',
                  color: s === 'cancelled' ? '#DC2626' : STATE_COLOR[s],
                  border: `1px solid ${s === 'cancelled' ? '#FECACA' : STATE_COLOR[s] + '44'}`,
                  borderRadius: 6, fontSize: 11, fontWeight: 600,
                  padding: '4px 12px', cursor: 'pointer',
                }}
              >
                → {STATE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
        <Section title="Contact">
          <Row label="Phone"    value={order.phone || '—'} />
          <Row label="State"    value={order.state_abbr || '—'} />
          <Row label="Business" value={order.business_name || '—'} />
        </Section>

        <Section title="Shipping Address">
          <Row label="Name"     value={order.shipping_name || '—'} />
          <Row label="Address"  value={[order.shipping_address, order.shipping_address2].filter(Boolean).join(', ') || '—'} />
          <Row label="City"     value={order.shipping_city || '—'} />
          <Row label="State"    value={order.shipping_state || '—'} />
          <Row label="ZIP"      value={order.shipping_zip || '—'} />
        </Section>

        <Section title="Operational">
          <Row label="Payment Link" value={
            order.payment_link
              ? <a href={order.payment_link} target="_blank" rel="noopener noreferrer" style={{ color: '#7C3AED', fontSize: 11 }}>{order.payment_link}</a>
              : <span style={{ color: '#9CA3AF' }}>—</span>
          } />
          <Row label="Tracking #"  value={order.tracking_number || '—'} />
          <Row label="Device S/N"  value={order.device_serial || '—'} />
          <button
            onClick={() => setModal({ type: 'edit_ops' })}
            style={{ fontSize: 11, color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}
          >
            Edit operational fields →
          </button>
        </Section>

        <Section title="Timeline">
          {[
            ['Created',              order.created_at],
            ['Link sent',            order.payment_link_sent_at],
            ['Paid',                 order.paid_at],
            ['Device ordered',       order.device_ordered_at],
            ['Device received',      order.device_received_at],
            ['Ready to ship',        order.ready_to_ship_at],
            ['Shipped',              order.shipped_at],
            ['Delivered',            order.delivered_at],
            ['Activated',            order.activated_at],
            ['Cancelled',            order.cancelled_at],
          ].filter(([, v]) => v).map(([label, value]) => (
            <Row key={label} label={label} value={fmtDatetime(value)} />
          ))}
        </Section>

        {order.submission && (
          <Section title="Application">
            <Row label="Heard via"    value={order.submission.how_heard || '—'} />
            <Row label="Employees"    value={order.submission.num_employees || '—'} />
            {order.submission.message && (
              <div style={{ fontSize: 12, color: '#374151', background: '#F9FAFB', borderRadius: 6, padding: '8px 10px', marginTop: 6 }}>
                {order.submission.message}
              </div>
            )}
          </Section>
        )}

        {/* Notes */}
        <Section title="Notes">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={3}
            style={{
              width: '100%', resize: 'vertical', fontSize: 12,
              border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px',
              fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleNote}
            disabled={noteSaving || !noteText.trim()}
            style={{
              marginTop: 6, fontSize: 11, fontWeight: 600,
              background: '#7C3AED', color: '#fff',
              border: 'none', borderRadius: 6, padding: '5px 14px',
              cursor: noteSaving || !noteText.trim() ? 'not-allowed' : 'pointer',
              opacity: noteSaving || !noteText.trim() ? 0.6 : 1,
            }}
          >
            {noteSaving ? 'Saving…' : 'Add note'}
          </button>
          {order.notes && (
            <pre style={{
              marginTop: 10, fontSize: 11, color: '#374151',
              background: '#F9FAFB', borderRadius: 6, padding: '8px 10px',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto',
            }}>
              {order.notes}
            </pre>
          )}
        </Section>
      </div>

      {/* Modals */}
      {modal?.type === 'payment_link' && (
        <PaymentLinkModal
          order={order}
          saving={saving}
          onConfirm={(link) => handleTransition('payment_link_sent', { payment_link: link })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'shipped' && (
        <ShippedModal
          saving={saving}
          onConfirm={(tracking) => handleTransition('shipped', { tracking_number: tracking })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit_ops' && (
        <EditOpsModal
          order={order}
          saving={saving}
          onConfirm={(fields) => handlePatch(fields)}
          onClose={() => setModal(null)}
        />
      )}
    </DrawerShell>
  )
}

function DrawerShell({ children, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)', zIndex: 400,
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 480, background: '#fff',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
        zIndex: 401, display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: '#F3F4F6', border: 'none', borderRadius: '50%',
            width: 28, height: 28, cursor: 'pointer',
            fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
        {children}
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#6B7280', minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#111' }}>{value}</span>
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function PaymentLinkModal({ order, saving, onConfirm, onClose }) {
  const [link, setLink] = useState(order.payment_link || '')

  const emailTemplate = `Hi ${order.full_name},

Thank you for applying to join LottoMeter! We're excited to get you set up.

To complete your enrollment, please use the payment link below to submit your one-time setup fee of $149:

${link || '[PASTE PAYMENT LINK HERE]'}

Once payment is received, we'll begin preparing your device and be in touch with shipping details.

If you have any questions, feel free to reply to this email.

Best,
The LottoMeter Team`

  const [copied, setCopied] = useState(false)
  const copyTemplate = () => {
    navigator.clipboard.writeText(emailTemplate).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Send Payment Link</div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
        Payment link URL
      </label>
      <input
        value={link}
        onChange={e => setLink(e.target.value)}
        placeholder="https://buy.stripe.com/..."
        style={{
          width: '100%', fontSize: 12, padding: '7px 10px',
          border: '1px solid #D1D5DB', borderRadius: 6, boxSizing: 'border-box', marginBottom: 14,
        }}
      />
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        Email template
      </div>
      <pre style={{
        fontSize: 11, background: '#F9FAFB', border: '1px solid #E5E7EB',
        borderRadius: 6, padding: '10px 12px', whiteSpace: 'pre-wrap', marginBottom: 8,
        maxHeight: 220, overflowY: 'auto',
      }}>
        {emailTemplate}
      </pre>
      <button
        onClick={copyTemplate}
        style={{
          fontSize: 11, fontWeight: 600, background: '#F3F4F6',
          border: '1px solid #E5E7EB', borderRadius: 6,
          padding: '5px 12px', cursor: 'pointer', marginBottom: 16, color: '#374151',
        }}
      >
        {copied ? '✓ Copied!' : 'Copy email'}
      </button>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
        <button
          onClick={() => onConfirm(link)}
          disabled={saving}
          style={btnPrimary(saving)}
        >
          {saving ? 'Saving…' : 'Mark link sent'}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ShippedModal({ saving, onConfirm, onClose }) {
  const [tracking, setTracking] = useState('')
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Mark as Shipped</div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
        Tracking number
      </label>
      <input
        value={tracking}
        onChange={e => setTracking(e.target.value)}
        placeholder="1Z999AA10123456784"
        style={{
          width: '100%', fontSize: 12, padding: '7px 10px',
          border: '1px solid #D1D5DB', borderRadius: 6, boxSizing: 'border-box', marginBottom: 16,
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
        <button
          onClick={() => onConfirm(tracking)}
          disabled={saving}
          style={btnPrimary(saving)}
        >
          {saving ? 'Saving…' : 'Mark shipped'}
        </button>
      </div>
    </ModalOverlay>
  )
}

function EditOpsModal({ order, saving, onConfirm, onClose }) {
  const [fields, setFields] = useState({
    tracking_number:  order.tracking_number  || '',
    payment_link:     order.payment_link     || '',
    device_serial:    order.device_serial    || '',
    shipping_name:    order.shipping_name    || '',
    shipping_address: order.shipping_address || '',
    shipping_address2:order.shipping_address2|| '',
    shipping_city:    order.shipping_city    || '',
    shipping_state:   order.shipping_state   || '',
    shipping_zip:     order.shipping_zip     || '',
  })
  const set = (k, v) => setFields(f => ({ ...f, [k]: v }))

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Edit Details</div>
      {[
        ['Tracking #',       'tracking_number'],
        ['Payment link',     'payment_link'],
        ['Device serial',    'device_serial'],
        ['Ship to name',     'shipping_name'],
        ['Ship address',     'shipping_address'],
        ['Ship address 2',   'shipping_address2'],
        ['Ship city',        'shipping_city'],
        ['Ship state',       'shipping_state'],
        ['Ship ZIP',         'shipping_zip'],
      ].map(([label, key]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>
            {label}
          </label>
          <input
            value={fields[key]}
            onChange={e => set(key, e.target.value)}
            style={{
              width: '100%', fontSize: 12, padding: '6px 9px',
              border: '1px solid #D1D5DB', borderRadius: 6, boxSizing: 'border-box',
            }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
        <button
          onClick={() => onConfirm(fields)}
          disabled={saving}
          style={btnPrimary(saving)}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ModalOverlay({ children, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#fff', borderRadius: 12,
        padding: '24px 28px', width: 480, maxWidth: '95vw',
        maxHeight: '90vh', overflowY: 'auto',
        zIndex: 501, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {children}
      </div>
    </>
  )
}

const btnPrimary = (disabled) => ({
  background: disabled ? '#C4B5FD' : '#7C3AED',
  color: '#fff', border: 'none', borderRadius: 6,
  padding: '7px 18px', fontSize: 12, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const btnSecondary = {
  background: '#F3F4F6', color: '#374151',
  border: '1px solid #E5E7EB', borderRadius: 6,
  padding: '7px 18px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FulfillmentPage() {
  const [ordersByState, setOrdersByState] = useState({})
  const [loading, setLoading]             = useState(true)
  const [selectedId, setSelectedId]       = useState(null)
  const [filterState, setFilterState]     = useState('') // '' = all active states
  const [showCancelled, setShowCancelled] = useState(false)
  const [summary, setSummary]             = useState(null)
  const pollRef = useRef(null)

  const loadOrders = useCallback(async () => {
    try {
      const statesToFetch = filterState
        ? [filterState]
        : showCancelled
          ? KANBAN_STATES.concat(['cancelled'])
          : KANBAN_STATES

      const results = await Promise.all(
        statesToFetch.map(s => listFulfillmentOrders({ state: s, limit: 100 }))
      )
      const byState = {}
      statesToFetch.forEach((s, i) => {
        byState[s] = results[i].data.orders
      })
      setOrdersByState(byState)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [filterState, showCancelled])

  const loadSummary = useCallback(() => {
    getFulfillmentSummary()
      .then(r => setSummary(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    loadOrders()
    loadSummary()
    pollRef.current = setInterval(() => {
      loadOrders()
      loadSummary()
    }, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [loadOrders, loadSummary])

  const handleUpdated = useCallback((updatedOrder) => {
    setOrdersByState(prev => {
      const next = { ...prev }
      // Remove from all columns
      ALL_STATES.forEach(s => {
        if (next[s]) next[s] = next[s].filter(o => o.id !== updatedOrder.id)
      })
      // Insert into correct column if we're showing it
      if (next[updatedOrder.state] !== undefined) {
        next[updatedOrder.state] = [updatedOrder, ...(next[updatedOrder.state] || [])]
      }
      return next
    })
    loadSummary()
  }, [loadSummary])

  const displayedStates = filterState
    ? [filterState]
    : showCancelled
      ? [...KANBAN_STATES, 'cancelled']
      : KANBAN_STATES

  const activeTotal = summary?.active_total ?? 0

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: '#F9FAFB' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>
            Fulfillment
            {activeTotal > 0 && (
              <span style={{
                marginLeft: 10, background: '#7C3AED', color: '#fff',
                borderRadius: 999, fontSize: 12, fontWeight: 700,
                padding: '2px 9px', verticalAlign: 'middle',
              }}>{activeTotal}</span>
            )}
          </h1>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            Device fulfillment pipeline
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
            style={{
              fontSize: 12, padding: '5px 10px',
              border: '1px solid #D1D5DB', borderRadius: 6,
              background: '#fff', color: '#374151',
            }}
          >
            <option value="">All active states</option>
            {ALL_STATES.map(s => (
              <option key={s} value={s}>{STATE_LABEL[s]}</option>
            ))}
          </select>
          <label style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={e => setShowCancelled(e.target.checked)}
            />
            Show cancelled
          </label>
        </div>
      </div>

      {/* Summary chips */}
      {summary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {KANBAN_STATES.map(s => {
            const cnt = summary.counts?.[s] ?? 0
            if (cnt === 0) return null
            return (
              <button
                key={s}
                onClick={() => setFilterState(f => f === s ? '' : s)}
                style={{
                  background: filterState === s ? STATE_COLOR[s] : STATE_COLOR[s] + '18',
                  color: filterState === s ? '#fff' : STATE_COLOR[s],
                  border: `1px solid ${STATE_COLOR[s]}44`,
                  borderRadius: 999, fontSize: 11, fontWeight: 700,
                  padding: '3px 10px', cursor: 'pointer',
                }}
              >
                {STATE_LABEL[s]} {cnt}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
            {displayedStates.map(s => (
              <KanbanColumn
                key={s}
                state={s}
                orders={ordersByState[s] || []}
                onCardClick={order => setSelectedId(order.id)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedId && (
        <OrderDrawer
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
