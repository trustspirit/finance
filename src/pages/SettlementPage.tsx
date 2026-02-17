import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { PaymentRequest, Settlement } from '../types'
import Layout from '../components/Layout'

export default function SettlementPage() {
  const { user, appUser } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const fetchApproved = async () => {
      try {
        const q = query(collection(db, 'requests'), where('status', '==', 'approved'))
        const snap = await getDocs(q)
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRequest)))
      } catch (error) {
        console.error('Failed to fetch approved requests:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchApproved()
  }, [])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === requests.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(requests.map((r) => r.id)))
    }
  }

  const selectedRequests = requests.filter((r) => selected.has(r.id))

  // Group by payee (requestedBy.uid)
  const groupedByPayee = selectedRequests.reduce<Record<string, PaymentRequest[]>>((acc, req) => {
    const key = req.requestedBy.uid
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  const handleSettle = async () => {
    if (!user || !appUser || selected.size === 0) return
    const confirmed = window.confirm(`${selected.size}건의 신청서를 정산 처리하시겠습니까?\n신청자 ${Object.keys(groupedByPayee).length}명의 통합 리포트가 생성됩니다.`)
    if (!confirmed) return

    setProcessing(true)
    try {
      const creatorName = appUser.displayName || appUser.name

      for (const [, reqs] of Object.entries(groupedByPayee)) {
        const first = reqs[0]
        const allItems = reqs.flatMap((r) => r.items)
        const allReceipts = reqs.flatMap((r) => r.receipts)
        const totalAmount = allItems.reduce((sum, item) => sum + item.amount, 0)

        const settlement: Omit<Settlement, 'id'> = {
          createdAt: serverTimestamp() as unknown as Date,
          createdBy: { uid: user.uid, name: creatorName, email: appUser.email },
          payee: first.payee,
          phone: first.phone,
          bankName: first.bankName,
          bankAccount: first.bankAccount,
          session: first.session,
          committee: first.committee,
          items: allItems,
          totalAmount,
          receipts: allReceipts,
          requestIds: reqs.map((r) => r.id),
          approvalSignature: first.approvalSignature || null,
        }

        const docRef = await addDoc(collection(db, 'settlements'), settlement)

        // Update each request status to settled
        for (const req of reqs) {
          await updateDoc(doc(db, 'requests', req.id), {
            status: 'settled',
            settlementId: docRef.id,
          })
        }
      }

      navigate('/admin/settlements')
    } catch (error) {
      console.error('Failed to create settlement:', error)
      alert('정산 처리에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">정산 처리</h2>
          <p className="text-sm text-gray-500 mt-1">승인된 신청서를 선택하여 정산 처리합니다.</p>
        </div>
        <button onClick={handleSettle} disabled={selected.size === 0 || processing}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
          {processing ? '처리 중...' : `선택 항목 정산 (${selected.size}건)`}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-sm">
          <span className="font-medium">{selected.size}건</span> 선택 |
          신청자 <span className="font-medium">{Object.keys(groupedByPayee).length}명</span> |
          총액 <span className="font-medium">₩{selectedRequests.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()}</span>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">승인된 신청서가 없습니다.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === requests.length}
                    onChange={toggleAll} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">날짜</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">신청자</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">위원회</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">항목수</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((req) => (
                <tr key={req.id} className={`hover:bg-gray-50 ${selected.has(req.id) ? 'bg-purple-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(req.id)}
                      onChange={() => toggleSelect(req.id)} />
                  </td>
                  <td className="px-4 py-3">{req.date}</td>
                  <td className="px-4 py-3">{req.payee}</td>
                  <td className="px-4 py-3">{req.committee === 'operations' ? '운영' : '준비'}</td>
                  <td className="px-4 py-3">{req.items.length}건</td>
                  <td className="px-4 py-3 text-right">₩{req.totalAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
