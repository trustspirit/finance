import { useTranslation } from 'react-i18next'
import { PaymentRequest } from '../../types'
import Spinner from '../Spinner'
import BudgetWarningBanner from '../BudgetWarningBanner'
import { BudgetUsage } from '../../hooks/useBudgetUsage'

interface Props {
  requests: PaymentRequest[]
  selected: Set<string>
  loading: boolean
  budgetUsage: BudgetUsage | null
  selectedSummary: { count: number; payeeCount: number; amount: string } | null
  onRowClick: (id: string, index: number, e: React.MouseEvent) => void
  onToggleAll: () => void
  onStartReview: () => void
}

export default function SettlementSelectTable({
  requests, selected, loading, budgetUsage, selectedSummary,
  onRowClick, onToggleAll, onStartReview,
}: Props) {
  const { t } = useTranslation()

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{t('settlement.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('settlement.description')}</p>
        </div>
        <button onClick={onStartReview} disabled={selected.size === 0}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
          {t('settlement.startReview', { count: selected.size })}
        </button>
      </div>

      <BudgetWarningBanner budgetUsage={budgetUsage} className="mb-4" />

      {selectedSummary && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-sm">
          {t('settlement.selectedSummary', selectedSummary)}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <p className="text-gray-500">{t('settlement.noApproved')}</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={requests.length > 0 && selected.size === requests.length}
                    onChange={onToggleAll} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.date')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.payee')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.committee')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.items')}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t('field.totalAmount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((req, index) => (
                <tr key={req.id}
                  className={`hover:bg-gray-50 cursor-pointer select-none ${selected.has(req.id) ? 'bg-purple-50' : ''}`}
                  onClick={(e) => onRowClick(req.id, index, e)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(req.id)}
                      onChange={(e) => onRowClick(req.id, index, e as unknown as React.MouseEvent)} />
                  </td>
                  <td className="px-4 py-3">{req.date}</td>
                  <td className="px-4 py-3">{req.payee}</td>
                  <td className="px-4 py-3">{req.committee === 'operations' ? t('committee.operationsShort') : t('committee.preparationShort')}</td>
                  <td className="px-4 py-3">{t('form.itemCount', { count: req.items.length })}</td>
                  <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-400">
            Shift+Click: {t('settlement.shiftSelectHint')}
          </div>
        </div>
      )}
    </>
  )
}
