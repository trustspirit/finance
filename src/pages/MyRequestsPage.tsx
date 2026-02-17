import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { PaymentRequest } from '../types'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'

export default function MyRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchRequests = async () => {
      const q = query(
        collection(db, 'requests'),
        where('requestedBy.uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      )
      const snap = await getDocs(q)
      setRequests(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PaymentRequest)))
      setLoading(false)
    }
    fetchRequests()
  }, [user])

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">내 신청 내역</h2>
        <Link to="/request/new"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          새 신청서 작성
        </Link>
      </div>
      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">신청 내역이 없습니다.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">날짜</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">세션</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">항목수</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">합계</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/request/${req.id}`} className="text-blue-600 hover:underline">{req.date}</Link>
                  </td>
                  <td className="px-4 py-3">{req.session}</td>
                  <td className="px-4 py-3">{req.items.length}건</td>
                  <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
