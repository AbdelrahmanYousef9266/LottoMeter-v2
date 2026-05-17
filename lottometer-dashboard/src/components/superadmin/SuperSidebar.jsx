import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getComplaintStats } from '../../api/complaints'
import { getSyncFailures } from '../../api/sync'
import { getFulfillmentSummary } from '../../api/superadmin'
import SuperSearch from './SuperSearch'

const BASE_NAV = [
  { to: '/superadmin/dashboard',     label: 'Overview',     icon: '📊', exact: true },
  { to: '/superadmin/stores',        label: 'Stores',       icon: '🏪' },
  { to: '/superadmin/revenue',       label: 'Revenue',      icon: '💰' },
  { to: '/superadmin/submissions',   label: 'Submissions',  icon: '📬' },
  { to: '/superadmin/fulfillment',   label: 'Fulfillment',  icon: '📦', badgeKey: 'fulfillment' },
  { to: '/superadmin/complaints',    label: 'Complaints',   icon: '💬', badgeKey: 'complaints' },
  { to: '/superadmin/sync',          label: 'Sync Health',  icon: '🔄', badgeKey: 'sync_failures' },
  { to: '/superadmin/stores/create', label: 'Create Store', icon: '➕' },
]

const PURPLE = '#7C3AED'
const PURPLE_LIGHT = 'rgba(124,58,237,0.12)'

export default function SuperSidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [openComplaints, setOpenComplaints]   = useState(0)
  const [syncFailures, setSyncFailures]       = useState(0)
  const [fulfillmentActive, setFulfillmentActive] = useState(0)

  useEffect(() => {
    getComplaintStats()
      .then(r => setOpenComplaints(r.data.open ?? 0))
      .catch(() => {})
    getSyncFailures()
      .then(r => setSyncFailures(r.data.failures.length))
      .catch(() => {})
    getFulfillmentSummary()
      .then(r => setFulfillmentActive(r.data.active_total ?? 0))
      .catch(() => {})
  }, [])

  const NAV_ITEMS = BASE_NAV.map(item => {
    if (item.badgeKey === 'complaints')   return { ...item, badge: openComplaints }
    if (item.badgeKey === 'sync_failures')return { ...item, badge: syncFailures }
    if (item.badgeKey === 'fulfillment')  return { ...item, badge: fulfillmentActive }
    return item
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar" style={{ borderRight: `2px solid ${PURPLE_LIGHT}` }}>
      <div className="sidebar-logo">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: PURPLE_LIGHT, borderRadius: 8, padding: '4px 10px', marginBottom: 4,
        }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: PURPLE, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Super Admin
          </span>
        </div>
        <div className="sidebar-logo-title">LottoMeter</div>
        <div className="sidebar-logo-sub">Platform Management</div>
      </div>

      <SuperSearch />

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
            style={({ isActive }) => isActive ? {
              background: PURPLE_LIGHT,
              color: PURPLE,
              borderLeft: `3px solid ${PURPLE}`,
            } : {}}
          >
            <span className="nav-icon">{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge > 0 && (
              <span style={{
                background: '#EF4444', color: '#fff',
                borderRadius: 999, fontSize: 10, fontWeight: 800,
                padding: '1px 6px', lineHeight: 1.6, flexShrink: 0,
              }}>{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={handleLogout}
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  )
}
