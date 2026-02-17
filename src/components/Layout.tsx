import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { appUser, logout } = useAuth()
  const location = useLocation()
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'approver'

  const navItems = [
    { to: '/request/new', label: '새 신청서' },
    { to: '/my-requests', label: '내 신청 내역' },
  ]

  const adminItems = [
    { to: '/admin/requests', label: '신청 관리' },
    { to: '/admin/dashboard', label: '대시보드' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link to="/my-requests" className="font-bold text-lg">지불/환불 신청</Link>
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm ${location.pathname === item.to ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && adminItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm ${location.pathname === item.to ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{appUser?.name || appUser?.email}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">로그아웃</button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
