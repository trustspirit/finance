import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { queryKeys } from './queryKeys'
import type { AppUser, UserRole } from '../../types'

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all(),
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'))
      return snap.docs.map(d => d.data() as AppUser)
    },
  })
}

export function useUser(uid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(uid!),
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', uid!))
      if (!snap.exists()) return null
      return snap.data() as AppUser
    },
    enabled: !!uid,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { uid: string; role: UserRole }) => {
      await updateDoc(doc(db, 'users', params.uid), { role: params.role })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
    },
  })
}
