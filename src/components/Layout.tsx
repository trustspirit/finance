import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { appUser, logout } = useAuth()
  const location = useLocation()
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'approver'
  const userName = appUser?.displayName || appUser?.name || appUser?.email

  const navItems = [
    { to: '/request/new', label: '새 신청서' },
    { to: '/my-requests', label: '내 신청 내역' },
  ]

  const adminItems = [
    { to: '/admin/requests', label: '신청 관리' },
    { to: '/admin/settlements', label: '정산' },
    { to: '/admin/dashboard', label: '대시보드' },
    { to: '/admin/users', label: '사용자 관리' },
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              {userName}
              {appUser?.role === 'admin' && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">관리자</span>}
              {appUser?.role === 'approver' && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">승인자</span>}
            </span>
            <Link to="/settings"
              className={`p-1.5 rounded hover:bg-gray-100 ${location.pathname === '/settings' ? 'bg-gray-100' : ''}`}
              title="설정">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">로그아웃</button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
