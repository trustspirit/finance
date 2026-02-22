import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../hooks/queries/queryKeys'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useRequest, useCreateRequest } from '../hooks/queries/useRequests'
import { useUploadReceipts } from '../hooks/queries/useCloudFunctions'
import { RequestItem, Receipt, Committee } from '../types'
import Layout from '../components/Layout'
import ProcessingOverlay from '../components/ProcessingOverlay'
import ItemRow from '../components/ItemRow'
import FileUpload from '../components/FileUpload'
import CommitteeSelect from '../components/CommitteeSelect'
import ConfirmModal from '../components/ConfirmModal'
import { formatPhone, formatBankAccount, fileToBase64 } from '../lib/utils'
import BankSelect from '../components/BankSelect'
import ErrorAlert from '../components/ErrorAlert'
import Spinner from '../components/Spinner'
import { useTranslation } from 'react-i18next'

const emptyItem = (): RequestItem => ({ description: '', budgetCode: 0, amount: 0 })

export default function ResubmitPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { user, appUser, updateAppUser } = useAuth()
  const { currentProject } = useProject()
  const navigate = useNavigate()

  const { data: original, isLoading: loading } = useRequest(id)
  const queryClient = useQueryClient()
  const createRequest = useCreateRequest()
  const uploadReceiptsMutation = useUploadReceipts()

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
    if (!original) return
    setPayee(original.payee)
    setPhone(original.phone)
    setBankName(original.bankName)
    setBankAccount(original.bankAccount)
    setDate(original.date)
    setCommittee(original.committee)
    setItems(original.items.length > 0 ? original.items : [emptyItem()])
    setComments(original.comments)
  }, [original])

  // Re-format account number when bank changes
  const bankNameMounted = useRef(false)
  useEffect(() => {
    if (!bankNameMounted.current) { bankNameMounted.current = true; return }
    if (bankName && bankAccount) setBankAccount(formatBankAccount(bankAccount, bankName))
  }, [bankName]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!payee.trim()) errs.push(t('validation.payeeRequired'))
    if (!phone.trim()) errs.push(t('validation.phoneRequired'))
    if (!bankName.trim()) errs.push(t('validation.bankRequired'))
    if (!bankAccount.trim()) errs.push(t('validation.bankAccountRequired'))
    if (!date) errs.push(t('validation.dateRequired'))
    if (validItems.length === 0) errs.push(t('validation.itemsRequired'))
    const missingBudgetCode = validItems.some((item) => !item.budgetCode)
    if (missingBudgetCode) errs.push(t('validation.budgetCodeRequired'))
    // receipts: use new files or keep original
    if (files.length === 0 && (!original?.receipts || original.receipts.length === 0)) {
      errs.push(t('validation.receiptsRequired'))
    }
    if (!appUser?.signature) errs.push(t('validation.signatureRequired'))
    if (!appUser?.bankBookUrl && !appUser?.bankBookDriveUrl) errs.push(t('validation.bankBookRequired'))
    if (!hasChanges()) errs.push(t('validation.noChanges'))
    return errs
  }

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validate()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors([])
    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    if (!user || !appUser || !original || !currentProject) return
    setShowConfirm(false)
    setSubmitting(true)

    try {
      let receipts: Receipt[] = []
      if (files.length > 0) {
        const fileData = await Promise.all(
          files.map(async (f) => ({ name: f.name, data: await fileToBase64(f) }))
        )
        receipts = await uploadReceiptsMutation.mutateAsync({ files: fileData, committee, projectId: currentProject.id })
      } else {
        receipts = original.receipts
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
        projectId: currentProject.id,
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
        originalRequestId: original.id,
        comments,
      })

      navigate('/my-requests')
    } catch (err) {
      console.error(err)
      alert(t('form.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Layout><Spinner /></Layout>
  if (!original) return <Layout><p className="text-gray-500">{t('detail.notFound')}</p></Layout>
  if (original.status !== 'rejected' && original.status !== 'cancelled' && original.status !== 'force_rejected') return <Layout><p className="text-gray-500">{t('approval.rejectedOnly')}</p></Layout>
  if (original.requestedBy.uid !== user?.uid) return <Layout><p className="text-gray-500">{t('detail.notFound')}</p></Layout>

  return (
    <Layout>
      {/* 반려 사유 표시 */}
      {original.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 max-w-4xl mx-auto">
          <h3 className="text-sm font-medium text-red-800 mb-1">{t('approval.rejectionReason')}</h3>
          <p className="text-sm text-red-700">{original.rejectionReason}</p>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-1">{t('approval.resubmitTitle')}</h2>
        <p className="text-sm text-gray-500 mb-6">{t('approval.resubmitDescription')}</p>

        <ErrorAlert errors={errors} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.payee')} <span className="text-red-500">*</span></label>
            <input type="text" value={payee} onChange={(e) => setPayee(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.date')} <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.phone')} <span className="text-red-500">*</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.bankAccount')} <span className="text-red-500">*</span></label>
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
            <h3 className="text-sm font-medium text-gray-700">{t('field.items')} <span className="text-red-500">*</span></h3>
            <button type="button" onClick={addItem} disabled={items.length >= 10}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400">{t('form.addItem')}</button>
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

        <FileUpload
          files={files}
          onFilesChange={setFiles}

          existingCount={original.receipts.length}
          existingLabel={`${t('field.receipts')} ${original.receipts.length} - existing kept. Upload new to replace.`}
        />

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.comments')}</label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)}
            rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex items-center justify-between">
          <Link to={`/request/${original.id}`} className="text-sm text-gray-500 hover:underline">{t('approval.originalRequest')}</Link>
          <button type="submit" disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
            {submitting ? t('common.submitting') : t('approval.resubmit')}
          </button>
        </div>
      </form>

      <ProcessingOverlay open={submitting} text={t('common.processingMessage')} />

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title={t('approval.resubmitTitle')}
        items={[
          { label: t('field.payee'), value: payee },
        ]}
        totalAmount={validItems.reduce((sum, item) => sum + item.amount, 0)}
        confirmLabel={t('approval.resubmitConfirm')}
        requestItems={validItems}
        receiptFiles={files.length > 0 ? files : undefined}
      />
    </Layout>
  )
}
