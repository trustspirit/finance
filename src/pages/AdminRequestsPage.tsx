import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { PaymentRequest, RequestStatus } from '../types'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'

export default function AdminRequestsPage() {
  const { user, appUser } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')

  useEffect(() => {
    const fetchRequests = async () => {
      const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRequest)))
      setLoading(false)
    }
    fetchRequests()
  }, [])

  const handleAction = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!user || !appUser) return
    const confirmed = window.confirm(status === 'approved' ? '승인하시겠습니까?' : '반려하시겠습니까?')
    if (!confirmed) return

    await updateDoc(doc(db, 'requests', requestId), {
      status,
      approvedBy: { uid: user.uid, name: appUser.name, email: appUser.email },
      approvedAt: serverTimestamp(),
    })

    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status, approvedBy: { uid: user.uid, name: appUser.name, email: appUser.email } }
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
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {f === 'all' ? '전체' : f === 'pending' ? '대기' : f === 'approved' ? '승인' : '반려'}
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">세션</th>
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
                  <td className="px-4 py-3">{req.session}</td>
                  <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 text-center">
                    {req.status === 'pending' && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleAction(req.id, 'approved')}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">승인</button>
                        <button onClick={() => handleAction(req.id, 'rejected')}
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
    </Layout>
  )
}
