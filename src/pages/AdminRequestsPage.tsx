import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { PaymentRequest, RequestStatus } from '../types'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import SignaturePad from '../components/SignaturePad'

export default function AdminRequestsPage() {
  const { user, appUser } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')
  const [signModalRequestId, setSignModalRequestId] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState(appUser?.signature || '')

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRequest)))
      } catch (error) {
        console.error('Failed to fetch requests:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchRequests()
  }, [])

  const handleApproveWithSign = (requestId: string) => {
    setSignatureData(appUser?.signature || '')
    setSignModalRequestId(requestId)
  }

  const handleConfirmApproval = async () => {
    if (!user || !appUser || !signModalRequestId) return
    if (!signatureData) {
      alert('서명을 해주세요.')
      return
    }

    const approverName = appUser.displayName || appUser.name

    await updateDoc(doc(db, 'requests', signModalRequestId), {
      status: 'approved',
      approvedBy: { uid: user.uid, name: approverName, email: appUser.email },
      approvalSignature: signatureData,
      approvedAt: serverTimestamp(),
    })

    setRequests((prev) =>
      prev.map((r) =>
        r.id === signModalRequestId
          ? { ...r, status: 'approved' as const, approvedBy: { uid: user.uid, name: approverName, email: appUser.email }, approvalSignature: signatureData }
          : r
      )
    )
    setSignModalRequestId(null)
  }

  const handleReject = async (requestId: string) => {
    if (!user || !appUser) return
    const confirmed = window.confirm('반려하시겠습니까?')
    if (!confirmed) return

    const approverName = appUser.displayName || appUser.name

    await updateDoc(doc(db, 'requests', requestId), {
      status: 'rejected',
      approvedBy: { uid: user.uid, name: approverName, email: appUser.email },
      approvalSignature: null,
      approvedAt: serverTimestamp(),
    })

    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rejected' as const, approvedBy: { uid: user.uid, name: approverName, email: appUser.email } }
          : r
      )
    )
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">신청 관리</h2>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'settled', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {f === 'all' ? '전체' : f === 'pending' ? '대기' : f === 'approved' ? '승인' : f === 'settled' ? '정산' : '반려'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">날짜</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">신청자</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">위원회</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">합계</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/request/${req.id}`} className="text-blue-600 hover:underline">{req.date}</Link>
                  </td>
                  <td className="px-4 py-3">{req.payee}</td>
                  <td className="px-4 py-3">{req.committee === 'operations' ? '운영' : '준비'}</td>
                  <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 text-center">
                    {req.status === 'pending' && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleApproveWithSign(req.id)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">승인</button>
                        <button onClick={() => handleReject(req.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">반려</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 서명 승인 모달 */}
      {signModalRequestId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-2">승인 서명</h3>
            <p className="text-sm text-gray-500 mb-4">승인을 위해 아래에 서명해주세요.</p>

            {appUser?.signature && (
              <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={signatureData === appUser.signature}
                    onChange={(e) => setSignatureData(e.target.checked ? appUser.signature : '')}
                  />
                  <span className="text-sm text-gray-600">저장된 서명 사용</span>
                </label>
                {signatureData === appUser.signature && (
                  <div className="mt-2 border border-gray-200 rounded p-2 bg-gray-50">
                    <img src={appUser.signature} alt="저장된 서명" className="max-h-24 mx-auto" />
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
                취소
              </button>
              <button onClick={handleConfirmApproval} disabled={!signatureData}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-400">
                서명하고 승인
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
