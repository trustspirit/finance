import { useTranslation } from 'react-i18next'
import { RequestItem } from '../types'
import { BUDGET_CODES } from '../constants/budgetCodes'

interface Props {
  index: number
  item: RequestItem
  onChange: (index: number, item: RequestItem) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

export default function ItemRow({ index, item, onChange, onRemove, canRemove }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-start">
      <span className="text-sm text-gray-400 pt-2 w-6">{index + 1}</span>
      <input
        type="text"
        placeholder={t('field.items')}
        value={item.description}
        onChange={(e) => onChange(index, { ...item, description: e.target.value })}
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
      />
      <select
        value={item.budgetCode || ''}
        onChange={(e) => {
          const code = parseInt(e.target.value)
          onChange(index, { ...item, budgetCode: isNaN(code) ? 0 : code })
        }}
        className="w-64 border border-gray-300 rounded pl-3 pr-8 py-2 text-sm"
      >
        <option value="">{t('budgetCode.select')}</option>
        {BUDGET_CODES.map((bc, i) => (
          <option key={i} value={bc.code}>
            {bc.code} - {t(`budgetCode.items.${bc.descKey}`)}
          </option>
        ))}
      </select>
      <input
        type="number"
        placeholder={t('field.totalAmount')}
        value={item.amount || ''}
        onChange={(e) => onChange(index, { ...item, amount: parseInt(e.target.value) || 0 })}
        className="w-32 border border-gray-300 rounded px-3 py-2 text-sm text-right"
      />
      {canRemove && (
        <button type="button" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 pt-2">
          ✕
        </button>
      )}
    </div>
  )
}
