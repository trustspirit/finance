import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { PaymentRequest } from '../types'
import Layout from '../components/Layout'

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  totalAmount: number
  approvedAmount: number
  bySession: Record<string, { count: number; amount: number }>
  byBudgetCode: Record<number, { count: number; amount: number }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const snap = await getDocs(collection(db, 'requests'))
      const requests = snap.docs.map((d) => d.data() as PaymentRequest)

      const stats: Stats = {
        total: requests.length,
        pending: requests.filter((r) => r.status === 'pending').length,
        approved: requests.filter((r) => r.status === 'approved').length,
        rejected: requests.filter((r) => r.status === 'rejected').length,
        totalAmount: requests.reduce((sum, r) => sum + r.totalAmount, 0),
        approvedAmount: requests.filter((r) => r.status === 'approved').reduce((sum, r) => sum + r.totalAmount, 0),
        bySession: {},
        byBudgetCode: {},
      }

      requests.forEach((r) => {
        if (!stats.bySession[r.session]) stats.bySession[r.session] = { count: 0, amount: 0 }
        stats.bySession[r.session].count++
        stats.bySession[r.session].amount += r.totalAmount

        r.items.forEach((item) => {
          if (!stats.byBudgetCode[item.budgetCode]) stats.byBudgetCode[item.budgetCode] = { count: 0, amount: 0 }
          stats.byBudgetCode[item.budgetCode].count++
          stats.byBudgetCode[item.budgetCode].amount += item.amount
        })
      })

      setStats(stats)
      setLoading(false)
    }
    fetchStats()
  }, [])

  if (loading) return <Layout><p className="text-gray-500">불러오는 중...</p></Layout>
  if (!stats) return <Layout><p className="text-gray-500">데이터가 없습니다.</p></Layout>

  return (
    <Layout>
      <h2 className="text-xl font-bold mb-6">대시보드</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="전체 신청" value={`${stats.total}건`} />
        <StatCard label="대기중" value={`${stats.pending}건`} color="yellow" />
        <StatCard label="승인" value={`${stats.approved}건`} color="green" />
        <StatCard label="총 신청 금액" value={`₩${stats.totalAmount.toLocaleString()}`} color="blue" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">세션별 현황</h3>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">세션</th>
                <th className="text-right py-2">건수</th>
                <th className="text-right py-2">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(stats.bySession).map(([session, data]) => (
                <tr key={session}>
                  <td className="py-2">{session}</td>
                  <td className="py-2 text-right">{data.count}건</td>
                  <td className="py-2 text-right">₩{data.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">예산 코드별 현황</h3>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">코드</th>
                <th className="text-right py-2">건수</th>
                <th className="text-right py-2">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(stats.byBudgetCode).map(([code, data]) => (
                <tr key={code}>
                  <td className="py-2">{code}</td>
                  <td className="py-2 text-right">{data.count}건</td>
                  <td className="py-2 text-right">₩{data.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}

function StatCard({ label, value, color = 'gray' }: { label: string; value: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-white',
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
  }
  return (
    <div className={`rounded-lg shadow border p-4 ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}
