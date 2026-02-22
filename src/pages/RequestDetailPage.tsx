import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

import { useRequest, useRequests, useCancelRequest, useReviewRequest, useApproveRequest, useRejectRequest } from '../hooks/queries/useRequests'
import { useProject } from '../contexts/ProjectContext'
import { useUser } from '../hooks/queries/useUsers'
import { useBudgetUsage } from '../hooks/useBudgetUsage'
import { useTranslation } from 'react-i18next'
import { canReviewCommittee, canFinalApproveCommittee, canFinalApproveRequest, canApproveDirectorRequest, DEFAULT_APPROVAL_THRESHOLD } from '../lib/roles'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import InfoGrid from '../components/InfoGrid'
import ItemsTable from '../components/ItemsTable'
import ReceiptGallery from '../components/ReceiptGallery'
import { ApprovalModal, RejectionModal } from '../components/AdminRequestModals'
import StatusProgress from '../components/StatusProgress'
import ReviewChecklist from '../components/ReviewChecklist'
import Modal from '../components/Modal'
import { REVIEW_CHECKLIST, APPROVAL_CHECKLIST } from '../constants/reviewChecklist'

export default function RequestDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { user, appUser } = useAuth()
  const { currentProject } = useProject()
  const navigate = useNavigate()
  const location = useLocation()
  const backPath = (location.state as { from?: string })?.from || '/my-requests'
  const role = appUser?.role || 'user'
  const threshold = currentProject?.directorApprovalThreshold ?? DEFAULT_APPROVAL_THRESHOLD

  const cancelMutation = useCancelRequest()
  const reviewMutation = useReviewRequest()
  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()
  const budgetUsage = useBudgetUsage()

  const { data: request, isLoading: requestLoading } = useRequest(id)
  const { data: requester, isLoading: requesterLoading } = useUser(request?.requestedBy.uid)
  const { data: originalRequest } = useRequest(request?.originalRequestId ?? undefined)
  const loading = requestLoading || requesterLoading

  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [showReviewConfirm, setShowReviewConfirm] = useState(false)
  const [slideState, setSlideState] = useState<'idle' | 'out' | 'in'>('idle')
  const isFirstMount = useRef(true)

  // Fetch all requests for auto-navigation
  const { data: allRequests = [] } = useRequests(currentProject?.id)

  const actionableRequests = useMemo(() => {
    if (!allRequests.length || !user) return []
    return allRequests.filter(r => {
      if (r.requestedBy.uid === user.uid) return false
      if (r.status === 'pending' && canReviewCommittee(role, r.committee)) return true
      if (r.status === 'reviewed' && canFinalApproveCommittee(role, r.committee)) return true
      return false
    })
  }, [allRequests, user, role])

  const currentIndex = actionableRequests.findIndex(r => r.id === id)
  const nextId = currentIndex >= 0 && currentIndex < actionableRequests.length - 1
    ? actionableRequests[currentIndex + 1].id
    : null
  const remainingCount = currentIndex >= 0
    ? actionableRequests.length - currentIndex - 1
    : 0

  const nextIdRef = useRef(nextId)
  useEffect(() => { nextIdRef.current = nextId }, [nextId])

  const navigateToNext = useCallback(() => {
    setSlideState('out')
    setTimeout(() => {
      window.scrollTo({ top: 0 })
      if (nextIdRef.current) {
        navigate(`/request/${nextIdRef.current}`, { state: { from: backPath } })
      } else {
        navigate(backPath)
      }
    }, 300)
  }, [navigate, backPath])

  // Slide-in animation on route change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    // Use rAF to avoid setState directly in effect body
    const raf1 = requestAnimationFrame(() => {
      setSlideState('in')
      const raf2 = requestAnimationFrame(() => {
        setSlideState('idle')
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [id])

  const isSelf = request?.requestedBy.uid === user?.uid
  const bankBookUrl = requester?.bankBookUrl || requester?.bankBookDriveUrl

  // Director-filed request: only executive/admin can approve
  const isDirectorRequest = requester?.role === 'session_director' || requester?.role === 'logistic_admin'

  // Review action (pending → reviewed)
  const canDoReview = request?.status === 'pending' && !isSelf && canReviewCommittee(role, request.committee)

  // Approve action (reviewed → approved)
  const canDoApprove = request?.status === 'reviewed' && !isSelf
    && canFinalApproveRequest(role, request.committee, request.totalAmount, threshold)
    && (!isDirectorRequest || canApproveDirectorRequest(role))

  // Reject action (pending or reviewed) — rejection doesn't require amount threshold
  const canDoReject =
    (request?.status === 'pending' && !isSelf && canReviewCommittee(role, request.committee)) ||
    (request?.status === 'reviewed' && !isSelf && canFinalApproveCommittee(role, request.committee)
      && (!isDirectorRequest || canApproveDirectorRequest(role)))

  const showChecklist = canDoReview || canDoApprove
  const checklistItems = canDoReview ? REVIEW_CHECKLIST : APPROVAL_CHECKLIST

  const handleReview = () => {
    if (!user || !appUser || !request) return
    if (isSelf) { alert(t('approval.selfReviewError')); return }
    setShowReviewConfirm(true)
  }

  const handleReviewConfirm = () => {
    if (!user || !appUser || !request) return
    setShowReviewConfirm(false)
    const name = appUser.displayName || appUser.name
    reviewMutation.mutate(
      { requestId: request.id, projectId: currentProject!.id, reviewer: { uid: user.uid, name, email: appUser.email } },
      { onSuccess: navigateToNext },
    )
  }

  const handleApproveOpen = () => {
    if (!request) return
    if (isSelf) { alert(t('approval.selfApproveError')); return }
    if (!appUser?.signature) { alert(t('validation.signatureRequired')); return }
    if (!canFinalApproveRequest(role, request.committee, request.totalAmount, threshold)) {
      if (request.totalAmount > threshold) alert(t('approval.directorRequired'))
      return
    }
    setShowApprovalModal(true)
  }

  const handleApproveConfirm = (signature: string) => {
    if (!user || !appUser || !request) return
    const name = appUser.displayName || appUser.name
    approveMutation.mutate(
      { requestId: request.id, projectId: currentProject!.id, approver: { uid: user.uid, name, email: appUser.email }, signature },
      { onSuccess: () => { setShowApprovalModal(false); navigateToNext() } },
    )
  }

  const handleRejectOpen = () => {
    if (!request) return
    if (isSelf) { alert(t('approval.selfRejectError')); return }
    setShowRejectionModal(true)
  }

  const handleRejectConfirm = (reason: string) => {
    if (!user || !appUser || !request) return
    const name = appUser.displayName || appUser.name
    rejectMutation.mutate(
      { requestId: request.id, projectId: currentProject!.id, approver: { uid: user.uid, name, email: appUser.email }, rejectionReason: reason },
      { onSuccess: () => { setShowRejectionModal(false); navigateToNext() } },
    )
  }

  if (loading) return <Layout><Spinner /></Layout>
  if (!request) return <Layout><div className="text-center py-16 text-gray-500">{t('detail.notFound')}</div></Layout>

  return (
    <Layout>
      {/* Mobile: collapsible checklist banner */}
      {showChecklist && (
        <div className="sm:hidden mb-4">
          <ReviewChecklist items={checklistItems} stage={canDoReview ? 'review' : 'approval'} />
        </div>
      )}

      <div className="flex gap-6 justify-center">
      <div className="flex-1 min-w-0 overflow-hidden max-w-4xl">
      <div className={`bg-white rounded-lg shadow p-4 sm:p-6 ${
        slideState === 'idle'
          ? 'transition-all duration-300 ease-in-out translate-x-0 opacity-100'
          : slideState === 'out'
          ? 'transition-all duration-300 ease-in-out -translate-x-full opacity-0'
          : 'translate-x-full opacity-0'
      }`}>
        <Link to={backPath} className="inline-block text-sm text-blue-600 hover:underline mb-4">{t('common.backToList')}</Link>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{t('detail.title')}</h2>
            <p className="text-sm text-gray-500">{t('detail.subtitle')}</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <StatusProgress status={request.status} hasReview={!!request.reviewedBy} />

        {/* Requester actions: resubmit / cancel — shown prominently at top */}
        {(request.status === 'rejected' || request.status === 'cancelled' || request.status === 'force_rejected') && user?.uid === request.requestedBy.uid && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-800">{t('approval.resubmitDescription').split('.')[0]}.</span>
            <button onClick={() => navigate(`/request/resubmit/${request.id}`)}
              className="ml-4 shrink-0 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
              {t('approval.resubmit')}
            </button>
          </div>
        )}

        {request.status === 'pending' && user?.uid === request.requestedBy.uid && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-gray-600">{t('approval.cancelConfirm')}</span>
            <button onClick={() => {
              if (!confirm(t('approval.cancelConfirm'))) return
              cancelMutation.mutate(
                { requestId: request.id, projectId: currentProject!.id },
                { onSuccess: () => navigate('/my-requests') }
              )
            }}
              disabled={cancelMutation.isPending}
              className="ml-4 shrink-0 bg-red-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-600 disabled:bg-gray-400">
              {cancelMutation.isPending ? t('common.saving') : t('approval.cancelRequest')}
            </button>
          </div>
        )}

        {request.originalRequestId && originalRequest && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                {t('approval.resubmitted')}
              </span>
              <Link to={`/request/${request.originalRequestId}`} className="text-xs text-blue-600 hover:underline">
                {t('approval.originalRequest')}
              </Link>
            </div>
            {originalRequest.rejectionReason && (
              <p className="text-sm text-amber-800">
                <span className="font-medium">{t('approval.originalRejectionReason')}: </span>
                {originalRequest.rejectionReason}
              </p>
            )}
          </div>
        )}

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
        {(requester?.bankBookUrl || requester?.bankBookDriveUrl) && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('field.bankBook')}</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden inline-block">
              <a href={requester.bankBookUrl || requester.bankBookDriveUrl} target="_blank" rel="noopener noreferrer">
                <img src={requester.bankBookUrl || requester.bankBookDriveUrl || ''}
                  alt={t('field.bankBook')} className="max-h-48 object-contain bg-gray-50" />
              </a>
              <div className="px-3 py-2 bg-gray-50 border-t">
                <a href={requester.bankBookUrl || requester.bankBookDriveUrl} target="_blank" rel="noopener noreferrer"
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

        {request.status === 'force_rejected' && request.rejectionReason && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-orange-800 mb-1">{t('approval.rejectionReason')}</h3>
            <p className="text-sm text-orange-700">{request.rejectionReason}</p>
          </div>
        )}

        {/* Action buttons: review / approve / reject */}
        {(canDoReview || canDoApprove || canDoReject) && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {canDoReview && (
              <button
                onClick={handleReview}
                disabled={reviewMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
              >
                {reviewMutation.isPending ? t('common.submitting') : t('approval.review')}
              </button>
            )}
            {canDoApprove && (
              <button
                onClick={handleApproveOpen}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
              >
                {t('approval.approve')}
              </button>
            )}
            {canDoReject && (
              <button
                onClick={handleRejectOpen}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
              >
                {t('approval.reject')}
              </button>
            )}
            {remainingCount > 0 && (
              <span className="ml-auto px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {t('approval.remainingCount', { count: remainingCount })}
              </span>
            )}
          </div>
        )}

        {/* Director required hint */}
        {request.status === 'reviewed' && !canDoApprove && request.totalAmount > threshold && !isSelf && (
          <p className="text-xs text-orange-600 mb-6">{t('approval.directorRequired')}</p>
        )}

        <InfoGrid className="border-t pt-4" items={[
          { label: t('field.requestedBy'), value: `${request.requestedBy.name} (${request.requestedBy.email})` },
          ...(request.reviewedBy ? [{ label: t('approval.reviewedBy'), value: `${request.reviewedBy.name} (${request.reviewedBy.email})` }] : []),
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

      </div>
      </div>

      {/* Desktop: sticky sidebar checklist */}
      {showChecklist && (
        <div className="hidden sm:block shrink-0">
          <ReviewChecklist items={checklistItems} stage={canDoReview ? 'review' : 'approval'} />
        </div>
      )}
      </div>

      {/* Review confirm modal */}
      <Modal open={showReviewConfirm} onClose={() => setShowReviewConfirm(false)} title={t('checklist.confirmReview')}>
        <p className="text-sm text-gray-600 mb-6">{t('checklist.confirmReview')}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setShowReviewConfirm(false)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
            {t('common.cancel')}
          </button>
          <button onClick={handleReviewConfirm}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
            {t('approval.review')}
          </button>
        </div>
      </Modal>

      <ApprovalModal
        key={showApprovalModal ? 'open' : 'closed'}
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        request={request}
        bankBookUrl={bankBookUrl}
        budgetUsage={budgetUsage}
        savedSignature={appUser?.signature}
        onConfirm={handleApproveConfirm}
        isPending={approveMutation.isPending}
      />

      <RejectionModal
        key={showRejectionModal ? 'open' : 'closed'}
        open={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        onConfirm={handleRejectConfirm}
        isPending={rejectMutation.isPending}
      />
    </Layout>
  )
}
