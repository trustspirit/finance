import { useProject } from '../contexts/ProjectContext'
import { useRequests } from './queries/useRequests'

export interface BudgetUsage {
  percent: number
  warningThreshold: number
  exceeded: boolean
  warning: boolean
}

export function useBudgetUsage(): BudgetUsage | null {
  const { currentProject } = useProject()
  const { data: requests = [] } = useRequests(currentProject?.id)

  const totalBudget = currentProject?.budgetConfig?.totalBudget || 0
  if (totalBudget <= 0) return null

  const usedAmount = requests
    .filter(r => r.status === 'reviewed' || r.status === 'approved' || r.status === 'settled')
    .reduce((sum, r) => sum + r.totalAmount, 0)
  const percent = Math.round((usedAmount / totalBudget) * 100)
  const warningThreshold = currentProject?.budgetWarningThreshold ?? 85

  return { percent, warningThreshold, exceeded: percent >= 100, warning: percent >= warningThreshold }
}
