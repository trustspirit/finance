import { useTranslation } from 'react-i18next'
import { PaymentRequest, AppUser } from '../../types'
import InfoGrid from '../InfoGrid'
import ItemsTable from '../ItemsTable'
import ReceiptGallery from '../ReceiptGallery'
import { ForceRejectionModal } from '../AdminRequestModals'

interface Props {
  request: PaymentRequest
  requester: AppUser | null | undefined
  reviewIndex: number
  total: number
  rejectingRequestId: string | null
  forceRejectPending: boolean
  onInclude: () => void
  onReject: (id: string) => void
  onRejectConfirm: (reason: string) => void
  onRejectClose: () => void
  onBack: () => void
}

export default function SettlementReviewStep({
  request: req, requester, reviewIndex, total,
  rejectingRequestId, forceRejectPending,
  onInclude, onReject, onRejectConfirm, onRejectClose, onBack,
}: Props) {
  const { t } = useTranslation()
  const bankBookUrl = requester?.bankBookUrl || requester?.bankBookDriveUrl

  return (
    <>
      <div className="max-w-3xl mx-auto">
        {/* Progress header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
            {t('settlement.backToSelect')}
          </button>
          <span className="text-sm font-medium text-gray-600">
            {t('settlement.reviewProgress', { current: reviewIndex + 1, total })}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
          <div className="bg-purple-600 h-1.5 rounded-full transition-all"
            style={{ width: `${((reviewIndex + 1) / total) * 100}%` }} />
        </div>

        {/* Request detail card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">{req.payee}</h3>

          <InfoGrid className="mb-6" items={[
            { label: t('field.payee'), value: req.payee },
            { label: t('field.date'), value: req.date },
            { label: t('field.phone'), value: req.phone },
            { label: t('field.session'), value: req.session },
            { label: t('field.bankAndAccount'), value: `${req.bankName} ${req.bankAccount}` },
            { label: t('field.committee'), value: req.committee === 'operations' ? t('committee.operations') : t('committee.preparation') },
          ]} />

          <ItemsTable items={req.items} totalAmount={req.totalAmount} />

          <ReceiptGallery receipts={req.receipts} />

          {/* Bank Book */}
          {bankBookUrl && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('field.bankBook')}</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden inline-block">
                <a href={bankBookUrl} target="_blank" rel="noopener noreferrer">
                  <img src={bankBookUrl} alt={t('field.bankBook')} className="max-h-48 object-contain bg-gray-50" />
                </a>
                <div className="px-3 py-2 bg-gray-50 border-t">
                  <a href={bankBookUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline">{t('settings.bankBookViewDrive')}</a>
                </div>
              </div>
            </div>
          )}

          {/* Meta info */}
          <InfoGrid className="border-t pt-4" items={[
            { label: t('field.requestedBy'), value: `${req.requestedBy.name} (${req.requestedBy.email})` },
            ...(req.reviewedBy ? [{ label: t('approval.reviewedBy'), value: `${req.reviewedBy.name} (${req.reviewedBy.email})` }] : []),
            { label: t('field.approvedBy'), value: req.approvedBy ? `${req.approvedBy.name} (${req.approvedBy.email})` : '-' },
          ]} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onReject(req.id)}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
          >
            {t('approval.reject')}
          </button>
          <button
            onClick={onInclude}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700"
          >
            {t('settlement.confirmInclude')}
          </button>
        </div>
      </div>

      <ForceRejectionModal
        key={rejectingRequestId ?? ''}
        open={!!rejectingRequestId}
        onClose={onRejectClose}
        onConfirm={onRejectConfirm}
        isPending={forceRejectPending}
      />
    </>
  )
}
