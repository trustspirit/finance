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
import SettlementSelectTable from '../components/settlement/SettlementSelectTable'
import SettlementReviewStep from '../components/settlement/SettlementReviewStep'
import SettlementSummary from '../components/settlement/SettlementSummary'

type ReviewPhase = 'select' | 'review' | 'summary'

const payeeKey = (req: PaymentRequest) =>
  `${req.requestedBy.uid}|${req.bankName}|${req.bankAccount}|${req.committee}|${req.session}`

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
  const [reviewSnapshot, setReviewSnapshot] = useState<PaymentRequest[]>([])
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

  // Current request being reviewed (from frozen snapshot)
  const currentReviewRequest = reviewSnapshot[reviewIndex] as PaymentRequest | undefined
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
    setReviewSnapshot([...selectedRequests])
    setReviewIndex(0)
    setReviewedIds(new Set())
    setRejectedIds(new Set())
    setReviewPhase('review')
  }

  const advanceReview = useCallback(() => {
    setReviewIndex(prev => {
      if (prev < reviewSnapshot.length - 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return prev + 1
      }
      setReviewPhase('summary')
      return prev
    })
  }, [reviewSnapshot.length])

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
        onError: () => {
          alert(t('settlement.settleFailed'))
        },
      },
    )
  }

  const backToSelect = () => {
    if (reviewedIds.size > 0 || rejectedIds.size > 0) {
      if (!window.confirm(t('settlement.backToSelectConfirm'))) return
    }
    setReviewPhase('select')
    setReviewSnapshot([])
    setReviewIndex(0)
    setReviewedIds(new Set())
    setRejectedIds(new Set())
  }

  // For final settlement, only use reviewed (included) requests
  const includedRequests = reviewSnapshot.filter(r => reviewedIds.has(r.id))

  const groupedByPayee = includedRequests.reduce<Record<string, PaymentRequest[]>>((acc, req) => {
    const key = payeeKey(req)
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  const handleFinalSettle = async () => {
    if (!user || !appUser || !currentProject || reviewedIds.size === 0) return
    const confirmed = window.confirm(t('settlement.settleConfirm', { count: reviewedIds.size, payeeCount: Object.keys(groupedByPayee).length }))
    if (!confirmed) return

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

  const selectedSummary = selected.size > 0 ? {
    count: selected.size,
    payeeCount: new Set(selectedRequests.map(payeeKey)).size,
    amount: selectedRequests.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString(),
  } : null

  const includedTotal = includedRequests.reduce((sum, r) => sum + r.totalAmount, 0)

  // ── Summary phase ──
  if (reviewPhase === 'summary') {
    return (
      <Layout>
        <SettlementSummary
          groupedByPayee={groupedByPayee}
          reviewedCount={reviewedIds.size}
          rejectedCount={rejectedIds.size}
          includedTotal={includedTotal}
          processing={processing}
          onSettle={handleFinalSettle}
          onBack={backToSelect}
        />
      </Layout>
    )
  }

  // ── Review phase ──
  if (reviewPhase === 'review' && currentReviewRequest) {
    return (
      <Layout>
        <SettlementReviewStep
          request={currentReviewRequest}
          requester={currentRequester}
          reviewIndex={reviewIndex}
          total={reviewSnapshot.length}
          rejectingRequestId={rejectingRequestId}
          forceRejectPending={forceRejectMutation.isPending}
          onInclude={handleConfirmInclude}
          onReject={(id) => setRejectingRequestId(id)}
          onRejectConfirm={handleRejectConfirm}
          onRejectClose={() => setRejectingRequestId(null)}
          onBack={backToSelect}
        />
      </Layout>
    )
  }

  // ── Select phase (default list view) ──
  return (
    <Layout>
      <SettlementSelectTable
        requests={requests}
        selected={selected}
        loading={loading}
        budgetUsage={budgetUsage}
        selectedSummary={selectedSummary}
        onRowClick={handleRowClick}
        onToggleAll={toggleAll}
        onStartReview={startReview}
      />
    </Layout>
  )
}
