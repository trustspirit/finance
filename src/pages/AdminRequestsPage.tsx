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
import { canApproveCommittee } from '../lib/roles'
import { useRequests, useApproveRequest, useRejectRequest } from '../hooks/queries/useRequests'

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

  const handleApproveWithSign = (requestId: string) => {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    if (req.requestedBy.uid === user?.uid) {
      alert(t('approval.selfApproveError'))
      return
    }
    if (!canApproveCommittee(role, req.committee)) return
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
    if (!canApproveCommittee(role, req.committee)) return
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

  // Filter by committee access first, then by status
  const accessible = requests.filter((r) => canApproveCommittee(role, r.committee))
  const filtered = filter === 'all' ? accessible : accessible.filter((r) => r.status === filter)

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
                        <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                        <td className="px-4 py-3 text-center">
                          {req.status === 'pending' && (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleApproveWithSign(req.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">{t('approval.approve')}</button>
                              <button onClick={() => handleRejectOpen(req.id)}
                                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">{t('approval.reject')}</button>
                            </div>
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
                {req.status === 'pending' && (
                  <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                    <button onClick={() => handleApproveWithSign(req.id)}
                      className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">{t('approval.approve')}</button>
                    <button onClick={() => handleRejectOpen(req.id)}
                      className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">{t('approval.reject')}</button>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 서명 승인 모달 */}
      <Modal open={!!signModalRequestId} onClose={() => setSignModalRequestId(null)} title={t('approval.signTitle')}>
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
          <button onClick={() => setSignModalRequestId(null)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
            {t('common.cancel')}
          </button>
          <button onClick={handleConfirmApproval} disabled={!signatureData}
            className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-400">
            {t('approval.signAndApprove')}
          </button>
        </div>
      </Modal>

      {/* 반려 사유 모달 */}
      <Modal open={!!rejectModalRequestId} onClose={() => setRejectModalRequestId(null)} title={t('approval.rejectTitle')}>
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
          <button onClick={() => setRejectModalRequestId(null)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
            {t('common.cancel')}
          </button>
          <button onClick={handleRejectConfirm} disabled={!rejectionReason.trim()}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:bg-gray-400">
            {t('approval.reject')}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
