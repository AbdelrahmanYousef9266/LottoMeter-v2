import { Outlet } from 'react-router-dom'
import SuperSidebar from '../../components/superadmin/SuperSidebar'

export default function SuperAdminLayout() {
  return (
    <>
      <SuperSidebar />
      <main className="page-content">
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
    </>
  )
}
