import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { updateDoc } from 'firebase/firestore'
import { RequestItem, Receipt, Committee, PaymentRequest } from '../types'
import Layout from '../components/Layout'
import ItemRow from '../components/ItemRow'
import FileUpload from '../components/FileUpload'
import CommitteeSelect from '../components/CommitteeSelect'
import ConfirmModal from '../components/ConfirmModal'
import { formatPhone, fileToBase64 } from '../lib/utils'
import ErrorAlert from '../components/ErrorAlert'

const emptyItem = (): RequestItem => ({ description: '', budgetCode: 0, amount: 0 })

export default function ResubmitPage() {
  const { id } = useParams<{ id: string }>()
  const { user, appUser } = useAuth()
  const navigate = useNavigate()

  const [original, setOriginal] = useState<PaymentRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [payee, setPayee] = useState('')
  const [phone, setPhone] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [date, setDate] = useState('')
  const [session] = useState('한국')
  const [committee, setCommittee] = useState<Committee>('operations')
  const [items, setItems] = useState<RequestItem[]>([emptyItem()])
  const [files, setFiles] = useState<File[]>([])
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!id) return
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'requests', id))
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as PaymentRequest
        setOriginal(data)
        setPayee(data.payee)
        setPhone(data.phone)
        setBankName(data.bankName)
        setBankAccount(data.bankAccount)
        setDate(data.date)
        setCommittee(data.committee)
        setItems(data.items.length > 0 ? data.items : [emptyItem()])
        setComments(data.comments)
      }
      setLoading(false)
    }
    fetch()
  }, [id])

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
  const validItems = items.filter((item) => item.description && item.amount > 0)

  const hasChanges = (): boolean => {
    if (!original) return false
    if (payee !== original.payee) return true
    if (phone !== original.phone) return true
    if (bankName !== original.bankName) return true
    if (bankAccount !== original.bankAccount) return true
    if (date !== original.date) return true
    if (committee !== original.committee) return true
    if (comments !== original.comments) return true
    if (files.length > 0) return true
    // Compare items field by field
    if (original.items.length !== validItems.length) return true
    const itemsChanged = validItems.some((curr, i) => {
      const orig = original.items[i]
      return curr.description !== orig.description ||
             curr.budgetCode !== orig.budgetCode ||
             curr.amount !== orig.amount
    })
    if (itemsChanged) return true
    return false
  }

  const updateItem = (index: number, item: RequestItem) => {
    const next = [...items]
    next[index] = item
    setItems(next)
  }

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    setItems(next.length > 0 ? next : [emptyItem()])
  }

  const addItem = () => {
    if (items.length < 10) setItems([...items, emptyItem()])
  }

  const validate = (): string[] => {
    const errs: string[] = []
    if (!payee.trim()) errs.push('신청자를 입력해주세요.')
    if (!phone.trim()) errs.push('전화번호를 입력해주세요.')
    if (!bankName.trim()) errs.push('은행명을 입력해주세요.')
    if (!bankAccount.trim()) errs.push('계좌번호를 입력해주세요.')
    if (!date) errs.push('날짜를 선택해주세요.')
    if (validItems.length === 0) errs.push('최소 1개 이상의 항목을 입력해주세요.')
    const missingBudgetCode = validItems.some((item) => !item.budgetCode)
    if (missingBudgetCode) errs.push('모든 항목의 예산 코드를 선택해주세요.')
    // receipts: use new files or keep original
    if (files.length === 0 && (!original?.receipts || original.receipts.length === 0)) {
      errs.push('영수증 파일을 첨부해주세요.')
    }
    if (!appUser?.bankBookDriveUrl) errs.push('통장사본이 등록되지 않았습니다.')
    if (!hasChanges()) errs.push('원본 신청서에서 변경된 내용이 없습니다. 수정 후 재신청해주세요.')
    return errs
  }

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validate()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])
    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    if (!user || !appUser || !original) return
    setShowConfirm(false)
    setSubmitting(true)

    try {
      let receipts: Receipt[] = []
      if (files.length > 0) {
        const uploadFn = httpsCallable<{ files: { name: string; data: string }[]; committee: string }, Receipt[]>(
          functions, 'uploadReceipts'
        )
        const fileData = await Promise.all(
          files.map(async (f) => ({ name: f.name, data: await fileToBase64(f) }))
        )
        const result = await uploadFn({ files: fileData, committee })
        receipts = result.data
      } else {
        receipts = original.receipts
      }

      const profileUpdates: Record<string, string> = {}
      if (phone.trim() !== (appUser.phone || '')) profileUpdates.phone = phone.trim()
      if (bankName.trim() !== (appUser.bankName || '')) profileUpdates.bankName = bankName.trim()
      if (bankAccount.trim() !== (appUser.bankAccount || '')) profileUpdates.bankAccount = bankAccount.trim()
      if (Object.keys(profileUpdates).length > 0) {
        await updateDoc(doc(db, 'users', user.uid), profileUpdates)
      }

      await addDoc(collection(db, 'requests'), {
        createdAt: serverTimestamp(),
        status: 'pending',
        payee,
        phone,
        bankName,
        bankAccount,
        date,
        session,
        committee,
        items: validItems,
        totalAmount: validItems.reduce((sum, item) => sum + item.amount, 0),
        receipts,
        requestedBy: { uid: user.uid, name: appUser.displayName || appUser.name, email: appUser.email },
        approvedBy: null,
        approvalSignature: null,
        approvedAt: null,
        rejectionReason: null,
        settlementId: null,
        originalRequestId: original.id,
        comments,
      })

      navigate('/my-requests')
    } catch (err) {
      console.error(err)
      alert('제출에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Layout><p className="text-gray-500">불러오는 중...</p></Layout>
  if (!original) return <Layout><p className="text-gray-500">신청서를 찾을 수 없습니다.</p></Layout>
  if (original.status !== 'rejected') return <Layout><p className="text-gray-500">반려된 신청서만 재신청할 수 있습니다.</p></Layout>

  return (
    <Layout>
      {/* 반려 사유 표시 */}
      {original.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 max-w-4xl mx-auto">
          <h3 className="text-sm font-medium text-red-800 mb-1">반려 사유</h3>
          <p className="text-sm text-red-700">{original.rejectionReason}</p>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-1">수정 후 재신청</h2>
        <p className="text-sm text-gray-500 mb-6">반려된 신청서를 수정하여 다시 제출합니다. 최소 1개 이상의 항목을 변경해야 합니다.</p>

        <ErrorAlert errors={errors} />

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">신청자 <span className="text-red-500">*</span></label>
            <input type="text" value={payee} onChange={(e) => setPayee(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜 <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 <span className="text-red-500">*</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">세션</label>
            <input type="text" readOnly value={session}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">은행 <span className="text-red-500">*</span></label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호 <span className="text-red-500">*</span></label>
            <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <CommitteeSelect value={committee} onChange={setCommittee} />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">항목 <span className="text-red-500">*</span></h3>
            <button type="button" onClick={addItem} disabled={items.length >= 10}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400">+ 항목 추가</button>
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

        <FileUpload
          files={files}
          onFilesChange={setFiles}
          label="영수증"
          existingCount={original.receipts.length}
          existingLabel={`기존 영수증 ${original.receipts.length}개가 유지됩니다. 새 파일을 선택하면 교체됩니다.`}
        />

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)}
            rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex items-center justify-between">
          <Link to={`/request/${original.id}`} className="text-sm text-gray-500 hover:underline">← 원본 신청서</Link>
          <button type="submit" disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
            {submitting ? '제출 중...' : '재신청'}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="재신청 확인"
        items={[
          { label: '신청자', value: payee },
          { label: '항목 수', value: `${validItems.length}건` },
          { label: '영수증', value: files.length > 0 ? `${files.length}개 (새 파일)` : `${original.receipts.length}개 (기존 유지)` },
        ]}
        totalAmount={totalAmount}
        confirmLabel="확인 및 재신청"
      />
    </Layout>
  )
}
