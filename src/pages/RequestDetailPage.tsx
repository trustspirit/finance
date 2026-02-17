import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { PaymentRequest, AppUser } from '../types'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
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
        // Fetch requester profile for bank book
        const userSnap = await getDoc(doc(db, 'users', data.requestedBy.uid))
        if (userSnap.exists()) {
          setRequester(userSnap.data() as AppUser)
        }
      }
      setLoading(false)
    }
    fetchRequest()
  }, [id])

  if (loading) return <Layout><p className="text-gray-500">불러오는 중...</p></Layout>
  if (!request) return <Layout><p className="text-gray-500">신청서를 찾을 수 없습니다.</p></Layout>

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">지불 / 환불 신청서</h2>
            <p className="text-sm text-gray-500">Payment / Reimbursement Request Form</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div><span className="text-gray-500">신청자:</span> {request.payee}</div>
          <div><span className="text-gray-500">날짜:</span> {request.date}</div>
          <div><span className="text-gray-500">전화번호:</span> {request.phone}</div>
          <div><span className="text-gray-500">세션:</span> {request.session}</div>
          <div><span className="text-gray-500">은행 / 계좌:</span> {request.bankName} {request.bankAccount}</div>
          <div><span className="text-gray-500">위원회:</span> {request.committee === 'operations' ? '운영 위원회' : '준비 위원회'}</div>
        </div>

        <table className="w-full text-sm mb-6">
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

        {/* 영수증 - 이미지 미리보기 포함 */}
        {request.receipts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">영수증 ({request.receipts.length}개)</h3>
            <div className="grid grid-cols-2 gap-3">
              {request.receipts.map((r, i) => (
                <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                  <a href={r.driveUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={`https://drive.google.com/thumbnail?id=${r.driveFileId}&sz=w400`}
                      alt={r.fileName}
                      className="w-full h-48 object-contain bg-gray-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </a>
                  <div className="px-3 py-2 bg-gray-50 border-t">
                    <a href={r.driveUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate block">{r.fileName}</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 통장사본 */}
        {requester?.bankBookDriveUrl && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">통장사본</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden inline-block">
              <a href={requester.bankBookDriveUrl} target="_blank" rel="noopener noreferrer">
                {requester.bankBookImage ? (
                  <img src={requester.bankBookImage} alt="통장사본"
                    className="max-h-48 object-contain bg-gray-50" />
                ) : (
                  <img
                    src={`https://drive.google.com/thumbnail?id=${requester.bankBookDriveId}&sz=w400`}
                    alt="통장사본"
                    className="max-h-48 object-contain bg-gray-50"
                  />
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

        <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
          <div>
            <span className="text-gray-500">신청자:</span> {request.requestedBy.name} ({request.requestedBy.email})
          </div>
          <div>
            <span className="text-gray-500">승인자:</span>{' '}
            {request.approvedBy ? `${request.approvedBy.name} (${request.approvedBy.email})` : '-'}
          </div>
        </div>

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
