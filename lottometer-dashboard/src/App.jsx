import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import LoadingSpinner from './components/UI/LoadingSpinner'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BusinessDays from './pages/BusinessDays'
import Shifts from './pages/Shifts'
import Books from './pages/Books'
import Slots from './pages/Slots'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Subscription from './pages/Subscription'
import AccountSettings from './pages/AccountSettings'

import HomePage from './pages/public/HomePage'
import ContactPage from './pages/public/ContactPage'
import PricingPage from './pages/public/PricingPage'
import GetStartedPage from './pages/public/GetStartedPage'
import SampleReportPreview from './pages/public/SampleReportPreview'

import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin'
import SuperDashboard from './pages/superadmin/SuperDashboard'
import SuperStores from './pages/superadmin/SuperStores'
import SuperSubmissions from './pages/superadmin/SuperSubmissions'
import SuperCreateStore from './pages/superadmin/SuperCreateStore'
import SuperComplaints from './pages/superadmin/SuperComplaints'
import SyncControlPanel from './pages/superadmin/SyncControlPanel'
import StoreHealthPage from './pages/superadmin/StoreHealthPage'
import RevenuePage from './pages/superadmin/RevenuePage'
import FulfillmentPage from './pages/superadmin/FulfillmentPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function SuperAdminRoute({ children }) {
  const { isAuthenticated, loading, role } = useAuth()
  if (loading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role !== 'superadmin') return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading, role } = useAuth()
  if (loading) return <LoadingSpinner fullPage />
  if (isAuthenticated) {
    return <Navigate to={role === 'superadmin' ? '/superadmin/dashboard' : '/dashboard'} replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Marketing pages — no auth required */}
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/apply" element={<Navigate to="/get-started" replace />} />
      <Route path="/get-started" element={<GetStartedPage />} />
      <Route path="/sample-report" element={<SampleReportPreview />} />

      {/* Login */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Staff portal login */}
      <Route path="/staff-portal" element={<SuperAdminLogin />} />

      {/* Superadmin panel */}
      <Route
        path="/superadmin"
        element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}
      >
        <Route path="dashboard" element={<SuperDashboard />} />
        <Route path="stores" element={<SuperStores />} />
        <Route path="stores/create" element={<SuperCreateStore />} />
        <Route path="stores/:storeId" element={<StoreHealthPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="fulfillment" element={<FulfillmentPage />} />
        <Route path="submissions" element={<SuperSubmissions />} />
        <Route path="complaints" element={<SuperComplaints />} />
        <Route path="sync" element={<SyncControlPanel />} />
      </Route>

      {/* Protected dashboard */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route index element={<Dashboard />} />
        <Route path="business-days" element={<BusinessDays />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="books" element={<Books />} />
        <Route path="slots" element={<Slots />} />
        <Route path="users" element={<Users />} />
        <Route path="reports" element={<Reports />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="account" element={<AccountSettings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
