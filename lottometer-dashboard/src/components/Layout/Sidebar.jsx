import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/dashboard/business-days', label: 'Business Days', icon: '📅' },
  { to: '/dashboard/shifts', label: 'Shifts', icon: '🔄' },
  { to: '/dashboard/books', label: 'Books', icon: '📚' },
  { to: '/dashboard/slots', label: 'Slots', icon: '🎰' },
  { to: '/dashboard/users', label: 'Users', icon: '👥' },
  { to: '/dashboard/reports', label: 'Reports', icon: '📈' },
  { to: '/dashboard/subscription', label: 'Subscription', icon: '💳' },
]

export default function Sidebar() {
  const { logout, user, role } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const storeCode = user?.store_code || ''
  const username = user?.username || 'User'
  const avatarLetter = username.slice(0, 2).toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">
          <span className="lm-wordmark" style={{ fontSize: 20 }}>
            <span>Lotto</span>
            <span>Meter</span>
          </span>
        </div>
        <div className="sidebar-logo-sub">Digital Shift Tracking</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink
          to="/dashboard/account"
          className={({ isActive }) =>
            `sidebar-nav-item${isActive ? ' active' : ''}`
          }
          style={{ marginBottom: 8 }}
        >
          <span className="nav-icon">⚙️</span>
          <span>Account Settings</span>
        </NavLink>

        {/* User row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          marginBottom: 4,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--gradient)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {avatarLetter}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {username}
            </div>
            {role && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--blue)',
                background: 'rgba(0,119,204,0.12)', borderRadius: 4,
                padding: '1px 5px', textTransform: 'capitalize',
                display: 'inline-block', marginTop: 2,
              }}>
                {role}
              </span>
            )}
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={handleLogout}
        >
          🚪 Sign Out
        </button>

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', paddingTop: 10, opacity: 0.6 }}>
          LottoMeter v2.0
        </div>
      </div>
    </aside>
  )
}
