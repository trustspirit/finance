import { RequestStatus } from '../types'

const statusConfig: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: '대기중', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '승인', className: 'bg-green-100 text-green-800' },
  rejected: { label: '반려', className: 'bg-red-100 text-red-800' },
  settled: { label: '정산완료', className: 'bg-purple-100 text-purple-800' },
}

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const config = statusConfig[status]
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
