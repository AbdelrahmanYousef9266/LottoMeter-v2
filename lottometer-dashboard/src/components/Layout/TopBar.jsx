import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Badge from '../UI/Badge'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/business-days': 'Business Days',
  '/shifts': 'Shifts',
  '/books': 'Books',
  '/slots': 'Slots',
  '/users': 'Users',
  '/reports': 'Reports',
  '/subscription': 'Subscription',
}

function getInitials(username) {
  if (!username) return 'U'
  return username.slice(0, 2).toUpperCase()
}

export default function TopBar() {
  const { user } = useAuth()
  const location = useLocation()

  const title = PAGE_TITLES[location.pathname] || 'LottoMeter'

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">
        {user && (
          <>
            <div style={{ textAlign: 'right' }}>
              <div className="topbar-user-name">{user.username || user.name || 'User'}</div>
              <div className="topbar-user-meta">
                {user.store_code || user.store?.store_name || ''}
              </div>
            </div>
            <Badge variant={user.role === 'admin' ? 'blue' : 'gray'}>
              {user.role || 'employee'}
            </Badge>
            <div className="topbar-avatar">
              {getInitials(user.username || user.name)}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
