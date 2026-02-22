import { useTranslation } from 'react-i18next'
import { PaymentRequest } from '../../types'
import ProcessingOverlay from '../ProcessingOverlay'

interface Props {
  groupedByPayee: Record<string, PaymentRequest[]>
  reviewedCount: number
  rejectedCount: number
  includedTotal: number
  processing: boolean
  onSettle: () => void
  onBack: () => void
}

export default function SettlementSummary({
  groupedByPayee, reviewedCount, rejectedCount, includedTotal,
  processing, onSettle, onBack,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-6">{t('settlement.reviewSummary')}</h2>

      <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-green-700 font-medium">{t('settlement.includedCount', { count: reviewedCount })}</span>
          <span className="text-red-600 font-medium">{t('settlement.rejectedCount', { count: rejectedCount })}</span>
        </div>
        <div className="text-right text-lg font-bold">
          {t('field.totalAmount')}: ₩{includedTotal.toLocaleString()}
        </div>

        {/* Per-payee grouped summary */}
        {Object.entries(groupedByPayee).map(([key, reqs]) => {
          const first = reqs[0]
          const subtotal = reqs.reduce((sum, r) => sum + r.totalAmount, 0)
          return (
            <div key={key} className="border-t pt-4">
              <div className="flex justify-between items-baseline mb-2">
                <h3 className="text-sm font-medium text-gray-800">
                  {first.payee}
                  <span className="ml-2 text-xs text-gray-400">{first.bankName} {first.bankAccount}</span>
                </h3>
                <span className="text-sm font-semibold">₩{subtotal.toLocaleString()}</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-0.5 pl-2">
                {reqs.map(r => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.date} — {t('form.itemCount', { count: r.items.length })}</span>
                    <span>₩{r.totalAmount.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
          {t('settlement.backToSelect')}
        </button>
        <button onClick={onSettle}
          disabled={reviewedCount === 0 || processing}
          className="flex-1 bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
          {processing ? t('settlement.processing') : t('settlement.finalSettle')}
        </button>
      </div>

      <ProcessingOverlay open={processing} text={t('common.processingMessage')} />
    </div>
  )
}
