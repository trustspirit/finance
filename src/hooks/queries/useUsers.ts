import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, getDoc, doc, updateDoc,
  query, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData, QueryConstraint,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { queryKeys } from './queryKeys'
import type { AppUser, UserRole } from '../../types'

const PAGE_SIZE = 20

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all(),
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'))
      return snap.docs.map(d => d.data() as AppUser)
    },
  })
}

export function useInfiniteUsers() {
  return useInfiniteQuery({
    queryKey: queryKeys.users.infinite(),
    queryFn: async ({ pageParam }) => {
      const constraints: QueryConstraint[] = [orderBy('email')]
      if (pageParam) constraints.push(startAfter(pageParam))
      constraints.push(limit(PAGE_SIZE))

      const q = query(collection(db, 'users'), ...constraints)
      const snap = await getDocs(q)
      const items = snap.docs.map(d => d.data() as AppUser)
      return { items, lastDoc: snap.docs[snap.docs.length - 1] ?? null }
    },
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    getNextPageParam: (lastPage) =>
      lastPage.items.length < PAGE_SIZE ? undefined : lastPage.lastDoc,
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
