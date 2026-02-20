import { Link } from 'react-router-dom'
import { DocumentIcon } from './Icons'

interface Props {
  title: string
  description?: string
  actionLabel?: string
  actionTo?: string
}

export default function EmptyState({ title, description, actionLabel, actionTo }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <DocumentIcon className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-gray-700 font-medium mb-1">{title}</p>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
