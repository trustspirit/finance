import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { PaymentRequest, AppUser } from '../types'
import { COMMITTEE_LABELS } from '../constants/labels'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import InfoGrid from '../components/InfoGrid'
import ReceiptGallery from '../components/ReceiptGallery'

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [request, setRequest] = useState<PaymentRequest | null>(null)
  const [requester, setRequester] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const fetchRequest = async () => {
      const snap = await getDoc(doc(db, 'requests', id))
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as PaymentRequest
        setRequest(data)
        const userSnap = await getDoc(doc(db, 'users', data.requestedBy.uid))
        if (userSnap.exists()) {
          setRequester(userSnap.data() as AppUser)
        }
      }
      setLoading(false)
    }
    fetchRequest()
  }, [id])

  if (loading) return <Layout><Spinner /></Layout>
  if (!request) return <Layout><div className="text-center py-16 text-gray-500">신청서를 찾을 수 없습니다.</div></Layout>

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">지불 / 환불 신청서</h2>
            <p className="text-sm text-gray-500">Payment / Reimbursement Request Form</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <InfoGrid className="mb-6" items={[
          { label: '신청자', value: request.payee },
          { label: '날짜', value: request.date },
          { label: '전화번호', value: request.phone },
          { label: '세션', value: request.session },
          { label: '은행 / 계좌', value: `${request.bankName} ${request.bankAccount}` },
          { label: '위원회', value: COMMITTEE_LABELS[request.committee] },
        ]} />

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">설명</th>
                <th className="text-left px-3 py-2">예산 코드</th>
                <th className="text-right px-3 py-2">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {request.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2">{item.budgetCode}</td>
                  <td className="px-3 py-2 text-right">₩{item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-medium">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right">합계</td>
                <td className="px-3 py-2 text-right">₩{request.totalAmount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <ReceiptGallery receipts={request.receipts} />

        {/* 통장사본 */}
        {requester?.bankBookDriveUrl && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">통장사본</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden inline-block">
              <a href={requester.bankBookDriveUrl} target="_blank" rel="noopener noreferrer">
                {requester.bankBookImage ? (
                  <img src={requester.bankBookImage} alt="통장사본" className="max-h-48 object-contain bg-gray-50" />
                ) : (
                  <img src={`https://drive.google.com/thumbnail?id=${requester.bankBookDriveId}&sz=w400`}
                    alt="통장사본" className="max-h-48 object-contain bg-gray-50" />
                )}
              </a>
              <div className="px-3 py-2 bg-gray-50 border-t">
                <a href={requester.bankBookDriveUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">Google Drive에서 보기</a>
              </div>
            </div>
          </div>
        )}

        {request.comments && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-1">비고</h3>
            <p className="text-sm text-gray-600">{request.comments}</p>
          </div>
        )}

        {request.status === 'rejected' && request.rejectionReason && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800 mb-1">반려 사유</h3>
            <p className="text-sm text-red-700">{request.rejectionReason}</p>
          </div>
        )}

        {request.status === 'rejected' && user?.uid === request.requestedBy.uid && (
          <div className="mb-6">
            <button onClick={() => navigate(`/request/resubmit/${request.id}`)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
              수정 후 재신청
            </button>
          </div>
        )}

        <InfoGrid className="border-t pt-4" items={[
          { label: '신청자', value: `${request.requestedBy.name} (${request.requestedBy.email})` },
          { label: '승인자', value: request.approvedBy ? `${request.approvedBy.name} (${request.approvedBy.email})` : '-' },
        ]} />

        {request.approvalSignature && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">승인 서명</h3>
            <div className="border border-gray-200 rounded p-2 bg-gray-50 inline-block">
              <img src={request.approvalSignature} alt="승인 서명" className="max-h-20" />
            </div>
          </div>
        )}

        {request.status === 'settled' && request.settlementId && (
          <div className="mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500">정산 리포트: </span>
            <a href={`/admin/settlement/${request.settlementId}`}
              className="text-sm text-purple-600 hover:underline">리포트 보기</a>
          </div>
        )}

        <div className="mt-6">
          <Link to="/my-requests" className="text-sm text-blue-600 hover:underline">← 목록으로</Link>
        </div>
      </div>
    </Layout>
  )
}
