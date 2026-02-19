import { UserRole, Committee } from '../types'

/** Default amount threshold: requests above this require director/admin approval */
export const DEFAULT_APPROVAL_THRESHOLD = 600000

/** Can approve/reject requests (has any approval capability) */
export function canApprove(role: UserRole): boolean {
  return ['approver_ops', 'approver_prep', 'finance', 'director', 'admin'].includes(role)
}

/** Can approve a specific committee's requests (ignoring amount) */
export function canApproveCommittee(role: UserRole, committee: Committee): boolean {
  if (role === 'admin' || role === 'director' || role === 'finance') return true
  if (role === 'approver_ops' && committee === 'operations') return true
  if (role === 'approver_prep' && committee === 'preparation') return true
  return false
}

/** Can approve a specific request considering both committee and amount */
export function canApproveRequest(role: UserRole, committee: Committee, amount: number, threshold = DEFAULT_APPROVAL_THRESHOLD): boolean {
  if (!canApproveCommittee(role, committee)) return false
  if (threshold > 0 && amount > threshold) {
    return role === 'admin' || role === 'director'
  }
  return true
}

/** Can access dashboard and budget settings */
export function canAccessDashboard(role: UserRole): boolean {
  return role === 'admin' || role === 'finance' || role === 'director'
}

/** Can access receipts management */
export function canAccessReceipts(role: UserRole): boolean {
  return role === 'admin' || role === 'finance'
}

/** Can view user directory */
export function canManageUsers(role: UserRole): boolean {
  return role === 'admin' || role === 'finance'
}

/** Can access settlement */
export function canAccessSettlement(role: UserRole): boolean {
  return ['approver_ops', 'approver_prep', 'finance', 'director', 'admin'].includes(role)
}

/** Can access admin menu (any non-user role) */
export function isStaff(role: UserRole): boolean {
  return role !== 'user'
}

/** All roles for dropdown */
export const ALL_ROLES: UserRole[] = ['user', 'approver_ops', 'approver_prep', 'finance', 'director', 'admin']
