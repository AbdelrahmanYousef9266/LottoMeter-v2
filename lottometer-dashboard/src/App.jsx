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

import HomePage from './pages/public/HomePage'
import ContactPage from './pages/public/ContactPage'
import ApplyPage from './pages/public/ApplyPage'
import PricingPage from './pages/public/PricingPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner fullPage />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Marketing pages — no auth required */}
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/apply" element={<ApplyPage />} />

      {/* Login */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

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
