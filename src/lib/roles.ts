import { UserRole, Committee } from '../types'

/** Default amount threshold: requests above this require director/admin approval */
export const DEFAULT_APPROVAL_THRESHOLD = 600000

/** Can review requests (finance_ops for operations, finance_prep for all) */
export function canReview(role: UserRole): boolean {
  return ['finance_ops', 'finance_prep', 'admin'].includes(role)
}

/** Can review a specific committee's requests */
export function canReviewCommittee(role: UserRole, committee: Committee): boolean {
  if (role === 'admin' || role === 'finance_prep') return true
  if (role === 'finance_ops' && committee === 'operations') return true
  return false
}

/** Can final-approve requests (reviewed->approved) */
export function canFinalApprove(role: UserRole): boolean {
  return ['approver_ops', 'approver_prep', 'session_director', 'logistic_admin', 'executive', 'admin'].includes(role)
}

/** Can final-approve a specific committee's requests (ignoring amount) */
export function canFinalApproveCommittee(role: UserRole, committee: Committee): boolean {
  if (role === 'admin' || role === 'executive') return true
  if (role === 'session_director' && committee === 'operations') return true
  if (role === 'logistic_admin' && committee === 'preparation') return true
  if (role === 'approver_ops' && committee === 'operations') return true
  if (role === 'approver_prep' && committee === 'preparation') return true
  return false
}

/** Can final-approve a specific request considering both committee and amount */
export function canFinalApproveRequest(role: UserRole, committee: Committee, amount: number, threshold = DEFAULT_APPROVAL_THRESHOLD): boolean {
  if (!canFinalApproveCommittee(role, committee)) return false
  if (threshold > 0 && amount > threshold) {
    return role === 'admin' || role === 'executive' || role === 'session_director' || role === 'logistic_admin'
  }
  return true
}

/** Can force-reject approved requests (finance_prep, admin only) */
export function canForceReject(role: UserRole): boolean {
  return role === 'finance_prep' || role === 'admin'
}

/** Can see a committee's requests in admin views (reviewer or final approver) */
export function canSeeCommitteeRequests(role: UserRole, committee: Committee): boolean {
  return canReviewCommittee(role, committee) || canFinalApproveCommittee(role, committee)
}

/** Can access dashboard and budget settings */
export function canAccessDashboard(role: UserRole): boolean {
  return role === 'admin' || role === 'finance_prep' || role === 'executive' || role === 'session_director' || role === 'logistic_admin'
}

/** Can access receipts management */
export function canAccessReceipts(role: UserRole): boolean {
  return role === 'admin' || role === 'finance_prep'
}

/** Can view user directory */
export function canManageUsers(role: UserRole): boolean {
  return role === 'admin' || role === 'finance_prep'
}

/** Can process settlements (create, settle) */
export function canAccessSettlement(role: UserRole): boolean {
  return role === 'admin' || role === 'finance_prep'
}

/** Can view settlement list and reports (read-only) */
export function canAccessSettlementRead(role: UserRole): boolean {
  return ['admin', 'finance_prep', 'executive', 'session_director', 'logistic_admin', 'approver_ops', 'approver_prep'].includes(role)
}

/** Can access admin menu (any non-user role) */
export function isStaff(role: UserRole): boolean {
  return role !== 'user'
}

/** All roles for dropdown */
export const ALL_ROLES: UserRole[] = ['user', 'finance_ops', 'approver_ops', 'finance_prep', 'approver_prep', 'session_director', 'logistic_admin', 'executive', 'admin']
