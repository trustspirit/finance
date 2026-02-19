import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { queryKeys } from './queryKeys'
import type { PaymentRequest } from '../../types'

export function useRequests(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requests.all(projectId!),
    queryFn: async () => {
      const q = query(
        collection(db, 'requests'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRequest))
    },
    enabled: !!projectId,
  })
}

export function useMyRequests(projectId: string | undefined, uid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requests.byUser(projectId!, uid!),
    queryFn: async () => {
      const q = query(
        collection(db, 'requests'),
        where('projectId', '==', projectId),
        where('requestedBy.uid', '==', uid),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRequest))
    },
    enabled: !!projectId && !!uid,
  })
}

export function useApprovedRequests(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requests.approved(projectId!),
    queryFn: async () => {
      const q = query(
        collection(db, 'requests'),
        where('projectId', '==', projectId),
        where('status', '==', 'approved'),
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRequest))
    },
    enabled: !!projectId,
  })
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id!),
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'requests', id!))
      if (!snap.exists()) return null
      return { id: snap.id, ...snap.data() } as PaymentRequest
    },
    enabled: !!id,
  })
}

export function useCreateRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<PaymentRequest, 'id' | 'createdAt'> & { createdAt?: unknown }) => {
      const docData = { ...data, createdAt: serverTimestamp() }
      const ref = await addDoc(collection(db, 'requests'), docData)
      return ref.id
    },
    onSuccess: (id, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(id) })
    },
  })
}

export function useApproveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      requestId: string
      projectId: string
      approver: { uid: string; name: string; email: string }
      signature: string
    }) => {
      await updateDoc(doc(db, 'requests', params.requestId), {
        status: 'approved',
        approvedBy: params.approver,
        approvalSignature: params.signature,
        approvedAt: serverTimestamp(),
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(variables.requestId) })
    },
  })
}

export function useRejectRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      requestId: string
      projectId: string
      approver: { uid: string; name: string; email: string }
      rejectionReason: string
    }) => {
      await updateDoc(doc(db, 'requests', params.requestId), {
        status: 'rejected',
        approvedBy: params.approver,
        approvalSignature: null,
        approvedAt: serverTimestamp(),
        rejectionReason: params.rejectionReason,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(variables.requestId) })
    },
  })
}
