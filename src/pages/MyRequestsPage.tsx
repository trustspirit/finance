import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useInfiniteMyRequests, useCancelRequest } from '../hooks/queries/useRequests'

import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel'

export default function MyRequestsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { currentProject } = useProject()
  const {
    data,
    isLoading: loading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteMyRequests(currentProject?.id, user?.uid)
  const cancelMutation = useCancelRequest()

  const requests = data?.pages.flatMap(p => p.items) ?? []

  const handleCancel = (e: React.MouseEvent, requestId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t('approval.cancelConfirm'))) return
    cancelMutation.mutate({ requestId, projectId: currentProject!.id })
  }

  return (
    <Layout>
      <PageHeader
        title={t('myRequests.title')}
        action={{ label: t('myRequests.newRequest'), to: '/request/new' }}
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-500 text-sm">{t('common.loadError')}</p>
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
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.committee')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.items')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('field.totalAmount')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">{t('status.label')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/request/${req.id}`} className="text-blue-600 hover:underline">{req.date}</Link>
                      </td>
                      <td className="px-4 py-3">{t(`committee.${req.committee}Short`)}</td>
                      <td className="px-4 py-3">{t('form.itemCount', { count: req.items.length })}</td>
                      <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                      <td className="px-4 py-3 text-center">
                        {req.status === 'pending' && (
                          <button onClick={(e) => handleCancel(e, req.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs text-gray-500 hover:text-red-600">
                            {t('approval.cancelRequest')}
                          </button>
                        )}
                        {(req.status === 'cancelled' || req.status === 'rejected' || req.status === 'force_rejected') && (
                          <Link to={`/request/resubmit/${req.id}`} onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:underline">
                            {t('approval.resubmit')}
                          </Link>
                        )}
                      </td>
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
                <div className="text-sm text-gray-600 mb-1">{t(`committee.${req.committee}Short`)}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('form.itemCount', { count: req.items.length })}</span>
                  <span className="font-medium">₩{req.totalAmount.toLocaleString()}</span>
                </div>
                {req.status === 'pending' && (
                  <button onClick={(e) => handleCancel(e, req.id)}
                    disabled={cancelMutation.isPending}
                    className="mt-2 text-xs text-gray-500 hover:text-red-600">
                    {t('approval.cancelRequest')}
                  </button>
                )}
                {(req.status === 'cancelled' || req.status === 'rejected' || req.status === 'force_rejected') && (
                  <Link to={`/request/resubmit/${req.id}`} onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-block text-xs text-blue-600 hover:underline">
                    {t('approval.resubmit')}
                  </Link>
                )}
              </Link>
            ))}
          </div>

          <InfiniteScrollSentinel
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </>
      )}
    </Layout>
  )
}
