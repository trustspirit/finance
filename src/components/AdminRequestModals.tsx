import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import SignaturePad from './SignaturePad'
import BudgetWarningBanner from './BudgetWarningBanner'

interface ApprovalModalProps {
  open: boolean
  onClose: () => void
  request: { payee: string; bankName: string; bankAccount: string } | null
  bankBookUrl: string | undefined
  budgetUsage: React.ComponentProps<typeof BudgetWarningBanner>['budgetUsage']
  savedSignature: string | undefined
  onConfirm: (signature: string) => void
  isPending: boolean
}

export function ApprovalModal({
  open, onClose, request, bankBookUrl, budgetUsage,
  savedSignature, onConfirm, isPending,
}: ApprovalModalProps) {
  const { t } = useTranslation()
  const [signatureData, setSignatureData] = useState(savedSignature || '')

  return (
    <Modal
      open={open}
      onClose={() => { if (!isPending) onClose() }}
      title={t('approval.signTitle')}
    >
      {request && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs font-medium text-gray-500 mb-1">
            {t('field.payee')}: {request.payee}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            {t('field.bankAndAccount')}: {request.bankName} {request.bankAccount}
          </p>
          {bankBookUrl ? (
            <a href={bankBookUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={bankBookUrl}
                alt={t('field.bankBook')}
                className="max-h-32 rounded border border-gray-200 object-contain bg-white"
              />
            </a>
          ) : (
            <p className="text-xs text-gray-400">{t('settings.bankBookRequiredHint')}</p>
          )}
        </div>
      )}

      <BudgetWarningBanner budgetUsage={budgetUsage} className="mb-4" />

      <p className="text-sm text-gray-500 mb-4">{t('approval.signDescription')}</p>

      {savedSignature && (
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={signatureData === savedSignature}
              onChange={(e) => setSignatureData(e.target.checked ? savedSignature : '')}
            />
            <span className="text-sm text-gray-600">{t('approval.useSavedSignature')}</span>
          </label>
          {signatureData === savedSignature && (
            <div className="mt-2 border border-gray-200 rounded p-2 bg-gray-50">
              <img src={savedSignature} alt="Saved signature" className="max-h-24 mx-auto" />
            </div>
          )}
        </div>
      )}

      {signatureData !== savedSignature && (
        <SignaturePad
          initialData={signatureData !== savedSignature ? signatureData : ''}
          onChange={setSignatureData}
        />
      )}

      <div className="flex gap-3 justify-end mt-4">
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => onConfirm(signatureData)}
          disabled={!signatureData || isPending}
          className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {isPending ? t('common.submitting') : t('approval.signAndApprove')}
        </button>
      </div>
    </Modal>
  )
}

interface RejectionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
}

export function RejectionModal({ open, onClose, onConfirm, isPending }: RejectionModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')

  return (
    <Modal
      open={open}
      onClose={() => { if (!isPending) onClose() }}
      title={t('approval.rejectTitle')}
    >
      <p className="text-sm text-gray-500 mb-4">{t('approval.rejectDescription')}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder={t('approval.rejectPlaceholder')}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4"
        autoFocus
      />
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => onConfirm(reason)}
          disabled={!reason.trim() || isPending}
          className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          {isPending ? t('common.submitting') : t('approval.reject')}
        </button>
      </div>
    </Modal>
  )
}

interface ForceRejectionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
}

export function ForceRejectionModal({ open, onClose, onConfirm, isPending }: ForceRejectionModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')

  return (
    <Modal
      open={open}
      onClose={() => { if (!isPending) onClose() }}
      title={t('approval.forceRejectTitle')}
    >
      <p className="text-sm text-gray-500 mb-4">{t('approval.forceRejectDescription')}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder={t('approval.forceRejectPlaceholder')}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4"
        autoFocus
      />
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => onConfirm(reason)}
          disabled={!reason.trim() || isPending}
          className="px-4 py-2 text-sm text-white bg-orange-600 rounded hover:bg-orange-700 disabled:bg-gray-400"
        >
          {isPending ? t('common.submitting') : t('approval.forceReject')}
        </button>
      </div>
    </Modal>
  )
}
