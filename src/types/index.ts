export type UserRole = 'user' | 'approver_ops' | 'approver_prep' | 'finance' | 'director' | 'admin'

export interface ProjectBudgetConfig {
  totalBudget: number
  byCode: Record<number, number>
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: Date
  createdBy: { uid: string; name: string; email: string }
  budgetConfig: ProjectBudgetConfig
  documentNo: string
  directorApprovalThreshold: number
  budgetWarningThreshold: number
  memberUids: string[]
  isActive: boolean
}

export interface GlobalSettings {
  defaultProjectId: string
}

export interface AppUser {
  uid: string
  email: string
  name: string
  displayName: string
  phone: string
  bankName: string
  bankAccount: string
  defaultCommittee: Committee
  signature: string
  bankBookImage: string
  bankBookPath: string
  bankBookUrl: string
  /** @deprecated legacy Drive field — kept for existing data compatibility */
  bankBookDriveId?: string
  /** @deprecated legacy Drive field — kept for existing data compatibility */
  bankBookDriveUrl?: string
  role: UserRole
  projectIds: string[]
}

export type Committee = 'operations' | 'preparation'

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'settled' | 'cancelled'

export interface RequestItem {
  description: string
  budgetCode: number
  amount: number
}

export interface Receipt {
  fileName: string
  storagePath: string
  url: string
  /** @deprecated legacy Drive field — kept for existing data compatibility */
  driveFileId?: string
  /** @deprecated legacy Drive field — kept for existing data compatibility */
  driveUrl?: string
}

export interface PaymentRequest {
  id: string
  projectId: string
  createdAt: Date
  status: RequestStatus
  payee: string
  phone: string
  bankName: string
  bankAccount: string
  date: string
  session: string
  committee: Committee
  items: RequestItem[]
  totalAmount: number
  receipts: Receipt[]
  requestedBy: { uid: string; name: string; email: string }
  approvedBy: { uid: string; name: string; email: string } | null
  approvalSignature: string | null
  approvedAt: Date | null
  rejectionReason: string | null
  settlementId: string | null
  originalRequestId: string | null
  comments: string
}

export interface Settlement {
  id: string
  projectId: string
  createdAt: Date
  createdBy: { uid: string; name: string; email: string }
  payee: string
  phone: string
  bankName: string
  bankAccount: string
  session: string
  committee: Committee
  items: RequestItem[]
  totalAmount: number
  receipts: Receipt[]
  requestIds: string[]
  requestedBySignature: string | null
  approvedBy: { uid: string; name: string; email: string } | null
  approvalSignature: string | null
}
