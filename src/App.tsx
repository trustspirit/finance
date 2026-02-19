import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/queryClient'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProjectProvider } from './contexts/ProjectContext'
import ProtectedRoute from './components/ProtectedRoute'
import DisplayNameModal from './components/DisplayNameModal'
import Spinner from './components/Spinner'

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RequestFormPage = lazy(() => import('./pages/RequestFormPage'))
const MyRequestsPage = lazy(() => import('./pages/MyRequestsPage'))
const RequestDetailPage = lazy(() => import('./pages/RequestDetailPage'))
const AdminRequestsPage = lazy(() => import('./pages/AdminRequestsPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SettlementPage = lazy(() => import('./pages/SettlementPage'))
const SettlementListPage = lazy(() => import('./pages/SettlementListPage'))
const SettlementReportPage = lazy(() => import('./pages/SettlementReportPage'))
const ResubmitPage = lazy(() => import('./pages/ResubmitPage'))

function AppLayout() {
  const { needsDisplayName, user } = useAuth()
  return (
    <ProjectProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Spinner /></div>}>
        {user && needsDisplayName && <DisplayNameModal />}
        <Outlet />
      </Suspense>
    </ProjectProvider>
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
      { path: '/request/resubmit/:id', element: <ProtectedRoute><ResubmitPage /></ProtectedRoute> },
      { path: '/settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
      { path: '/admin/requests', element: <ProtectedRoute requiredRoles={['admin', 'finance', 'approver_ops', 'approver_prep']}><AdminRequestsPage /></ProtectedRoute> },
      { path: '/admin/dashboard', element: <ProtectedRoute requiredRoles={['admin', 'finance']}><DashboardPage /></ProtectedRoute> },
      { path: '/admin/users', element: <ProtectedRoute requiredRoles={['admin']}><AdminUsersPage /></ProtectedRoute> },
      { path: '/admin/settlement/new', element: <ProtectedRoute requiredRoles={['admin', 'finance', 'approver_ops', 'approver_prep']}><SettlementPage /></ProtectedRoute> },
      { path: '/admin/settlements', element: <ProtectedRoute requiredRoles={['admin', 'finance', 'approver_ops', 'approver_prep']}><SettlementListPage /></ProtectedRoute> },
      { path: '/admin/settlement/:id', element: <ProtectedRoute requiredRoles={['admin', 'finance', 'approver_ops', 'approver_prep']}><SettlementReportPage /></ProtectedRoute> },
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
