import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, getDoc, doc,
  query, where, orderBy, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { queryKeys } from './queryKeys'
import type { Settlement } from '../../types'

export function useSettlements(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.settlements.all(projectId!),
    queryFn: async () => {
      const q = query(
        collection(db, 'settlements'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Settlement))
    },
    enabled: !!projectId,
  })
}

export function useSettlement(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.settlements.detail(id!),
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'settlements', id!))
      if (!snap.exists()) return null
      return { id: snap.id, ...snap.data() } as Settlement
    },
    enabled: !!id,
  })
}

export function useCreateSettlement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      projectId: string
      settlements: Array<Omit<Settlement, 'id' | 'createdAt'>>
    }) => {
      const batch = writeBatch(db)

      for (const settlement of params.settlements) {
        const settlementRef = doc(collection(db, 'settlements'))
        batch.set(settlementRef, { ...settlement, createdAt: serverTimestamp() })

        for (const requestId of settlement.requestIds) {
          batch.update(doc(db, 'requests', requestId), {
            status: 'settled',
            settlementId: settlementRef.id,
          })
        }
      }

      await batch.commit()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.all(variables.projectId) })
    },
  })
}
