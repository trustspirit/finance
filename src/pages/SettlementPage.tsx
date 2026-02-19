import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { PaymentRequest } from '../types'
import { canApproveCommittee } from '../lib/roles'
import { useApprovedRequests } from '../hooks/queries/useRequests'
import { useCreateSettlement } from '../hooks/queries/useSettlements'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'

export default function SettlementPage() {
  const { t } = useTranslation()
  const { user, appUser } = useAuth()
  const { currentProject } = useProject()
  const role = appUser?.role || 'user'
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)

  const { data: allRequests = [], isLoading: loading } = useApprovedRequests(currentProject?.id)
  const createSettlementMutation = useCreateSettlement()

  // Role-based filtering stays client-side:
  const requests = useMemo(
    () => allRequests.filter(r => canApproveCommittee(role, r.committee)),
    [allRequests, role]
  )

  const handleRowClick = useCallback((id: string, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== null) {
      // Shift-click: select range
      const start = Math.min(lastClickedIndex, index)
      const end = Math.max(lastClickedIndex, index)
      setSelected((prev) => {
        const next = new Set(prev)
        for (let i = start; i <= end; i++) {
          next.add(requests[i].id)
        }
        return next
      })
    } else {
      // Normal click: toggle single
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
    setLastClickedIndex(index)
  }, [lastClickedIndex, requests])

  const toggleAll = () => {
    if (selected.size === requests.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(requests.map((r) => r.id)))
    }
  }

  const selectedRequests = requests.filter((r) => selected.has(r.id))

  // Group by payee + committee + session (prevents mixing different committees/sessions)
  const groupedByPayee = selectedRequests.reduce<Record<string, PaymentRequest[]>>((acc, req) => {
    const key = `${req.requestedBy.uid}|${req.bankName}|${req.bankAccount}|${req.committee}|${req.session}`
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  const handleSettle = async () => {
    if (!user || !appUser || !currentProject || selected.size === 0) return
    const confirmed = window.confirm(t('settlement.settleConfirm', { count: selected.size, payeeCount: Object.keys(groupedByPayee).length }))
    if (!confirmed) return

    setProcessing(true)
    try {
      const creatorName = appUser.displayName || appUser.name

      // Validate all selected have approval signature
      const missingApproval = selectedRequests.find((r) => !r.approvalSignature || !r.approvedBy)
      if (missingApproval) {
        alert(t('settlement.settleFailed') + ': ' + missingApproval.payee + ' - missing approval signature')
        setProcessing(false)
        return
      }

      // Check batch size limit (Firestore max: 500 operations per batch)
      const totalOps = Object.values(groupedByPayee).reduce((sum, reqs) => sum + 1 + reqs.length, 0)
      if (totalOps >= 500) {
        alert(t('settlement.settleFailed') + ': Too many operations. Please select fewer requests.')
        setProcessing(false)
        return
      }

      const settlementData = Object.values(groupedByPayee).map((reqs) => {
        const first = reqs[0]
        const allItems = reqs.flatMap((r) => r.items)
        const allReceipts = reqs.flatMap((r) => r.receipts)
        const totalAmount = allItems.reduce((sum, item) => sum + item.amount, 0)

        return {
          projectId: currentProject.id,
          createdBy: { uid: user.uid, name: creatorName, email: appUser.email },
          payee: first.payee,
          phone: first.phone,
          bankName: first.bankName,
          bankAccount: first.bankAccount,
          session: first.session,
          committee: first.committee,
          items: allItems,
          totalAmount,
          receipts: allReceipts,
          requestIds: reqs.map((r) => r.id),
          approvedBy: first.approvedBy,
          approvalSignature: first.approvalSignature || null,
        }
      })

      await createSettlementMutation.mutateAsync({
        projectId: currentProject.id,
        settlements: settlementData,
      })
      setSelected(new Set())
      navigate('/admin/settlements')
    } catch (error) {
      console.error('Failed to create settlement:', error)
      alert(t('settlement.settleFailed'))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{t('settlement.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('settlement.description')}</p>
        </div>
        <button onClick={handleSettle} disabled={selected.size === 0 || processing}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
          {processing ? t('settlement.processing') : t('settlement.settle', { count: selected.size })}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-sm">
          {t('settlement.selectedSummary', { count: selected.size, payeeCount: Object.keys(groupedByPayee).length, amount: selectedRequests.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString() })}
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
                    onChange={toggleAll} />
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
                  onClick={(e) => handleRowClick(req.id, index, e)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(req.id)}
                      onChange={(e) => handleRowClick(req.id, index, e as unknown as React.MouseEvent)} />
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
    </Layout>
  )
}
