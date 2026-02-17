import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { RequestItem, Receipt } from '../types'
import { SESSIONS } from '../constants/sessions'
import Layout from '../components/Layout'
import ItemRow from '../components/ItemRow'

const emptyItem = (): RequestItem => ({ description: '', budgetCode: 0, amount: 0 })

export default function RequestFormPage() {
  const { user, appUser } = useAuth()
  const navigate = useNavigate()

  const [payee, setPayee] = useState(appUser?.name || '')
  const [phone, setPhone] = useState(appUser?.phone || '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [session, setSession] = useState('')
  const [items, setItems] = useState<RequestItem[]>([emptyItem()])
  const [files, setFiles] = useState<File[]>([])
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)

  const updateItem = (index: number, item: RequestItem) => {
    const next = [...items]
    next[index] = item
    setItems(next)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const addItem = () => {
    if (items.length < 10) setItems([...items, emptyItem()])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !appUser) return
    setSubmitting(true)

    try {
      let receipts: Receipt[] = []
      if (files.length > 0) {
        const uploadFn = httpsCallable<{ files: { name: string; data: string }[] }, Receipt[]>(
          functions,
          'uploadReceipts'
        )
        const fileData = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            data: await fileToBase64(f),
          }))
        )
        const result = await uploadFn({ files: fileData })
        receipts = result.data
      }

      const validItems = items.filter((item) => item.description && item.amount > 0)
      await addDoc(collection(db, 'requests'), {
        createdAt: serverTimestamp(),
        status: 'pending',
        payee,
        phone,
        date,
        session,
        items: validItems,
        totalAmount: validItems.reduce((sum, item) => sum + item.amount, 0),
        receipts,
        requestedBy: { uid: user.uid, name: appUser.name, email: appUser.email },
        approvedBy: null,
        approvedAt: null,
        comments,
      })

      navigate('/my-requests')
    } catch (err) {
      console.error(err)
      alert('제출에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-1">지불 / 환불 신청서</h2>
        <p className="text-sm text-gray-500 mb-6">Payment / Reimbursement Request Form</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">신청자 (Payee)</label>
            <input type="text" required value={payee} onChange={(e) => setPayee(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜 (Date)</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 (Phone)</label>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">세션 (Session)</label>
            <select required value={session} onChange={(e) => setSession(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">선택하세요</option>
              {SESSIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">항목 (Items)</h3>
            <button type="button" onClick={addItem} disabled={items.length >= 10}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400">
              + 항목 추가
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <ItemRow key={i} index={i} item={item} onChange={updateItem} onRemove={removeItem}
                canRemove={items.length > 1} />
            ))}
          </div>
          <div className="flex justify-end mt-3 pt-3 border-t">
            <span className="text-sm font-medium">합계: ₩{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">영수증 (Receipts)</label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400 mt-1">영수증 이미지 또는 PDF 파일 (Google Drive에 업로드됩니다)</p>
          {files.length > 0 && (
            <ul className="mt-2 text-sm text-gray-600">
              {files.map((f, i) => <li key={i}>{f.name}</li>)}
            </ul>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">비고 (Comments)</label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)}
            rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
            {submitting ? '제출 중...' : '신청서 제출'}
          </button>
        </div>
      </form>
    </Layout>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}
