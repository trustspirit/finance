import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  requiredRoles?: UserRole[]
}

export default function ProtectedRoute({ children, requiredRoles }: Props) {
  const { user, appUser, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (requiredRoles && appUser && !requiredRoles.includes(appUser.role)) {
    return <Navigate to="/my-requests" replace />
  }

  return <>{children}</>
}
