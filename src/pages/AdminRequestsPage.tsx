import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { RequestStatus } from '../types'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import SignaturePad from '../components/SignaturePad'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { useTranslation } from 'react-i18next'
import { canApproveCommittee, canApproveRequest, DEFAULT_APPROVAL_THRESHOLD } from '../lib/roles'

import { useRequests, useApproveRequest, useRejectRequest } from '../hooks/queries/useRequests'
import { useUser } from '../hooks/queries/useUsers'

export default function AdminRequestsPage() {
  const { t } = useTranslation()
  const { user, appUser } = useAuth()
  const { currentProject } = useProject()
  const role = appUser?.role || 'user'
  const { data: requests = [], isLoading: loading } = useRequests(currentProject?.id)
  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')
  const [signModalRequestId, setSignModalRequestId] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState(appUser?.signature || '')
  const [rejectModalRequestId, setRejectModalRequestId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Fetch the requester's user data for bank book preview in approval modal
  const signModalRequest = requests.find((r) => r.id === signModalRequestId)
  const { data: requester } = useUser(signModalRequest?.requestedBy.uid)

  const handleApproveWithSign = (requestId: string) => {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    if (req.requestedBy.uid === user?.uid) {
      alert(t('approval.selfApproveError'))
      return
    }
    if (!canApproveRequest(role, req.committee, req.totalAmount, threshold)) {
      if (req.totalAmount > threshold) {
        alert(t('approval.directorRequired'))
      }
      return
    }
    setSignatureData(appUser?.signature || '')
    setSignModalRequestId(requestId)
  }

  const handleConfirmApproval = () => {
    if (!user || !appUser || !signModalRequestId) return
    if (!signatureData) {
      alert(t('approval.signTitle'))
      return
    }

    const approverName = appUser.displayName || appUser.name

    approveMutation.mutate({
      requestId: signModalRequestId,
      projectId: currentProject!.id,
      approver: { uid: user.uid, name: approverName, email: appUser.email },
      signature: signatureData,
    }, {
      onSuccess: () => {
        setSignModalRequestId(null)
        setSignatureData(appUser?.signature || '')
      },
    })
  }

  const handleRejectOpen = (requestId: string) => {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    if (req.requestedBy.uid === user?.uid) {
      alert(t('approval.selfRejectError'))
      return
    }
    if (!canApproveRequest(role, req.committee, req.totalAmount, threshold)) {
      if (req.totalAmount > threshold) {
        alert(t('approval.directorRequired'))
      }
      return
    }
    setRejectionReason('')
    setRejectModalRequestId(requestId)
  }

  const handleRejectConfirm = () => {
    if (!user || !appUser || !rejectModalRequestId) return
    if (!rejectionReason.trim()) {
      alert(t('approval.rejectDescription'))
      return
    }

    const approverName = appUser.displayName || appUser.name

    rejectMutation.mutate({
      requestId: rejectModalRequestId,
      projectId: currentProject!.id,
      approver: { uid: user.uid, name: approverName, email: appUser.email },
      rejectionReason,
    }, {
      onSuccess: () => {
        setRejectModalRequestId(null)
        setRejectionReason('')
      },
    })
  }

  const threshold = currentProject?.directorApprovalThreshold ?? DEFAULT_APPROVAL_THRESHOLD

  // Filter by committee access, exclude cancelled, then by status
  const accessible = requests.filter((r) => canApproveCommittee(role, r.committee) && r.status !== 'cancelled')
  const filtered = filter === 'all' ? accessible : accessible.filter((r) => r.status === filter)

  const bankBookUrl = requester?.bankBookUrl || requester?.bankBookDriveUrl
  const bankBookImg = bankBookUrl

  return (
    <Layout>
      <PageHeader title={t('nav.adminRequests')} />

      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'pending', 'approved', 'settled', 'rejected'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t(`status.${f}`, f)}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.date')}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.payee')}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.committee')}</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">{t('field.totalAmount')}</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">{t('status.all')}</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link to={`/request/${req.id}`} className="text-blue-600 hover:underline">{req.date}</Link>
                        </td>
                        <td className="px-4 py-3">{req.payee}</td>
                        <td className="px-4 py-3">{t(`committee.${req.committee}Short`)}</td>
                        <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={req.status} />
                          {req.approvedBy && (req.status === 'approved' || req.status === 'rejected') && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{req.approvedBy.name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {req.status === 'pending' && canApproveRequest(role, req.committee, req.totalAmount, threshold) && (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleApproveWithSign(req.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">{t('approval.approve')}</button>
                              <button onClick={() => handleRejectOpen(req.id)}
                                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">{t('approval.reject')}</button>
                            </div>
                          )}
                          {req.status === 'pending' && !canApproveRequest(role, req.committee, req.totalAmount, threshold)
                            && req.totalAmount > threshold && (
                            <span className="text-xs text-orange-600">{t('approval.directorRequired')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {filtered.map((req) => (
              <Link key={req.id} to={`/request/${req.id}`} className="block bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{req.payee}</span>
                  <StatusBadge status={req.status} />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                  <span>{req.date}</span>
                  <span>{t(`committee.${req.committee}Short`)}</span>
                </div>
                <div className="text-right font-semibold text-gray-900 mb-3">
                  ₩{req.totalAmount.toLocaleString()}
                </div>
                {req.status === 'pending' && canApproveRequest(role, req.committee, req.totalAmount, threshold) && (
                  <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                    <button onClick={() => handleApproveWithSign(req.id)}
                      className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">{t('approval.approve')}</button>
                    <button onClick={() => handleRejectOpen(req.id)}
                      className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">{t('approval.reject')}</button>
                  </div>
                )}
                {req.status === 'pending' && !canApproveRequest(role, req.committee, req.totalAmount, threshold)
                  && req.totalAmount > threshold && (
                  <p className="text-xs text-orange-600 mt-1">{t('approval.directorRequired')}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 서명 승인 모달 */}
      <Modal open={!!signModalRequestId} onClose={() => { if (!approveMutation.isPending) setSignModalRequestId(null) }} title={t('approval.signTitle')}>
        {/* Bank book preview */}
        {signModalRequest && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-1">{t('field.payee')}: {signModalRequest.payee}</p>
            <p className="text-xs text-gray-500 mb-2">
              {t('field.bankAndAccount')}: {signModalRequest.bankName} {signModalRequest.bankAccount}
            </p>
            {bankBookImg ? (
              <a href={bankBookUrl} target="_blank" rel="noopener noreferrer">
                <img src={bankBookImg} alt={t('field.bankBook')}
                  className="max-h-32 rounded border border-gray-200 object-contain bg-white" />
              </a>
            ) : (
              <p className="text-xs text-gray-400">{t('settings.bankBookRequiredHint')}</p>
            )}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-4">{t('approval.signDescription')}</p>

        {appUser?.signature && (
          <div className="mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={signatureData === appUser.signature}
                onChange={(e) => setSignatureData(e.target.checked ? appUser.signature : '')}
              />
              <span className="text-sm text-gray-600">{t('approval.useSavedSignature')}</span>
            </label>
            {signatureData === appUser.signature && (
              <div className="mt-2 border border-gray-200 rounded p-2 bg-gray-50">
                <img src={appUser.signature} alt="Saved signature" className="max-h-24 mx-auto" />
              </div>
            )}
          </div>
        )}

        {signatureData !== appUser?.signature && (
          <SignaturePad
            initialData={signatureData !== appUser?.signature ? signatureData : ''}
            onChange={setSignatureData}
          />
        )}

        <div className="flex gap-3 justify-end mt-4">
          <button onClick={() => setSignModalRequestId(null)} disabled={approveMutation.isPending}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400">
            {t('common.cancel')}
          </button>
          <button onClick={handleConfirmApproval} disabled={!signatureData || approveMutation.isPending}
            className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-400">
            {approveMutation.isPending ? t('common.submitting') : t('approval.signAndApprove')}
          </button>
        </div>
      </Modal>

      {/* 반려 사유 모달 */}
      <Modal open={!!rejectModalRequestId} onClose={() => { if (!rejectMutation.isPending) setRejectModalRequestId(null) }} title={t('approval.rejectTitle')}>
        <p className="text-sm text-gray-500 mb-4">{t('approval.rejectDescription')}</p>
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          rows={4}
          placeholder={t('approval.rejectPlaceholder')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setRejectModalRequestId(null)} disabled={rejectMutation.isPending}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400">
            {t('common.cancel')}
          </button>
          <button onClick={handleRejectConfirm} disabled={!rejectionReason.trim() || rejectMutation.isPending}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:bg-gray-400">
            {rejectMutation.isPending ? t('common.submitting') : t('approval.reject')}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
