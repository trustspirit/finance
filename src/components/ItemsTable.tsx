import { useTranslation } from 'react-i18next'
import { RequestItem } from '../types'

interface Props {
  items: RequestItem[]
  totalAmount: number
}

export default function ItemsTable({ items, totalAmount }: Props) {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50">
          <tr>
            <th className="text-left px-3 py-2">#</th>
            <th className="text-left px-3 py-2">{t('field.comments')}</th>
            <th className="text-left px-3 py-2">Budget Code</th>
            <th className="text-right px-3 py-2">{t('field.totalAmount')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, i) => (
            <tr key={i}>
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{item.description}</td>
              <td className="px-3 py-2">
                {item.budgetCode}
                <span className="ml-1 text-gray-400 text-xs">{t(`budgetCode.${item.budgetCode}`)}</span>
              </td>
              <td className="px-3 py-2 text-right">₩{item.amount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t font-medium">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right">{t('field.totalAmount')}</td>
            <td className="px-3 py-2 text-right">₩{totalAmount.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
