import { useMutation } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'
import type { Receipt } from '../../types'

interface ScanReceiptInput {
  files: Array<{ name: string; data: string }>
}

interface ScanReceiptResult {
  items: Array<{
    description: string
    amount: number
    suggestedBudgetCode: number
  }>
  totalAmount: number
  rawText: string
  errors?: string[]
}

interface UploadReceiptsInput {
  files: Array<{ name: string; data: string }>
  committee: string
  projectId: string
}

interface UploadBankBookInput {
  file: { name: string; data: string }
}

interface UploadBankBookResult {
  fileName: string
  storagePath: string
  url: string
}

export function useUploadReceipts() {
  return useMutation({
    mutationFn: async (input: UploadReceiptsInput) => {
      const uploadFn = httpsCallable<UploadReceiptsInput, Receipt[]>(functions, 'uploadReceiptsV2')
      const result = await uploadFn(input)
      return result.data
    },
  })
}

export function useUploadBankBook() {
  return useMutation({
    mutationFn: async (input: UploadBankBookInput) => {
      const uploadFn = httpsCallable<UploadBankBookInput, UploadBankBookResult>(functions, 'uploadBankBookV2')
      const result = await uploadFn(input)
      return result.data
    },
  })
}

export function useScanReceipts() {
  return useMutation({
    mutationFn: async (input: ScanReceiptInput) => {
      const scanFn = httpsCallable<ScanReceiptInput, ScanReceiptResult>(functions, 'scanReceiptV2')
      const result = await scanFn(input)
      return result.data
    },
  })
}

export type { ScanReceiptResult }
