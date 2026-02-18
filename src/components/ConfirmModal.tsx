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
  open, onClose, onConfirm, title = '제출 확인',
  items, totalAmount, totalLabel = '항목 총액',
  confirmLabel = '확인 및 제출', cancelLabel = '취소',
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
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
            <span>{totalLabel}</span>
            <span>₩{totalAmount.toLocaleString()}</span>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            영수증 금액과 {totalLabel}(₩{totalAmount.toLocaleString()})이 일치하는지 확인해주세요.
          </p>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
          {cancelLabel}
        </button>
        <button onClick={onConfirm}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
