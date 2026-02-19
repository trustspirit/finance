import { useMutation } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'
import type { Receipt } from '../../types'

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
  driveFileId: string
  driveUrl: string
}

export function useUploadReceipts() {
  return useMutation({
    mutationFn: async (input: UploadReceiptsInput) => {
      const uploadFn = httpsCallable<UploadReceiptsInput, Receipt[]>(functions, 'uploadReceipts')
      const result = await uploadFn(input)
      return result.data
    },
  })
}

export function useUploadBankBook() {
  return useMutation({
    mutationFn: async (input: UploadBankBookInput) => {
      const uploadFn = httpsCallable<UploadBankBookInput, UploadBankBookResult>(functions, 'uploadBankBook')
      const result = await uploadFn(input)
      return result.data
    },
  })
}
