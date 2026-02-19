import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { queryKeys } from './queryKeys'
import type { GlobalSettings } from '../../types'

export function useGlobalSettings() {
  return useQuery({
    queryKey: queryKeys.settings.global(),
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'settings', 'global'))
      if (!snap.exists()) return null
      return snap.data() as GlobalSettings
    },
  })
}

export function useUpdateGlobalSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<GlobalSettings>) => {
      await setDoc(doc(db, 'settings', 'global'), data, { merge: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.global() })
    },
  })
}
