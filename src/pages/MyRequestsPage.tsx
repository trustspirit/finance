import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMyRequests } from '../hooks/queries/useRequests'

import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

export default function MyRequestsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { currentProject } = useProject()
  const { data: requests = [], isLoading: loading, error } = useMyRequests(currentProject?.id, user?.uid)

  return (
    <Layout>
      <PageHeader
        title={t('myRequests.title')}
        action={{ label: t('myRequests.newRequest'), to: '/request/new' }}
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-500 text-sm">{error?.message}</p>
      ) : requests.length === 0 ? (
        <EmptyState
          title={t('myRequests.noRequests')}
          description={t('myRequests.noRequestsHint')}
          actionLabel={t('myRequests.newRequest')}
          actionTo="/request/new"
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.date')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.session')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.items')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('field.totalAmount')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">{t('status.pending')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/request/${req.id}`} className="text-blue-600 hover:underline">{req.date}</Link>
                      </td>
                      <td className="px-4 py-3">{req.session}</td>
                      <td className="px-4 py-3">{t('form.itemCount', { count: req.items.length })}</td>
                      <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {requests.map((req) => (
              <Link key={req.id} to={`/request/${req.id}`} className="block bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-600">{req.date}</span>
                  <StatusBadge status={req.status} />
                </div>
                <div className="text-sm text-gray-600 mb-1">{req.session}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('form.itemCount', { count: req.items.length })}</span>
                  <span className="font-medium">₩{req.totalAmount.toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
