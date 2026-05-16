import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import ImpersonationBanner, { BANNER_HEIGHT } from '../ImpersonationBanner'
import { useAuth } from '../../context/AuthContext'

export default function Layout() {
  const { isImpersonating } = useAuth()

  return (
    <div className={isImpersonating ? 'layout--impersonating' : ''}>
      <ImpersonationBanner />
      <Sidebar />
      <TopBar />
      <main
        className="page-content"
        style={isImpersonating ? { paddingTop: `calc(var(--topbar-height) + ${BANNER_HEIGHT}px)` } : undefined}
      >
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
