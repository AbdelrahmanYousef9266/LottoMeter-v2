import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActivity } from '../../api/superadmin'

const FILTERS = [
  { label: 'All',         type: 'all' },
  { label: 'Stores',      type: 'stores' },
  { label: 'Complaints',  type: 'complaints' },
  { label: 'Sync',        type: 'sync' },
  { label: 'Submissions', type: 'submissions' },
  { label: 'Variance',    type: 'variance' },
]

const SEVERITY_COLOR = {
  info:     '#3B82F6',
  warning:  '#D97706',
  critical: '#DC2626',
}

const POLL_MS = 60_000

function formatRelative(isoStr) {
  if (!isoStr) return ''
  const diffMs = Date.now() - new Date(isoStr).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ActivityFeed() {
  const navigate = useNavigate()
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeType, setActiveType] = useState('all')
  const intervalRef   = useRef(null)
  const activeTypeRef = useRef('all')

  const doFetch = useCallback((type, reset = false) => {
    if (reset) {
      setItems([])
      setLoading(true)
    }
    getActivity({ type, limit: 50 })
      .then((res) => {
        setItems(res.data?.activity || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    doFetch(activeTypeRef.current, true)

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        doFetch(activeTypeRef.current)
      }
    }, POLL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        doFetch(activeTypeRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [doFetch])

  const handleTypeChange = (type) => {
    setActiveType(type)
    activeTypeRef.current = type
    doFetch(type, true)
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Recent Activity
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(({ label, type }) => {
            const active = activeType === type
            return (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                style={{
                  padding: '3px 11px',
                  borderRadius: 20,
                  border: `1px solid ${active ? '#7C3AED' : 'var(--border)'}`,
                  background: active ? '#7C3AED' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            No activity in the last 7 days.
          </div>
        ) : (
          items.map((item) => (
            <ActivityRow key={item.id} item={item} navigate={navigate} />
          ))
        )}
      </div>
    </div>
  )
}

function ActivityRow({ item, navigate }) {
  const [hovered, setHovered] = useState(false)
  const clickable = Boolean(item.link)

  return (
    <div
      onClick={() => clickable && navigate(item.link)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 8px',
        borderRadius: 6,
        cursor: clickable ? 'pointer' : 'default',
        background: hovered && clickable ? 'var(--bg-secondary)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Severity dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.info,
      }} />

      {/* Title + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
            {item.subtitle}
          </div>
        )}
      </div>

      {/* Store code + relative time */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        {item.store_code && (
          <code style={{
            fontSize: 11,
            background: 'var(--bg-secondary)',
            padding: '1px 6px',
            borderRadius: 4,
            color: 'var(--text-secondary)',
          }}>
            {item.store_code}
          </code>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {formatRelative(item.timestamp)}
        </span>
      </div>
    </div>
  )
}
