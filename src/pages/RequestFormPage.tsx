import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../hooks/queries/queryKeys'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useCreateRequest, useMyRequests } from '../hooks/queries/useRequests'
import { useUploadReceipts } from '../hooks/queries/useCloudFunctions'
import { RequestItem, Receipt, Committee } from '../types'
import type { ScanReceiptResult } from '../hooks/queries/useCloudFunctions'
import Layout from '../components/Layout'
import ProcessingOverlay from '../components/ProcessingOverlay'
import ItemRow from '../components/ItemRow'
import ErrorAlert from '../components/ErrorAlert'
import FileUpload from '../components/FileUpload'
import CommitteeSelect from '../components/CommitteeSelect'
import ConfirmModal from '../components/ConfirmModal'
import { useTranslation } from 'react-i18next'
import { formatPhone, formatBankAccount, fileToBase64 } from '../lib/utils'
import BankSelect from '../components/BankSelect'

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

export default function RequestFormPage() {
  const { t } = useTranslation()
  const { user, appUser, updateAppUser } = useAuth()
  const { currentProject } = useProject()
  const navigate = useNavigate()

  const queryClient = useQueryClient()
  const createRequest = useCreateRequest()
  const uploadReceiptsMutation = useUploadReceipts()
  const { data: myRequests = [] } = useMyRequests(currentProject?.id, user?.uid)

  const [draft] = useState(loadDraft)

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

  // Re-format account number when bank changes
  const bankNameMounted = useRef(false)
  useEffect(() => {
    if (!bankNameMounted.current) { bankNameMounted.current = true; return }
    if (bankName && bankAccount) setBankAccount(formatBankAccount(bankAccount, bankName))
  }, [bankName]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (submitted) return false // Allow after successful submission
    if (submitting) return false // Allow during submission (navigate after submit)
    if (showConfirm) return true // Block while confirm modal is open
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
    const next = items.filter((_, i) => i !== index)
    setItems(next.length > 0 ? next : [emptyItem()])
  }

  const addItem = () => {
    if (items.length < 10) setItems([...items, emptyItem()])
  }

  const handleScanComplete = (result: ScanReceiptResult) => {
    if (result.items.length === 0) return
    const hasExisting = items.some(item => item.description || item.amount > 0)
    if (hasExisting && !confirm(t('ocr.replaceItems'))) return
    setItems(result.items.map(item => ({
      description: item.description,
      budgetCode: item.suggestedBudgetCode,
      amount: item.amount,
    })))
  }

  const validate = (): string[] => {
    const errs: string[] = []
    if (!payee.trim()) errs.push(t('validation.payeeRequired'))
    if (!phone.trim()) errs.push(t('validation.phoneRequired'))
    if (!bankName.trim()) errs.push(t('validation.bankRequired'))
    if (!bankAccount.trim()) errs.push(t('validation.bankAccountRequired'))
    if (!date) errs.push(t('validation.dateRequired'))
    if (validItems.length === 0) errs.push(t('validation.itemsRequired'))
    const missingBudgetCode = validItems.some((item) => !item.budgetCode)
    if (missingBudgetCode) errs.push(t('validation.budgetCodeRequired'))
    if (files.length === 0) errs.push(t('validation.receiptsRequired'))
    if (!appUser?.signature) errs.push(t('validation.signatureRequired'))
    if (!appUser?.bankBookUrl && !appUser?.bankBookDriveUrl) errs.push(t('validation.bankBookRequired'))
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

    // Check for duplicate amount in active requests
    const currentTotal = validItems.reduce((sum, item) => sum + item.amount, 0)
    const duplicate = myRequests.find(
      (r) => r.totalAmount === currentTotal && (r.status === 'pending' || r.status === 'approved')
    )
    if (duplicate) {
      if (!confirm(t('validation.duplicateAmount', { amount: currentTotal.toLocaleString(), date: duplicate.date }))) {
        return
      }
    }

    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    if (!user || !appUser || !currentProject) return
    setShowConfirm(false)
    setSubmitting(true)

    try {
      let receipts: Receipt[] = []
      if (files.length > 0) {
        const fileData = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            data: await fileToBase64(f),
          }))
        )
        receipts = await uploadReceiptsMutation.mutateAsync({
          files: fileData,
          committee,
          projectId: currentProject!.id,
        })
      }

      const profileUpdates: Record<string, string> = {}
      if (phone.trim() !== (appUser.phone || '')) profileUpdates.phone = phone.trim()
      if (bankName.trim() !== (appUser.bankName || '')) profileUpdates.bankName = bankName.trim()
      if (bankAccount.trim() !== (appUser.bankAccount || '')) profileUpdates.bankAccount = bankAccount.trim()
      if (Object.keys(profileUpdates).length > 0) {
        await updateAppUser(profileUpdates)
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
      }

      await createRequest.mutateAsync({
        projectId: currentProject!.id,
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
        reviewedBy: null,
        reviewedAt: null,
        approvedBy: null,
        approvalSignature: null,
        approvedAt: null,
        rejectionReason: null,
        settlementId: null,
        originalRequestId: null,
        comments,
      })

      setSubmitted(true)
      clearDraft()
      navigate('/my-requests')
    } catch (err) {
      console.error(err)
      alert(t('form.submitFailed'))
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
            {t('form.draftRestored')}
            {draft?.savedAt && (
              <span className="text-blue-500 ml-1">
                ({new Date(draft.savedAt).toLocaleString('ko-KR')})
              </span>
            )}
          </p>
          <button onClick={handleClearDraft}
            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap ml-3">
            {t('form.draftClear')}
          </button>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="bg-white rounded-lg shadow p-4 sm:p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-1">{t('form.title')}</h2>
        <p className="text-sm text-gray-500 mb-6">{t('form.subtitle')}</p>

        <ErrorAlert errors={errors} title={t('form.checkErrors')} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('field.payee')} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={payee} onChange={(e) => setPayee(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('field.date')} <span className="text-red-500">*</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('field.phone')} <span className="text-red-500">*</span>
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.session')}</label>
            <input type="text" readOnly value={session}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100" />
          </div>
          <div>
            <BankSelect value={bankName} onChange={setBankName} label={`${t('field.bank')} *`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('field.bankAccount')} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={bankAccount}
              onChange={(e) => setBankAccount(formatBankAccount(e.target.value, bankName))}
              placeholder={t('field.bankAccount')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <CommitteeSelect value={committee} onChange={setCommittee} />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              {t('field.items')} <span className="text-red-500">*</span>
            </h3>
            <button type="button" onClick={addItem} disabled={items.length >= 10}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400">
              {t('form.addItem')}
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <ItemRow key={i} index={i} item={item} onChange={updateItem} onRemove={removeItem}
                canRemove={items.length > 1} />
            ))}
          </div>
          <div className="flex justify-end mt-3 pt-3 border-t">
            <span className="text-sm font-medium">{t('field.totalAmount')}: ₩{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <FileUpload files={files} onFilesChange={setFiles} onScanComplete={handleScanComplete} />

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.comments')}</label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)}
            rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
            {submitting ? t('common.submitting') : t('form.submitRequest')}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title={t('form.confirmTitle')}
        items={[
          { label: t('field.payee'), value: payee },
          { label: t('field.date'), value: date },
          { label: t('field.bankAndAccount'), value: `${bankName} ${bankAccount}` },
          { label: t('field.committee'), value: t(`committee.${committee}`) },
        ]}
        totalAmount={validItems.reduce((sum, item) => sum + item.amount, 0)}
        confirmLabel={t('form.confirmSubmit')}
        requestItems={validItems}
        receiptFiles={files}
      />

      <ProcessingOverlay open={submitting} text={t('common.processingMessage')} />

      {/* 페이지 이동 확인 모달 */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-2">{t('form.blockerTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('form.blockerMessage')}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => blocker.reset?.()}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                {t('form.continueEditing')}
              </button>
              <button onClick={() => { clearDraft(); blocker.proceed?.() }}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
                {t('form.leavePage')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
