import { useTranslation } from 'react-i18next'
import Modal from './Modal'

interface SummaryItem {
  label: string
  value: string
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  items: SummaryItem[]
  totalAmount?: number
  totalLabel?: string
  confirmLabel?: string
  cancelLabel?: string
}

export default function ConfirmModal({
  open, onClose, onConfirm, title,
  items, totalAmount, totalLabel,
  confirmLabel, cancelLabel,
}: Props) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('form.confirmTitle')
  const resolvedTotalLabel = totalLabel ?? t('field.totalAmount')
  const resolvedConfirm = confirmLabel ?? t('form.confirmSubmit')
  const resolvedCancel = cancelLabel ?? t('common.cancel')

  return (
    <Modal open={open} onClose={onClose} title={resolvedTitle}>
      <div className="text-sm space-y-2 mb-4">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-gray-500">{item.label}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>

      {totalAmount !== undefined && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <div className="flex justify-between text-sm font-medium">
            <span>{resolvedTotalLabel}</span>
            <span>₩{totalAmount.toLocaleString()}</span>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            {t('form.totalAmountCheck', { amount: totalAmount.toLocaleString() })}
          </p>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
          {resolvedCancel}
        </button>
        <button onClick={onConfirm}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
          {resolvedConfirm}
        </button>
      </div>
    </Modal>
  )
}
