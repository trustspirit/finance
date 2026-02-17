import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DisplayNameModal from './components/DisplayNameModal'
import LoginPage from './pages/LoginPage'
import RequestFormPage from './pages/RequestFormPage'
import MyRequestsPage from './pages/MyRequestsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import AdminRequestsPage from './pages/AdminRequestsPage'
import DashboardPage from './pages/DashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import SettingsPage from './pages/SettingsPage'
import SettlementPage from './pages/SettlementPage'
import SettlementListPage from './pages/SettlementListPage'
import SettlementReportPage from './pages/SettlementReportPage'

function AppLayout() {
  const { needsDisplayName, user } = useAuth()
  return (
    <>
      {user && needsDisplayName && <DisplayNameModal />}
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/request/new', element: <ProtectedRoute><RequestFormPage /></ProtectedRoute> },
      { path: '/request/:id', element: <ProtectedRoute><RequestDetailPage /></ProtectedRoute> },
      { path: '/my-requests', element: <ProtectedRoute><MyRequestsPage /></ProtectedRoute> },
      { path: '/settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
      { path: '/admin/requests', element: <ProtectedRoute requiredRoles={['admin', 'approver']}><AdminRequestsPage /></ProtectedRoute> },
      { path: '/admin/dashboard', element: <ProtectedRoute requiredRoles={['admin']}><DashboardPage /></ProtectedRoute> },
      { path: '/admin/users', element: <ProtectedRoute requiredRoles={['admin']}><AdminUsersPage /></ProtectedRoute> },
      { path: '/admin/settlement/new', element: <ProtectedRoute requiredRoles={['admin', 'approver']}><SettlementPage /></ProtectedRoute> },
      { path: '/admin/settlements', element: <ProtectedRoute requiredRoles={['admin', 'approver']}><SettlementListPage /></ProtectedRoute> },
      { path: '/admin/settlement/:id', element: <ProtectedRoute requiredRoles={['admin', 'approver']}><SettlementReportPage /></ProtectedRoute> },
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
