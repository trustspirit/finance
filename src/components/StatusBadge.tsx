import { useTranslation } from 'react-i18next'
import { RequestStatus } from '../types'

const statusStyles: Record<RequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  settled: 'bg-purple-100 text-purple-800',
}

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status]}`}>
      {t(`status.${status}`)}
    </span>
  )
}
