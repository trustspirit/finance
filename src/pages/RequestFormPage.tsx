import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { updateDoc, doc } from 'firebase/firestore'
import { RequestItem, Receipt, Committee } from '../types'
import Layout from '../components/Layout'
import ItemRow from '../components/ItemRow'

const DRAFT_KEY = 'request-form-draft'
const emptyItem = (): RequestItem => ({ description: '', budgetCode: 0, amount: 0 })

interface DraftData {
  payee: string
  phone: string
  bankName: string
  bankAccount: string
  date: string
  committee: Committee
  items: RequestItem[]
  comments: string
  savedAt: string
}

function loadDraft(): DraftData | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveDraft(data: Omit<DraftData, 'savedAt'>) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }))
}

function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY)
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function RequestFormPage() {
  const { user, appUser } = useAuth()
  const navigate = useNavigate()

  const draft = loadDraft()

  const [payee, setPayee] = useState(draft?.payee || appUser?.displayName || appUser?.name || '')
  const [phone, setPhone] = useState(draft?.phone || appUser?.phone || '')
  const [bankName, setBankName] = useState(draft?.bankName || appUser?.bankName || '')
  const [bankAccount, setBankAccount] = useState(draft?.bankAccount || appUser?.bankAccount || '')
  const [date, setDate] = useState(draft?.date || new Date().toISOString().slice(0, 10))
  const [session] = useState('한국')
  const [committee, setCommittee] = useState<Committee>(draft?.committee || appUser?.defaultCommittee || 'operations')
  const [items, setItems] = useState<RequestItem[]>(draft?.items?.length ? draft.items : [emptyItem()])
  const [files, setFiles] = useState<File[]>([])
  const [comments, setComments] = useState(draft?.comments || '')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(!!draft)

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
  const validItems = items.filter((item) => item.description && item.amount > 0)

  // Check if form has meaningful content (beyond defaults)
  const hasContent = useCallback(() => {
    const hasItems = items.some((item) => item.description || item.amount > 0)
    const hasComments = comments.trim().length > 0
    return hasItems || hasComments
  }, [items, comments])

  // Auto-save draft on changes
  useEffect(() => {
    if (submitted) return
    const timer = setTimeout(() => {
      if (hasContent()) {
        saveDraft({ payee, phone, bankName, bankAccount, date, committee, items, comments })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [payee, phone, bankName, bankAccount, date, committee, items, comments, hasContent, submitted])

  // Block navigation when form has content (except to /settings)
  const blocker = useBlocker(({ nextLocation }) => {
    if (submitted || submitting || showConfirm) return false
    if (nextLocation.pathname === '/settings') return false
    return hasContent()
  })

  // Browser tab close / refresh warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasContent() && !submitted) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasContent, submitted])

  const handleClearDraft = () => {
    clearDraft()
    setPayee(appUser?.displayName || appUser?.name || '')
    setPhone(appUser?.phone || '')
    setBankName(appUser?.bankName || '')
    setBankAccount(appUser?.bankAccount || '')
    setDate(new Date().toISOString().slice(0, 10))
    setCommittee(appUser?.defaultCommittee || 'operations')
    setItems([emptyItem()])
    setComments('')
    setFiles([])
    setShowDraftBanner(false)
  }

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

  const validate = (): string[] => {
    const errs: string[] = []
    if (!payee.trim()) errs.push('신청자를 입력해주세요.')
    if (!phone.trim()) errs.push('전화번호를 입력해주세요.')
    if (!bankName.trim()) errs.push('은행명을 입력해주세요.')
    if (!bankAccount.trim()) errs.push('계좌번호를 입력해주세요.')
    if (!date) errs.push('날짜를 선택해주세요.')
    if (validItems.length === 0) errs.push('최소 1개 이상의 항목을 입력해주세요. (설명과 금액 필수)')
    const missingBudgetCode = validItems.some((item) => !item.budgetCode)
    if (missingBudgetCode) errs.push('모든 항목의 예산 코드를 선택해주세요.')
    if (files.length === 0) errs.push('영수증 파일을 첨부해주세요.')
    if (!appUser?.bankBookDriveUrl) errs.push('통장사본이 등록되지 않았습니다. 설정에서 통장사본을 업로드해주세요.')
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
    if (!user || !appUser) return
    setShowConfirm(false)
    setSubmitting(true)

    try {
      let receipts: Receipt[] = []
      if (files.length > 0) {
        const uploadFn = httpsCallable<{ files: { name: string; data: string }[]; committee: string }, Receipt[]>(
          functions,
          'uploadReceipts'
        )
        const fileData = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            data: await fileToBase64(f),
          }))
        )
        const result = await uploadFn({ files: fileData, committee })
        receipts = result.data
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
        settlementId: null,
        comments,
      })

      setSubmitted(true)
      clearDraft()
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
      {/* Draft restored banner */}
      {showDraftBanner && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-sm text-blue-700">
            이전에 작성 중이던 신청서가 복원되었습니다.
            {draft?.savedAt && (
              <span className="text-blue-500 ml-1">
                ({new Date(draft.savedAt).toLocaleString('ko-KR')})
              </span>
            )}
          </p>
          <button onClick={handleClearDraft}
            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap ml-3">
            초기화
          </button>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-1">지불 / 환불 신청서</h2>
        <p className="text-sm text-gray-500 mb-6">Payment / Reimbursement Request Form</p>

        {errors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm font-medium text-red-800 mb-1">다음 항목을 확인해주세요:</p>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              신청자 (Payee) <span className="text-red-500">*</span>
            </label>
            <input type="text" value={payee} onChange={(e) => setPayee(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              날짜 (Date) <span className="text-red-500">*</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 (Phone) <span className="text-red-500">*</span>
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">세션 (Session)</label>
            <input type="text" readOnly value={session}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              은행 (Bank) <span className="text-red-500">*</span>
            </label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
              placeholder="예: 국민은행"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              계좌번호 (Account) <span className="text-red-500">*</span>
            </label>
            <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
              placeholder="예: 123-456-789012"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">위원회 (Committee)</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="committee" value="operations"
                  checked={committee === 'operations'} onChange={() => setCommittee('operations')}
                  className="text-blue-600" />
                <span className="text-sm">운영 위원회</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="committee" value="preparation"
                  checked={committee === 'preparation'} onChange={() => setCommittee('preparation')}
                  className="text-blue-600" />
                <span className="text-sm">준비 위원회</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              항목 (Items) <span className="text-red-500">*</span>
            </h3>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            영수증 (Receipts) <span className="text-red-500">*</span>
          </label>
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

      {/* 제출 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">신청서 제출 확인</h3>

            <div className="text-sm space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">신청자</span>
                <span>{payee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">날짜</span>
                <span>{date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">은행 / 계좌</span>
                <span>{bankName} {bankAccount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">위원회</span>
                <span>{committee === 'operations' ? '운영 위원회' : '준비 위원회'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">항목 수</span>
                <span>{validItems.length}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">영수증</span>
                <span>{files.length}개 파일</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
              <div className="flex justify-between text-sm font-medium">
                <span>항목 총액</span>
                <span>₩{totalAmount.toLocaleString()}</span>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                영수증 금액과 항목 총액(₩{totalAmount.toLocaleString()})이 일치하는지 확인해주세요.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleSubmit}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
                확인 및 제출
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 페이지 이동 확인 모달 */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-2">작성 중인 신청서가 있습니다</h3>
            <p className="text-sm text-gray-500 mb-4">
              작성 내용이 자동 저장되어 있습니다. 다시 돌아오면 이어서 작성할 수 있습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => blocker.reset?.()}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                계속 작성
              </button>
              <button onClick={() => blocker.proceed?.()}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
                페이지 이동
              </button>
            </div>
          </div>
        </div>
      )}
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
