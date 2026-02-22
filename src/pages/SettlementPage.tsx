import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { PaymentRequest, AppUser } from '../types'
import { canSeeCommitteeRequests } from '../lib/roles'
import { useApprovedRequests, useForceRejectRequest } from '../hooks/queries/useRequests'
import { useCreateSettlement } from '../hooks/queries/useSettlements'
import { useUser } from '../hooks/queries/useUsers'
import { useBudgetUsage } from '../hooks/useBudgetUsage'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import BudgetWarningBanner from '../components/BudgetWarningBanner'
import InfoGrid from '../components/InfoGrid'
import ItemsTable from '../components/ItemsTable'
import ReceiptGallery from '../components/ReceiptGallery'
import { ForceRejectionModal } from '../components/AdminRequestModals'

type ReviewPhase = 'select' | 'review' | 'summary'

export default function SettlementPage() {
  const { t } = useTranslation()
  const { user, appUser } = useAuth()
  const { currentProject } = useProject()
  const role = appUser?.role || 'user'
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)

  // Review mode state
  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>('select')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null)

  const { data: allRequests = [], isLoading: loading } = useApprovedRequests(currentProject?.id)
  const createSettlementMutation = useCreateSettlement()
  const forceRejectMutation = useForceRejectRequest()
  const budgetUsage = useBudgetUsage()

  const requests = useMemo(
    () => allRequests.filter(r => canSeeCommitteeRequests(role, r.committee)),
    [allRequests, role]
  )

  const selectedRequests = useMemo(
    () => requests.filter((r) => selected.has(r.id)),
    [requests, selected]
  )

  // Current request being reviewed
  const currentReviewRequest = selectedRequests[reviewIndex] as PaymentRequest | undefined
  const { data: currentRequester } = useUser(
    reviewPhase === 'review' ? currentReviewRequest?.requestedBy.uid : undefined
  )

  const handleRowClick = useCallback((id: string, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== null) {
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

  const startReview = () => {
    if (selected.size === 0) return
    setReviewIndex(0)
    setReviewedIds(new Set())
    setRejectedIds(new Set())
    setReviewPhase('review')
  }

  const advanceReview = () => {
    if (reviewIndex < selectedRequests.length - 1) {
      setReviewIndex(reviewIndex + 1)
    } else {
      setReviewPhase('summary')
    }
  }

  const handleConfirmInclude = () => {
    if (!currentReviewRequest) return
    setReviewedIds(prev => new Set(prev).add(currentReviewRequest.id))
    advanceReview()
  }

  const handleRejectConfirm = (reason: string) => {
    if (!user || !appUser || !rejectingRequestId) return
    const approverName = appUser.displayName || appUser.name
    forceRejectMutation.mutate(
      {
        requestId: rejectingRequestId,
        projectId: currentProject!.id,
        approver: { uid: user.uid, name: approverName, email: appUser.email },
        rejectionReason: reason,
      },
      {
        onSuccess: () => {
          setRejectedIds(prev => new Set(prev).add(rejectingRequestId))
          setRejectingRequestId(null)
          advanceReview()
        },
      },
    )
  }

  const backToSelect = () => {
    setReviewPhase('select')
    setReviewIndex(0)
    setReviewedIds(new Set())
    setRejectedIds(new Set())
  }

  // For final settlement, only use reviewed (included) requests
  const includedRequests = selectedRequests.filter(r => reviewedIds.has(r.id))

  const groupedByPayee = includedRequests.reduce<Record<string, PaymentRequest[]>>((acc, req) => {
    const key = `${req.requestedBy.uid}|${req.bankName}|${req.bankAccount}|${req.committee}|${req.session}`
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  const handleFinalSettle = async () => {
    if (!user || !appUser || !currentProject || reviewedIds.size === 0) return

    setProcessing(true)
    try {
      const creatorName = appUser.displayName || appUser.name

      const missingApproval = includedRequests.find((r) => !r.approvalSignature || !r.approvedBy)
      if (missingApproval) {
        alert(t('settlement.settleFailed') + ': ' + missingApproval.payee + ' - missing approval signature')
        setProcessing(false)
        return
      }

      const totalOps = Object.values(groupedByPayee).reduce((sum, reqs) => sum + 1 + reqs.length, 0)
      if (totalOps >= 500) {
        alert(t('settlement.settleFailed') + ': Too many operations. Please select fewer requests.')
        setProcessing(false)
        return
      }

      const requesterUids = [...new Set(Object.values(groupedByPayee).map(reqs => reqs[0].requestedBy.uid))]
      const signatureMap = new Map<string, string | null>()
      await Promise.all(
        requesterUids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid))
            const userData = snap.exists() ? (snap.data() as AppUser) : null
            signatureMap.set(uid, userData?.signature || null)
          } catch {
            signatureMap.set(uid, null)
          }
        })
      )

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
          requestedBySignature: signatureMap.get(first.requestedBy.uid) || null,
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

  // ── Summary phase ──
  if (reviewPhase === 'summary') {
    const includedTotal = includedRequests.reduce((sum, r) => sum + r.totalAmount, 0)
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6">{t('settlement.reviewSummary')}</h2>

          <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-green-700 font-medium">{t('settlement.includedCount', { count: reviewedIds.size })}</span>
              <span className="text-red-600 font-medium">{t('settlement.rejectedCount', { count: rejectedIds.size })}</span>
            </div>
            <div className="text-right text-lg font-bold">
              {t('field.totalAmount')}: ₩{includedTotal.toLocaleString()}
            </div>

            {includedRequests.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">{t('settlement.includedCount', { count: reviewedIds.size })}</h3>
                <ul className="text-sm space-y-1">
                  {includedRequests.map(r => (
                    <li key={r.id} className="flex justify-between">
                      <span>{r.payee} — {r.date}</span>
                      <span>₩{r.totalAmount.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={backToSelect}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              {t('settlement.backToSelect')}
            </button>
            <button onClick={handleFinalSettle}
              disabled={reviewedIds.size === 0 || processing}
              className="flex-1 bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
              {processing ? t('settlement.processing') : t('settlement.finalSettle')}
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // ── Review phase ──
  if (reviewPhase === 'review' && currentReviewRequest) {
    const req = currentReviewRequest
    const bankBookUrl = currentRequester?.bankBookUrl || currentRequester?.bankBookDriveUrl

    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          {/* Progress header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={backToSelect} className="text-sm text-gray-500 hover:text-gray-700">
              {t('settlement.backToSelect')}
            </button>
            <span className="text-sm font-medium text-gray-600">
              {t('settlement.reviewProgress', { current: reviewIndex + 1, total: selectedRequests.length })}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
            <div className="bg-purple-600 h-1.5 rounded-full transition-all"
              style={{ width: `${((reviewIndex + 1) / selectedRequests.length) * 100}%` }} />
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
              onClick={() => setRejectingRequestId(req.id)}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
            >
              {t('approval.reject')}
            </button>
            <button
              onClick={handleConfirmInclude}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700"
            >
              {t('settlement.confirmInclude')}
            </button>
          </div>
        </div>

        <ForceRejectionModal
          key={rejectingRequestId ?? ''}
          open={!!rejectingRequestId}
          onClose={() => setRejectingRequestId(null)}
          onConfirm={handleRejectConfirm}
          isPending={forceRejectMutation.isPending}
        />
      </Layout>
    )
  }

  // ── Select phase (default list view) ──
  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{t('settlement.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('settlement.description')}</p>
        </div>
        <button onClick={startReview} disabled={selected.size === 0}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
          {t('settlement.startReview', { count: selected.size })}
        </button>
      </div>

      <BudgetWarningBanner budgetUsage={budgetUsage} className="mb-4" />

      {selected.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-sm">
          {t('settlement.selectedSummary', {
            count: selected.size,
            payeeCount: Object.keys(
              selectedRequests.reduce<Record<string, boolean>>((acc, req) => {
                const key = `${req.requestedBy.uid}|${req.bankName}|${req.bankAccount}|${req.committee}|${req.session}`
                acc[key] = true
                return acc
              }, {})
            ).length,
            amount: selectedRequests.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString(),
          })}
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
