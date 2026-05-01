import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout() {
  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="page-content">
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
    </>
  )
}
