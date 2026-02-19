import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

import { useRequest } from '../hooks/queries/useRequests'
import { useUser } from '../hooks/queries/useUsers'
import { useTranslation } from 'react-i18next'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import InfoGrid from '../components/InfoGrid'
import ItemsTable from '../components/ItemsTable'
import ReceiptGallery from '../components/ReceiptGallery'

export default function RequestDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: request, isLoading: requestLoading } = useRequest(id)
  const { data: requester, isLoading: requesterLoading } = useUser(request?.requestedBy.uid)
  const loading = requestLoading || requesterLoading

  if (loading) return <Layout><Spinner /></Layout>
  if (!request) return <Layout><div className="text-center py-16 text-gray-500">{t('detail.notFound')}</div></Layout>

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{t('detail.title')}</h2>
            <p className="text-sm text-gray-500">{t('detail.subtitle')}</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <InfoGrid className="mb-6" items={[
          { label: t('field.payee'), value: request.payee },
          { label: t('field.date'), value: request.date },
          { label: t('field.phone'), value: request.phone },
          { label: t('field.session'), value: request.session },
          { label: t('field.bankAndAccount'), value: `${request.bankName} ${request.bankAccount}` },
          { label: t('committee.label'), value: t(`committee.${request.committee}`) },
        ]} />

        <ItemsTable items={request.items} totalAmount={request.totalAmount} />

        <ReceiptGallery receipts={request.receipts} />

        {/* Bank Book */}
        {requester?.bankBookDriveUrl && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('field.bankBook')}</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden inline-block">
              <a href={requester.bankBookDriveUrl} target="_blank" rel="noopener noreferrer">
                {requester.bankBookImage ? (
                  <img src={requester.bankBookImage} alt={t('field.bankBook')} className="max-h-48 object-contain bg-gray-50" />
                ) : (
                  <img src={`https://drive.google.com/thumbnail?id=${requester.bankBookDriveId}&sz=w400`}
                    alt={t('field.bankBook')} className="max-h-48 object-contain bg-gray-50" />
                )}
              </a>
              <div className="px-3 py-2 bg-gray-50 border-t">
                <a href={requester.bankBookDriveUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">{t('settings.bankBookViewDrive')}</a>
              </div>
            </div>
          </div>
        )}

        {request.comments && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-1">{t('field.comments')}</h3>
            <p className="text-sm text-gray-600">{request.comments}</p>
          </div>
        )}

        {request.status === 'rejected' && request.rejectionReason && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800 mb-1">{t('approval.rejectionReason')}</h3>
            <p className="text-sm text-red-700">{request.rejectionReason}</p>
          </div>
        )}

        {request.status === 'rejected' && user?.uid === request.requestedBy.uid && (
          <div className="mb-6">
            <button onClick={() => navigate(`/request/resubmit/${request.id}`)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
              {t('approval.resubmit')}
            </button>
          </div>
        )}

        <InfoGrid className="border-t pt-4" items={[
          { label: t('field.requestedBy'), value: `${request.requestedBy.name} (${request.requestedBy.email})` },
          { label: t('field.approvedBy'), value: request.approvedBy ? `${request.approvedBy.name} (${request.approvedBy.email})` : '-' },
        ]} />

        {request.approvalSignature && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">{t('approval.approvalSignature')}</h3>
            <div className="border border-gray-200 rounded p-2 bg-gray-50 inline-block">
              <img src={request.approvalSignature} alt={t('approval.approvalSignature')} className="max-h-20" />
            </div>
          </div>
        )}

        {request.status === 'settled' && request.settlementId && (
          <div className="mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500">{t('detail.settlementReport')}: </span>
            <Link to={`/admin/settlement/${request.settlementId}`}
              className="text-sm text-purple-600 hover:underline">{t('detail.viewReport')}</Link>
          </div>
        )}

        <div className="mt-6">
          <Link to="/my-requests" className="text-sm text-blue-600 hover:underline">{t('common.backToList')}</Link>
        </div>
      </div>
    </Layout>
  )
}
