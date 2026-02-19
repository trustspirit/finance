import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useSettlements } from '../hooks/queries/useSettlements'
import { formatFirestoreDate } from '../lib/utils'
import { Settlement } from '../types'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

export default function SettlementListPage() {
  const { t } = useTranslation()
  const { currentProject } = useProject()
  const { data: settlements = [], isLoading: loading } = useSettlements(currentProject?.id)

  const formatDate = (s: Settlement) => formatFirestoreDate(s.createdAt)

  return (
    <Layout>
      <PageHeader
        title={t('settlement.listTitle')}
        action={{ label: t('settlement.newSettlement'), to: '/admin/settlement/new', variant: 'purple' }}
      />

      {loading ? (
        <Spinner />
      ) : settlements.length === 0 ? (
        <EmptyState
          title={t('settlement.noSettlements')}
          description={t('settlement.description')}
          actionLabel={t('settlement.newSettlement')}
          actionTo="/admin/settlement/new"
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('settlement.settlementDate')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.payee')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.committee')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.bankAndAccount')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('field.totalAmount')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">{t('settlement.requestCount')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(s)}</td>
                      <td className="px-4 py-3">{s.payee}</td>
                      <td className="px-4 py-3">{s.committee === 'operations' ? t('committee.operationsShort') : t('committee.preparationShort')}</td>
                      <td className="px-4 py-3 text-gray-500">{s.bankName} {s.bankAccount}</td>
                      <td className="px-4 py-3 text-right font-medium">₩{s.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">{t('form.itemCount', { count: s.requestIds.length })}</td>
                      <td className="px-4 py-3 text-center">
                        <Link to={`/admin/settlement/${s.id}`}
                          className="text-purple-600 hover:underline text-sm">{t('settlement.report')}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {settlements.map((s) => (
              <Link key={s.id} to={`/admin/settlement/${s.id}`}
                className="block bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{s.payee}</span>
                  <span className="text-xs text-gray-400">{formatDate(s)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {s.committee === 'operations' ? t('committee.operationsShort') : t('committee.preparationShort')} | {t('form.itemCount', { count: s.requestIds.length })}
                  </span>
                  <span className="font-medium text-purple-700">₩{s.totalAmount.toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{s.bankName} {s.bankAccount}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
