import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/business-days', label: 'Business Days', icon: '📅' },
  { to: '/shifts', label: 'Shifts', icon: '🔄' },
  { to: '/books', label: 'Books', icon: '📚' },
  { to: '/slots', label: 'Slots', icon: '🎰' },
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/reports', label: 'Reports', icon: '📈' },
  { to: '/subscription', label: 'Subscription', icon: '💳' },
]

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">LottoMeter</div>
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
