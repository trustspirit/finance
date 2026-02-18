import { UserRole, Committee } from '../types'

/** Can approve/reject requests */
export function canApprove(role: UserRole): boolean {
  return ['approver_ops', 'approver_prep', 'finance', 'admin'].includes(role)
}

/** Can approve a specific committee's requests */
export function canApproveCommittee(role: UserRole, committee: Committee): boolean {
  if (role === 'admin' || role === 'finance') return true
  if (role === 'approver_ops' && committee === 'operations') return true
  if (role === 'approver_prep' && committee === 'preparation') return true
  return false
}

/** Can access dashboard and budget settings */
export function canAccessDashboard(role: UserRole): boolean {
  return role === 'admin' || role === 'finance'
}

/** Can manage users */
export function canManageUsers(role: UserRole): boolean {
  return role === 'admin'
}

/** Can access settlement */
export function canAccessSettlement(role: UserRole): boolean {
  return ['approver_ops', 'approver_prep', 'finance', 'admin'].includes(role)
}

/** Can access admin menu (any non-user role) */
export function isStaff(role: UserRole): boolean {
  return role !== 'user'
}

/** All roles for dropdown */
export const ALL_ROLES: UserRole[] = ['user', 'approver_ops', 'approver_prep', 'finance', 'admin']
