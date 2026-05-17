import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchSuperadmin } from '../../api/superadmin'

// ── Constants ─────────────────────────────────────────────────────────────────

const RECENT_KEY  = 'lm_sa_recent_searches'
const MAX_RECENT  = 5
const DEBOUNCE_MS = 200
const PURPLE      = '#7C3AED'

// Order in which groups appear in the dropdown
const GROUP_ORDER = ['store', 'user', 'complaint', 'submission', 'shift', 'business_day']
const GROUP_LABELS = {
  store:        'STORES',
  user:         'USERS',
  complaint:    'COMPLAINTS',
  submission:   'SUBMISSIONS',
  shift:        'SHIFTS',
  business_day: 'BUSINESS DAYS',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') }
  catch { return [] }
}

function saveRecent(query, prev) {
  const next = [query, ...prev.filter(s => s !== query)].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  return next
}

// Build the flat visual order used for cursor navigation (grouped, then within group by original order)
function buildVisualFlat(results) {
  return GROUP_ORDER.flatMap(type => results.filter(r => r.type === type))
}

// ── Row component (shared between results and recent-search items) ─────────────

function ResultRow({ title, subtitle, highlighted, onClick, onHover }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        padding: '8px 14px',
        cursor: 'pointer',
        borderLeft: `2px solid ${highlighted ? PURPLE : 'transparent'}`,
        background: highlighted ? `${PURPLE}18` : 'transparent',
        transition: 'background 0.08s',
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function GroupHeader({ label, count }) {
  return (
    <div style={{
      padding: '8px 14px 3px',
      fontSize: 10, fontWeight: 700,
      color: 'var(--text-secondary)',
      letterSpacing: '0.08em',
      display: 'flex', justifyContent: 'space-between',
      borderTop: '1px solid var(--border)',
    }}>
      <span>{label}</span>
      <span>{count}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SuperSearch() {
  const navigate = useNavigate()

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])   // flat, ordered by score
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const [cursor,  setCursor]  = useState(-1)   // index into visualFlat (results) or recent
  const [recent,  setRecent]  = useState(readRecent)
  const [focused, setFocused] = useState(false)

  const inputRef    = useRef(null)
  const dropRef     = useRef(null)
  const debounceRef = useRef(null)

  // The flat ordered list used for keyboard navigation and cursor comparisons
  const visualFlat = buildVisualFlat(results)

  // Grouped for rendering
  const grouped = GROUP_ORDER
    .map(type => ({ type, label: GROUP_LABELS[type], items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0)

  const showRecent  = open && !query && recent.length > 0
  const showResults = open && query.length >= 2

  // ── Global Ctrl+K / Cmd+K ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const inInput   = inputRef.current?.contains(e.target)
      const inDropdown = dropRef.current?.contains(e.target)
      if (!inInput && !inDropdown) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setCursor(-1)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchSuperadmin(query)
        const items = r.data.results || []
        setResults(items)
        setCursor(-1)
        if (items.length > 0) {
          setRecent(prev => saveRecent(query, prev))
        }
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (!open) return

    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }

    if (showRecent) {
      const len = recent.length
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, len - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
      else if (e.key === 'Enter' && cursor >= 0) {
        e.preventDefault()
        setQuery(recent[cursor])
        setCursor(-1)
      }
      return
    }

    if (showResults) {
      const len = visualFlat.length
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, len - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
      else if (e.key === 'Enter' && cursor >= 0 && visualFlat[cursor]) {
        e.preventDefault()
        navigateTo(visualFlat[cursor])
      }
    }
  }, [open, showRecent, showResults, recent, cursor, visualFlat]) // eslint-disable-line

  // ── Actions ────────────────────────────────────────────────────────────────
  const navigateTo = (result) => {
    navigate(result.link)
    setOpen(false)
    setQuery('')
    setCursor(-1)
  }

  const cursorIndexOf = (item) =>
    visualFlat.findIndex(i => i.type === item.type && i.id === item.id)

  // ── Dropdown position: anchored to input via getBoundingClientRect ─────────
  // The sidebar is position:fixed, so the input's screen rect is stable.
  // We compute it fresh each time the dropdown opens to handle any layout shifts.
  const [dropPos, setDropPos] = useState({})
  useEffect(() => {
    if (!open || !inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropPos({
      position: 'fixed',
      top:      r.bottom + 6,
      left:     r.left,
      width:    Math.max(r.width, 300),
      zIndex:   9998,
    })
  }, [open])

  const showDropdown = open && (showRecent || showResults || loading)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Input wrapper */}
      <div style={{ padding: '0 12px 12px', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          {/* Search icon */}
          <span style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: 'var(--text-secondary)', pointerEvents: 'none',
          }}>
            🔍
          </span>

          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search stores, users, shifts…"
            autoComplete="off"
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { setFocused(true); setOpen(true) }}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 44px 7px 30px',
              borderRadius: 8,
              border: `1px solid ${focused ? PURPLE : 'var(--border)'}`,
              background: 'var(--bg-secondary, var(--bg-card))',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
          />

          {/* Keyboard shortcut badge */}
          <span style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, color: 'var(--text-secondary)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 4, padding: '1px 5px',
            fontWeight: 700, pointerEvents: 'none',
            letterSpacing: '0.03em',
          }}>
            ⌘K
          </span>
        </div>
      </div>

      {/* Dropdown — fixed overlay to escape sidebar's stacking context */}
      {showDropdown && (
        <div
          ref={dropRef}
          style={{
            ...dropPos,
            background:   'var(--bg-card)',
            border:       '1px solid var(--border)',
            borderRadius: 10,
            boxShadow:    '0 8px 32px rgba(0,0,0,0.2)',
            maxHeight:    440,
            overflowY:    'auto',
          }}
        >
          {/* Recent searches (shown only when query is empty) */}
          {showRecent && (
            <div>
              <div style={{
                padding: '10px 14px 4px',
                fontSize: 10, fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: '0.08em',
              }}>
                RECENT
              </div>
              {recent.map((q, i) => (
                <div
                  key={q}
                  onClick={() => { setQuery(q); setCursor(-1); inputRef.current?.focus() }}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: i === cursor ? `${PURPLE}18` : 'transparent',
                    borderLeft: `2px solid ${i === cursor ? PURPLE : 'transparent'}`,
                    transition: 'background 0.08s',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>🕐</span>
                  <span style={{ color: 'var(--text-primary)' }}>{q}</span>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && !showRecent && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
              Searching…
            </div>
          )}

          {/* Empty state */}
          {!loading && showResults && results.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
              No results for <strong style={{ color: 'var(--text-primary)' }}>"{query}"</strong>.<br />
              <span style={{ fontSize: 12 }}>Try a store code, username, or complaint subject.</span>
            </div>
          )}

          {/* Grouped results */}
          {!loading && grouped.map((group) => (
            <div key={group.type}>
              <GroupHeader
                label={group.label}
                count={group.items.length}
              />
              {group.items.map(item => {
                const idx = cursorIndexOf(item)
                return (
                  <ResultRow
                    key={`${item.type}-${item.id}`}
                    title={item.title}
                    subtitle={item.subtitle}
                    highlighted={idx === cursor}
                    onHover={() => setCursor(idx)}
                    onClick={() => navigateTo(item)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
