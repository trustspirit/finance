export type UserRole = 'user' | 'admin' | 'approver'

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
  bankBookDriveId: string
  bankBookDriveUrl: string
  role: UserRole
}

export type Committee = 'operations' | 'preparation'

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'settled'

export interface RequestItem {
  description: string
  budgetCode: number
  amount: number
}

export interface Receipt {
  fileName: string
  driveFileId: string
  driveUrl: string
}

export interface PaymentRequest {
  id: string
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
  settlementId: string | null
  comments: string
}

export interface Settlement {
  id: string
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
  approvalSignature: string | null
}
