import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { PaymentRequest } from '../types'
import { UNIQUE_BUDGET_CODES } from '../constants/budgetCodes'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'

interface BudgetConfig {
  totalBudget: number
  byCode: Record<number, number>
}

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  totalAmount: number
  approvedAmount: number
  pendingAmount: number
  byCommittee: Record<string, { count: number; amount: number; approvedAmount: number }>
  byBudgetCode: Record<number, { count: number; amount: number; approvedAmount: number }>
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { appUser } = useAuth()
  const { currentProject, refreshProjects } = useProject()
  const [stats, setStats] = useState<Stats | null>(null)
  const [budget, setBudget] = useState<BudgetConfig>({ totalBudget: 0, byCode: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [tempBudget, setTempBudget] = useState<BudgetConfig>({ totalBudget: 0, byCode: {} })
  const [savingBudget, setSavingBudget] = useState(false)
  const [documentNo, setDocumentNo] = useState('')
  const [editingDocNo, setEditingDocNo] = useState(false)
  const [tempDocNo, setTempDocNo] = useState('')
  const [savingDocNo, setSavingDocNo] = useState(false)

  const canEditBudget = appUser?.role === 'admin' || appUser?.role === 'finance'

  useEffect(() => {
    if (!currentProject?.id) return
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch requests filtered by project
        const q = query(collection(db, 'requests'), where('projectId', '==', currentProject.id))
        const reqSnap = await getDocs(q)
        const requests = reqSnap.docs.map((d) => d.data() as PaymentRequest)

        const stats: Stats = {
          total: requests.length,
          pending: requests.filter((r) => r.status === 'pending').length,
          approved: requests.filter((r) => r.status === 'approved').length,
          rejected: requests.filter((r) => r.status === 'rejected').length,
          totalAmount: requests.reduce((sum, r) => sum + r.totalAmount, 0),
          approvedAmount: requests.filter((r) => r.status === 'approved' || r.status === 'settled').reduce((sum, r) => sum + r.totalAmount, 0),
          pendingAmount: requests.filter((r) => r.status === 'pending').reduce((sum, r) => sum + r.totalAmount, 0),
          byCommittee: {},
          byBudgetCode: {},
        }

        requests.forEach((r) => {
          const committee = r.committee || 'operations'
          if (!stats.byCommittee[committee]) stats.byCommittee[committee] = { count: 0, amount: 0, approvedAmount: 0 }
          stats.byCommittee[committee].count++
          stats.byCommittee[committee].amount += r.totalAmount
          if (r.status === 'approved' || r.status === 'settled') stats.byCommittee[committee].approvedAmount += r.totalAmount

          r.items.forEach((item) => {
            if (!stats.byBudgetCode[item.budgetCode]) stats.byBudgetCode[item.budgetCode] = { count: 0, amount: 0, approvedAmount: 0 }
            stats.byBudgetCode[item.budgetCode].count++
            stats.byBudgetCode[item.budgetCode].amount += item.amount
            if (r.status === 'approved' || r.status === 'settled') stats.byBudgetCode[item.budgetCode].approvedAmount += item.amount
          })
        })

        setStats(stats)

        // Read budget and documentNo from currentProject context
        if (currentProject?.budgetConfig) {
          setBudget(currentProject.budgetConfig)
          setTempBudget(currentProject.budgetConfig)
        }
        if (currentProject?.documentNo) {
          setDocumentNo(currentProject.documentNo)
          setTempDocNo(currentProject.documentNo)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        setError(t('common.noData'))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, currentProject?.id])

  const handleSaveBudget = async () => {
    if (!currentProject?.id) return
    setSavingBudget(true)
    try {
      await setDoc(doc(db, 'projects', currentProject.id), { budgetConfig: tempBudget }, { merge: true })
      setBudget(tempBudget)
      setEditingBudget(false)
      await refreshProjects()
    } catch (error) {
      console.error('Failed to save budget:', error)
      alert(t('dashboard.budgetSettings'))
    } finally {
      setSavingBudget(false)
    }
  }

  const handleSaveDocNo = async () => {
    if (!currentProject?.id) return
    setSavingDocNo(true)
    try {
      await setDoc(doc(db, 'projects', currentProject.id), { documentNo: tempDocNo }, { merge: true })
      setDocumentNo(tempDocNo)
      setEditingDocNo(false)
      await refreshProjects()
    } catch (error) {
      console.error('Failed to save document no:', error)
    } finally {
      setSavingDocNo(false)
    }
  }

  if (loading) return <Layout><Spinner /></Layout>
  if (error) return <Layout><div className="text-center py-16 text-red-500">{error}</div></Layout>
  if (!stats) return <Layout><div className="text-center py-16 text-gray-500">{t('common.noData')}</div></Layout>

  const remainingBudget = budget.totalBudget - stats.approvedAmount
  const usagePercent = budget.totalBudget > 0 ? Math.round((stats.approvedAmount / budget.totalBudget) * 100) : 0

  return (
    <Layout>
      <h2 className="text-xl font-bold mb-6">{t('dashboard.title')}</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('dashboard.totalRequests')} value={t('form.itemCount', { count: stats.total })} />
        <StatCard label={t('dashboard.pendingRequests')} value={`${t('form.itemCount', { count: stats.pending })} (₩${stats.pendingAmount.toLocaleString()})`} color="yellow" />
        <StatCard label={t('dashboard.approvedRequests')} value={`${t('form.itemCount', { count: stats.approved })} (₩${stats.approvedAmount.toLocaleString()})`} color="green" />
        <StatCard label={t('dashboard.rejectedRequests')} value={t('form.itemCount', { count: stats.rejected })} color="red" />
      </div>

      {/* Budget Overview */}
      {budget.totalBudget > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{t('dashboard.budgetOverview')}</h3>
          <div className="flex flex-wrap items-end gap-8 mb-3">
            <div>
              <p className="text-xs text-gray-500">{t('dashboard.totalBudget')}</p>
              <p className="text-lg font-bold">₩{budget.totalBudget.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('dashboard.used')}</p>
              <p className="text-lg font-bold text-blue-600">₩{stats.approvedAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('dashboard.pendingAmount')}</p>
              <p className="text-lg font-bold text-yellow-600">₩{stats.pendingAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('dashboard.remaining')}</p>
              <p className={`text-lg font-bold ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₩{remainingBudget.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">{t('dashboard.usage', { percent: usagePercent })}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By Committee */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{t('dashboard.byCommittee')}</h3>
          {Object.keys(stats.byCommittee).length === 0 ? (
            <div className="text-center py-16 text-gray-500">{t('common.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2">{t('field.committee')}</th>
                    <th className="text-right py-2">{t('dashboard.count')}</th>
                    <th className="text-right py-2">{t('dashboard.amount')}</th>
                    <th className="text-right py-2">{t('dashboard.approvedAmount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(stats.byCommittee).map(([key, data]) => (
                    <tr key={key}>
                      <td className="py-2">{t(`committee.${key}`, key)}</td>
                      <td className="py-2 text-right">{t('form.itemCount', { count: data.count })}</td>
                      <td className="py-2 text-right">₩{data.amount.toLocaleString()}</td>
                      <td className="py-2 text-right text-green-600">₩{data.approvedAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* By Budget Code */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{t('dashboard.byBudgetCode')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Code</th>
                  <th className="text-right py-2">{t('dashboard.count')}</th>
                  <th className="text-right py-2">{t('dashboard.approvedAmount')}</th>
                  {budget.totalBudget > 0 && <th className="text-right py-2">{t('dashboard.allocatedBudget')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {UNIQUE_BUDGET_CODES.map((code) => {
                  const data = stats.byBudgetCode[code] || { count: 0, amount: 0, approvedAmount: 0 }
                  const codeBudget = budget.byCode[code] || 0
                  const over = codeBudget > 0 && data.approvedAmount > codeBudget
                  return (
                    <tr key={code}>
                      <td className="py-2">
                        <span className="font-mono">{code}</span>
                        <span className="ml-2 text-gray-400 text-xs">{t(`budgetCode.${code}`)}</span>
                      </td>
                      <td className="py-2 text-right">{t('form.itemCount', { count: data.count })}</td>
                      <td className={`py-2 text-right ${over ? 'text-red-600 font-medium' : ''}`}>
                        ₩{data.approvedAmount.toLocaleString()}
                      </td>
                      {budget.totalBudget > 0 && (
                        <td className="py-2 text-right text-gray-500">
                          {codeBudget > 0 ? `₩${codeBudget.toLocaleString()}` : '-'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Budget Settings */}
      {canEditBudget && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">{t('dashboard.budgetSettings')}</h3>
            {!editingBudget ? (
              <button onClick={() => { setTempBudget(budget); setEditingBudget(true) }}
                className="text-sm text-blue-600 hover:text-blue-800">{t('common.edit')}</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditingBudget(false)}
                  className="text-sm text-gray-500 hover:text-gray-700">{t('common.cancel')}</button>
                <button onClick={handleSaveBudget} disabled={savingBudget}
                  className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400">
                  {savingBudget ? t('common.saving') : t('common.save')}
                </button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">{t('dashboard.totalBudget')}</label>
            {editingBudget ? (
              <input type="number" value={tempBudget.totalBudget || ''}
                onChange={(e) => setTempBudget({ ...tempBudget, totalBudget: parseInt(e.target.value) || 0 })}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-48"
                placeholder="0" />
            ) : (
              <p className="text-sm font-medium">
                {budget.totalBudget > 0 ? `₩${budget.totalBudget.toLocaleString()}` : t('dashboard.notSet')}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Code</th>
                  <th className="text-left py-2">{t('field.comments')}</th>
                  <th className="text-right py-2">{t('dashboard.allocatedBudget')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {UNIQUE_BUDGET_CODES.map((code) => (
                  <tr key={code}>
                    <td className="py-2 font-mono">{code}</td>
                    <td className="py-2 text-gray-500">{t(`budgetCode.${code}`)}</td>
                    <td className="py-2 text-right">
                      {editingBudget ? (
                        <input type="number" value={tempBudget.byCode[code] || ''}
                          onChange={(e) => setTempBudget({
                            ...tempBudget,
                            byCode: { ...tempBudget.byCode, [code]: parseInt(e.target.value) || 0 },
                          })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-full sm:w-36 text-right"
                          placeholder="0" />
                      ) : (
                        <span>{budget.byCode[code] ? `₩${budget.byCode[code].toLocaleString()}` : '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {editingBudget && (
                <tfoot className="border-t">
                  <tr>
                    <td colSpan={2} className="py-2 text-right font-medium">{t('dashboard.codeTotal')}</td>
                    <td className="py-2 text-right font-medium">
                      ₩{Object.values(tempBudget.byCode).reduce((sum, v) => sum + (v || 0), 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
      {/* Document No. Settings */}
      {canEditBudget && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">{t('dashboard.documentNoSettings')}</h3>
            {!editingDocNo ? (
              <button onClick={() => { setTempDocNo(documentNo); setEditingDocNo(true) }}
                className="text-sm text-blue-600 hover:text-blue-800">{t('common.edit')}</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditingDocNo(false)}
                  className="text-sm text-gray-500 hover:text-gray-700">{t('common.cancel')}</button>
                <button onClick={handleSaveDocNo} disabled={savingDocNo}
                  className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400">
                  {savingDocNo ? t('common.saving') : t('common.save')}
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('dashboard.documentNo')}</label>
            {editingDocNo ? (
              <input type="text" value={tempDocNo}
                onChange={(e) => setTempDocNo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full font-mono"
                placeholder="KOR01-6762808-5xxx-KYSA2025KOR" />
            ) : (
              <p className="text-sm font-mono font-medium">
                {documentNo || t('dashboard.notSet')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">{t('dashboard.documentNoHint')}</p>
          </div>
        </div>
      )}
    </Layout>
  )
}

function StatCard({ label, value, color = 'gray' }: { label: string; value: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-white',
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    red: 'bg-red-50 border-red-200',
  }
  return (
    <div className={`rounded-lg shadow border p-4 ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}
