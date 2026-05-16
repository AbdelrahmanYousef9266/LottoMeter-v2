import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export const BANNER_HEIGHT = 44

function formatCountdown(expiresAt) {
  const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function ImpersonationBanner() {
  const { isImpersonating, impersonationMeta, endImpersonation } = useAuth()
  const [countdown, setCountdown] = useState('')
  const [exiting, setExiting]     = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isImpersonating || !impersonationMeta?.expires_at) return
    const tick = () => setCountdown(formatCountdown(impersonationMeta.expires_at))
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [isImpersonating, impersonationMeta?.expires_at])

  if (!isImpersonating || !impersonationMeta) return null

  const { store_code, store_name, username, store_id } = impersonationMeta

  const handleExit = async () => {
    if (exiting) return
    setExiting(true)
    await endImpersonation(store_id)
    // endImpersonation does a hard redirect; this line is a fallback only
  }

  return (
    // Fixed banner — intentionally vivid red to prevent confusion about the active context.
    // Never use neutral colours for impersonation state.
    <div
      role="alert"
      aria-live="polite"
      style={{
        position:    'fixed',
        top:         0,
        left:        0,
        right:       0,
        zIndex:      9999,
        height:      BANNER_HEIGHT,
        background:  '#B91C1C',
        color:       '#fff',
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'space-between',
        padding:     '0 20px',
        gap:         12,
        boxShadow:   '0 2px 8px rgba(0,0,0,0.35)',
        fontSize:    13,
        fontWeight:  600,
        letterSpacing: '0.01em',
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        🔴 IMPERSONATING{' '}
        <code style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>
          {store_code}
        </code>
        {' '}({store_name}) as user <strong>{username}</strong>
        {countdown && <> · expires in {countdown}</>}
      </span>

      <button
        onClick={handleExit}
        disabled={exiting}
        style={{
          flexShrink:  0,
          background:  'rgba(255,255,255,0.15)',
          border:      '1px solid rgba(255,255,255,0.45)',
          color:       '#fff',
          borderRadius: 6,
          padding:     '4px 14px',
          fontSize:    12,
          fontWeight:  700,
          cursor:      exiting ? 'not-allowed' : 'pointer',
          whiteSpace:  'nowrap',
          transition:  'background 0.15s',
        }}
        onMouseEnter={(e) => !exiting && (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
      >
        {exiting ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  )
}
