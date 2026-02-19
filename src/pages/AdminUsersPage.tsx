import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useUsers, useUpdateUserRole } from '../hooks/queries/useUsers'
import { AppUser, UserRole } from '../types'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'

function BankInfoTooltip({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClose])

  const bankBookImg = user.bankBookImage || user.bankBookUrl || user.bankBookDriveUrl

  return (
    <div ref={ref}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-72"
      style={{ transform: 'translateY(4px)' }}>
      <p className="text-xs font-medium text-gray-500 mb-1">{t('field.bankAndAccount')}</p>
      <p className="text-sm text-gray-900 mb-2">
        {user.bankName ? `${user.bankName} ${user.bankAccount}` : '-'}
      </p>
      <p className="text-xs font-medium text-gray-500 mb-1">{t('field.bankBook')}</p>
      {bankBookImg ? (
        <a href={user.bankBookUrl || user.bankBookDriveUrl} target="_blank" rel="noopener noreferrer">
          <img src={bankBookImg} alt={t('field.bankBook')}
            className="max-h-40 w-full object-contain bg-gray-50 rounded border border-gray-200" />
        </a>
      ) : (
        <p className="text-xs text-gray-400">{t('settings.bankBookRequiredHint')}</p>
      )}
    </div>
  )
}

function UserNameWithTooltip({ user, currentUser, isAdmin, roleLabel }: {
  user: AppUser
  currentUser: AppUser | null
  isAdmin: boolean
  roleLabel: string
}) {
  const { t } = useTranslation()
  const [showTooltip, setShowTooltip] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const openTooltip = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setTooltipPos({
        top: rect.bottom + window.scrollY,
        left: Math.min(rect.left, window.innerWidth - 300),
      })
    }
    setShowTooltip(true)
  }, [])

  return (
    <>
      <span
        ref={anchorRef}
        className="cursor-pointer hover:text-blue-600 underline decoration-dotted underline-offset-2"
        onMouseEnter={openTooltip}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={openTooltip}
      >
        {user.displayName || user.name || '-'}
      </span>
      {user.displayName && user.name && user.displayName !== user.name && (
        <span className="ml-1 text-xs text-gray-400">({user.name})</span>
      )}
      {user.uid === currentUser?.uid && (
        <span className="ml-2 text-xs text-blue-600">{t('users.me')}</span>
      )}
      {!isAdmin && (
        <span className="ml-2 text-xs text-gray-400">{roleLabel}</span>
      )}
      {showTooltip && (
        <div style={{ position: 'absolute', top: tooltipPos.top, left: tooltipPos.left, zIndex: 9999 }}>
          <BankInfoTooltip user={user} onClose={() => setShowTooltip(false)} />
        </div>
      )}
    </>
  )
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const { appUser: currentUser } = useAuth()
  const { data: users = [], isLoading: loading, error } = useUsers()
  const updateRole = useUpdateUserRole()
  const [successUid, setSuccessUid] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'admin'

  const ROLE_LABELS: Record<UserRole, string> = {
    user: t('role.user'),
    approver_ops: t('role.approver_ops'),
    approver_prep: t('role.approver_prep'),
    finance: t('role.finance'),
    director: t('role.director'),
    admin: t('role.admin'),
  }

  const handleRoleChange = (uid: string, newRole: UserRole) => {
    if (uid === currentUser?.uid) {
      alert(t('users.selfChangeError'))
      return
    }
    const confirmed = window.confirm(t('users.roleChangeConfirm', { role: ROLE_LABELS[newRole] }))
    if (!confirmed) return

    updateRole.mutate(
      { uid, role: newRole },
      {
        onSuccess: () => {
          setSuccessUid(uid)
          setTimeout(() => setSuccessUid(null), 2000)
        },
        onError: () => {
          alert(t('users.roleChangeFailed'))
        },
      },
    )
  }

  return (
    <Layout>
      <PageHeader title={t('users.title')} />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-500 text-sm">{error?.message}</p>
      ) : users.length === 0 ? (
        <EmptyState title={t('users.noUsers')} />
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-lg shadow">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.displayName')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.email')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.phone')}</th>
                    {isAdmin && (
                      <th className="text-center px-4 py-3 font-medium text-gray-600">{t('role.label')}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <UserNameWithTooltip
                          user={u}
                          currentUser={currentUser}
                          isAdmin={isAdmin}
                          roleLabel={ROLE_LABELS[u.role]}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3 text-gray-500">{u.phone || '-'}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-center">
                          <select
                            value={u.role}
                            disabled={u.uid === currentUser?.uid}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                            className={`border border-gray-300 rounded px-2 py-1 text-sm ${
                              u.uid === currentUser?.uid ? 'bg-gray-100 text-gray-400' : ''
                            }`}
                          >
                            <option value="user">{t('role.user')}</option>
                            <option value="approver_ops">{t('role.approver_ops')}</option>
                            <option value="approver_prep">{t('role.approver_prep')}</option>
                            <option value="finance">{t('role.finance')}</option>
                            <option value="director">{t('role.director')}</option>
                            <option value="admin">{t('role.admin')}</option>
                          </select>
                          {successUid === u.uid && (
                            <p className="text-xs text-green-600 mt-1">{t('users.roleChanged')}</p>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => (
              <div key={u.uid} className="bg-white rounded-lg shadow p-4">
                <div className="mb-3">
                  <p className="font-medium text-gray-900">
                    <UserNameWithTooltip
                      user={u}
                      currentUser={currentUser}
                      isAdmin={isAdmin}
                      roleLabel={ROLE_LABELS[u.role]}
                    />
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{u.email}</p>
                  <p className="text-sm text-gray-500">{u.phone || '-'}</p>
                </div>
                {isAdmin ? (
                  <div>
                    <select
                      value={u.role}
                      disabled={u.uid === currentUser?.uid}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                      className={`w-full border border-gray-300 rounded px-2 py-1.5 text-sm ${
                        u.uid === currentUser?.uid ? 'bg-gray-100 text-gray-400' : ''
                      }`}
                    >
                      <option value="user">{t('role.user')}</option>
                      <option value="approver_ops">{t('role.approver_ops')}</option>
                      <option value="approver_prep">{t('role.approver_prep')}</option>
                      <option value="finance">{t('role.finance')}</option>
                      <option value="admin">{t('role.admin')}</option>
                    </select>
                    {successUid === u.uid && (
                      <p className="text-xs text-green-600 mt-1">{t('users.roleChanged')}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">{ROLE_LABELS[u.role]}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
