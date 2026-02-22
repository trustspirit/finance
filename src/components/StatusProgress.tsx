import { useTranslation } from 'react-i18next'
import type { RequestStatus } from '../types'

interface StatusProgressProps {
  status: RequestStatus
  hasReview?: boolean
}

export default function StatusProgress({ status, hasReview }: StatusProgressProps) {
  const { t } = useTranslation()

  const isRejected = status === 'rejected' || status === 'force_rejected'
  const isCancelled = status === 'cancelled'
  const isTerminal = isRejected || isCancelled

  // Map status to the step it reached (1-indexed: 1=submitted done, 2=reviewed done, etc.)
  const statusToStep: Record<string, number> = {
    pending: 1,
    reviewed: 2,
    approved: 3,
    settled: 4,
    rejected: hasReview ? 2 : 1,
    force_rejected: 3,
    cancelled: 0,
  }

  const activeStep = statusToStep[status] ?? 0

  const steps = [
    { label: t('statusStep.submitted'), key: 'submitted' },
    { label: t('statusStep.review'), key: 'review' },
    { label: t('statusStep.approval'), key: 'approval' },
    { label: t('statusStep.settlement'), key: 'settlement' },
  ]

  return (
    <div className="mb-6">
      <div className="flex items-start">
        {steps.map((step, i) => {
          const isCompleted = i < activeStep
          const isCurrent = i === activeStep && !isTerminal
          const isFailed = i === activeStep && isTerminal

          return (
            <div key={step.key} className={`flex items-start ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              {/* Step indicator + label */}
              <div className="flex flex-col items-center min-w-[3rem]">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  isFailed
                    ? 'border-red-500 bg-red-50 text-red-500'
                    : isCompleted
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : isCurrent
                    ? 'border-blue-600 bg-white text-blue-600'
                    : 'border-gray-300 bg-white text-gray-300'
                }`}>
                  {isFailed ? '✕' : isCompleted ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] mt-1 whitespace-nowrap ${
                  isFailed ? 'text-red-500 font-medium'
                  : isCompleted ? 'text-blue-600 font-medium'
                  : isCurrent ? 'text-blue-600 font-medium'
                  : 'text-gray-400'
                }`}>
                  {isFailed
                    ? (isCancelled ? t('statusStep.cancelled') : t('statusStep.rejected'))
                    : step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mt-3.5 mx-1 ${
                  i < activeStep - 1
                    ? 'bg-blue-600'
                    : i === activeStep - 1 && !isTerminal
                    ? 'bg-blue-600'
                    : i === activeStep - 1 && isTerminal
                    ? 'bg-red-300'
                    : 'bg-gray-200'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
