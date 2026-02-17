export type UserRole = 'user' | 'admin' | 'approver'

export interface AppUser {
  uid: string
  email: string
  name: string
  phone: string
  role: UserRole
}

export type RequestStatus = 'pending' | 'approved' | 'rejected'

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
  date: string
  session: string
  items: RequestItem[]
  totalAmount: number
  receipts: Receipt[]
  requestedBy: { uid: string; name: string; email: string }
  approvedBy: { uid: string; name: string; email: string } | null
  approvedAt: Date | null
  comments: string
}
