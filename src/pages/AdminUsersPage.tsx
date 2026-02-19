import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useUsers, useUpdateUserRole } from '../hooks/queries/useUsers'
import { UserRole } from '../types'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const { appUser: currentUser } = useAuth()
  const { data: users = [], isLoading: loading, error } = useUsers()
  const updateRole = useUpdateUserRole()
  const [successUid, setSuccessUid] = useState<string | null>(null)

  const ROLE_LABELS: Record<UserRole, string> = {
    user: t('role.user'),
    approver_ops: t('role.approver_ops'),
    approver_prep: t('role.approver_prep'),
    finance: t('role.finance'),
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
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.displayName')}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.email')}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.phone')}</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">{t('role.user')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u.uid} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {u.displayName || u.name || '-'}
                          {u.displayName && u.name && u.displayName !== u.name && (
                            <span className="ml-1 text-xs text-gray-400">({u.name})</span>
                          )}
                          {u.uid === currentUser?.uid && (
                            <span className="ml-2 text-xs text-blue-600">{t('users.me')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3 text-gray-500">{u.phone || '-'}</td>
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
                            <option value="admin">{t('role.admin')}</option>
                          </select>
                          {successUid === u.uid && (
                            <p className="text-xs text-green-600 mt-1">{t('users.roleChanged')}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => (
              <div key={u.uid} className="bg-white rounded-lg shadow p-4">
                <div className="mb-3">
                  <p className="font-medium text-gray-900">
                    {u.displayName || u.name || '-'}
                    {u.displayName && u.name && u.displayName !== u.name && (
                      <span className="ml-1 text-xs text-gray-400">({u.name})</span>
                    )}
                    {u.uid === currentUser?.uid && (
                      <span className="ml-2 text-xs text-blue-600">{t('users.me')}</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{u.email}</p>
                  <p className="text-sm text-gray-500">{u.phone || '-'}</p>
                </div>
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
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
