import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Settlement } from '../types'
import Layout from '../components/Layout'

export default function SettlementListPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const q = query(collection(db, 'settlements'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Settlement)))
      } catch (error) {
        console.error('Failed to fetch settlements:', error)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">정산 내역</h2>
        <Link to="/admin/settlement/new"
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700">
          새 정산 처리
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : settlements.length === 0 ? (
        <p className="text-gray-500">정산 내역이 없습니다.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">정산일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">신청자</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">위원회</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">은행/계좌</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">총액</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">신청 건수</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">리포트</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {settlements.map((s) => {
                const dateStr = s.createdAt && typeof s.createdAt === 'object' && 'toDate' in s.createdAt
                  ? (s.createdAt as unknown as { toDate: () => Date }).toDate().toLocaleDateString('ko-KR')
                  : '-'
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{dateStr}</td>
                    <td className="px-4 py-3">{s.payee}</td>
                    <td className="px-4 py-3">{s.committee === 'operations' ? '운영' : '준비'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.bankName} {s.bankAccount}</td>
                    <td className="px-4 py-3 text-right font-medium">₩{s.totalAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{s.requestIds.length}건</td>
                    <td className="px-4 py-3 text-center">
                      <Link to={`/admin/settlement/${s.id}`}
                        className="text-purple-600 hover:underline text-sm">보기</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
