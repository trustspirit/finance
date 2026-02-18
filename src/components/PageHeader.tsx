import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  description?: string
  backTo?: string
  backLabel?: string
  action?: {
    label: string
    to?: string
    onClick?: () => void
    variant?: 'primary' | 'purple'
    disabled?: boolean
  }
}

export default function PageHeader({ title, description, backTo, backLabel, action }: Props) {
  const { t } = useTranslation()
  const btnClass = action?.variant === 'purple'
    ? 'bg-purple-600 hover:bg-purple-700'
    : 'bg-blue-600 hover:bg-blue-700'

  return (
    <div className="mb-6">
      {backTo && (
        <Link to={backTo} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
          ← {backLabel || t('common.back')}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        {action && (
          action.to ? (
            <Link to={action.to}
              className={`${btnClass} text-white px-4 py-2 rounded text-sm font-medium text-center whitespace-nowrap`}>
              {action.label}
            </Link>
          ) : (
            <button onClick={action.onClick} disabled={action.disabled}
              className={`${btnClass} text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap disabled:bg-gray-400`}>
              {action.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
