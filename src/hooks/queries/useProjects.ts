import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, getDoc, setDoc, query, where, writeBatch, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { queryKeys } from './queryKeys'
import type { AppUser, Project, GlobalSettings } from '../../types'

async function fetchProjects(appUser: AppUser): Promise<Project[]> {
  let projectIds = appUser.projectIds || []

  if (projectIds.length === 0) {
    const globalSnap = await getDoc(doc(db, 'settings', 'global'))
    if (globalSnap.exists()) {
      const { defaultProjectId } = globalSnap.data() as GlobalSettings
      if (defaultProjectId) projectIds = [defaultProjectId]
    }
  }

  if (projectIds.length === 0) return []

  let allProjects: Project[] = []
  if (appUser.role === 'admin') {
    const q = query(collection(db, 'projects'), where('isActive', '==', true))
    const snap = await getDocs(q)
    allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))
  } else {
    const chunks: string[][] = []
    for (let i = 0; i < projectIds.length; i += 30) {
      chunks.push(projectIds.slice(i, i + 30))
    }
    for (const chunk of chunks) {
      const q = query(collection(db, 'projects'), where('__name__', 'in', chunk))
      const snap = await getDocs(q)
      snap.docs.forEach(d => allProjects.push({ id: d.id, ...d.data() } as Project))
    }
  }

  return allProjects.filter(p => p.isActive)
}

export function useProjects(appUser: AppUser | null) {
  return useQuery({
    queryKey: appUser ? queryKeys.projects.all(appUser.uid) : ['projects', 'none'],
    queryFn: () => fetchProjects(appUser!),
    enabled: !!appUser,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      project: Omit<Project, 'id'>
      projectId: string
    }) => {
      await setDoc(doc(db, 'projects', params.projectId), params.project)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root() })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      projectId: string
      data: Partial<Project>
    }) => {
      await setDoc(doc(db, 'projects', params.projectId), params.data, { merge: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root() })
    },
  })
}

export function useDeletedProjects() {
  return useQuery({
    queryKey: queryKeys.projects.deleted(),
    queryFn: async () => {
      const q = query(collection(db, 'projects'), where('isActive', '==', false))
      const snap = await getDocs(q)
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Project))
        .filter(p => p.deletedAt)
    },
  })
}

export function useSoftDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectId: string) => {
      await setDoc(doc(db, 'projects', projectId), {
        isActive: false,
        deletedAt: serverTimestamp(),
      }, { merge: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root() })
    },
  })
}

export function useRestoreProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectId: string) => {
      await setDoc(doc(db, 'projects', projectId), {
        isActive: true,
        deletedAt: deleteField(),
      }, { merge: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root() })
    },
  })
}

export function useUpdateProjectMembers() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      projectId: string
      addUids: string[]
      removeUids: string[]
      currentMemberUids: string[]
    }) => {
      const batch = writeBatch(db)
      const newMemberUids = [
        ...params.currentMemberUids.filter(uid => !params.removeUids.includes(uid)),
        ...params.addUids,
      ]
      batch.update(doc(db, 'projects', params.projectId), { memberUids: newMemberUids })

      const allUids = [...params.addUids, ...params.removeUids]
      const userSnaps = await Promise.all(
        allUids.map(uid => getDoc(doc(db, 'users', uid)))
      )

      params.addUids.forEach((uid, i) => {
        const userSnap = userSnaps[i]
        if (userSnap.exists()) {
          const projectIds = userSnap.data().projectIds || []
          if (!projectIds.includes(params.projectId)) {
            batch.update(doc(db, 'users', uid), { projectIds: [...projectIds, params.projectId] })
          }
        }
      })

      params.removeUids.forEach((uid, i) => {
        const userSnap = userSnaps[params.addUids.length + i]
        if (userSnap.exists()) {
          const projectIds = (userSnap.data().projectIds || []).filter((id: string) => id !== params.projectId)
          batch.update(doc(db, 'users', uid), { projectIds })
        }
      })

      await batch.commit()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root() })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
    },
  })
}
