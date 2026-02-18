import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { PaymentRequest } from '../types'
import Layout from '../components/Layout'

export default function SettlementPage() {
  const { t } = useTranslation()
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

  // Group by payee (uid + bank account to handle different accounts)
  const groupedByPayee = selectedRequests.reduce<Record<string, PaymentRequest[]>>((acc, req) => {
    const key = `${req.requestedBy.uid}|${req.bankName}|${req.bankAccount}`
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  const handleSettle = async () => {
    if (!user || !appUser || selected.size === 0) return
    const confirmed = window.confirm(t('settlement.settleConfirm', { count: selected.size, payeeCount: Object.keys(groupedByPayee).length }))
    if (!confirmed) return

    setProcessing(true)
    try {
      const creatorName = appUser.displayName || appUser.name

      const batch = writeBatch(db)

      for (const [, reqs] of Object.entries(groupedByPayee)) {
        const first = reqs[0]
        const allItems = reqs.flatMap((r) => r.items)
        const allReceipts = reqs.flatMap((r) => r.receipts)
        const totalAmount = allItems.reduce((sum, item) => sum + item.amount, 0)

        const settlementRef = doc(collection(db, 'settlements'))
        batch.set(settlementRef, {
          createdAt: serverTimestamp(),
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
        })

        for (const req of reqs) {
          batch.update(doc(db, 'requests', req.id), {
            status: 'settled',
            settlementId: settlementRef.id,
          })
        }
      }

      await batch.commit()
      navigate('/admin/settlements')
    } catch (error) {
      console.error('Failed to create settlement:', error)
      alert(t('settlement.settleFailed'))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{t('settlement.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('settlement.description')}</p>
        </div>
        <button onClick={handleSettle} disabled={selected.size === 0 || processing}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
          {processing ? t('settlement.processing') : t('settlement.settle', { count: selected.size })}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-sm">
          {t('settlement.selectedSummary', { count: selected.size, payeeCount: Object.keys(groupedByPayee).length, amount: selectedRequests.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString() })}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">{t('settlement.noApproved')}</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === requests.length}
                    onChange={toggleAll} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.date')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.payee')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.committee')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.items')}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t('field.totalAmount')}</th>
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
                  <td className="px-4 py-3">{req.committee === 'operations' ? t('committee.operationsShort') : t('committee.preparationShort')}</td>
                  <td className="px-4 py-3">{t('form.itemCount', { count: req.items.length })}</td>
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
