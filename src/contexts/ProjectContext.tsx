import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'
import { Project, GlobalSettings } from '../types'

const STORAGE_KEY = 'selectedProjectId'

interface ProjectContextType {
  currentProject: Project | null
  projects: Project[]
  loading: boolean
  setCurrentProject: (project: Project) => void
  refreshProjects: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    if (!appUser) {
      setProjects([])
      setCurrentProjectState(null)
      setLoading(false)
      return
    }

    try {
      let projectIds = appUser.projectIds || []

      // Fallback: if user has no projectIds, use default project
      if (projectIds.length === 0) {
        const globalSnap = await getDoc(doc(db, 'settings', 'global'))
        if (globalSnap.exists()) {
          const { defaultProjectId } = globalSnap.data() as GlobalSettings
          if (defaultProjectId) projectIds = [defaultProjectId]
        }
      }

      if (projectIds.length === 0) {
        setProjects([])
        setCurrentProjectState(null)
        setLoading(false)
        return
      }

      // Admin sees all active projects
      let allProjects: Project[] = []
      if (appUser.role === 'admin') {
        const q = query(collection(db, 'projects'), where('isActive', '==', true))
        const snap = await getDocs(q)
        allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))
      } else {
        // Fetch only assigned projects (Firestore 'in' supports up to 30)
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

      const activeProjects = allProjects.filter(p => p.isActive)
      setProjects(activeProjects)

      // Restore from localStorage or pick first
      const savedId = localStorage.getItem(STORAGE_KEY)
      const saved = activeProjects.find(p => p.id === savedId)
      setCurrentProjectState(saved || activeProjects[0] || null)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    } finally {
      setLoading(false)
    }
  }, [appUser])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const setCurrentProject = (project: Project) => {
    setCurrentProjectState(project)
    localStorage.setItem(STORAGE_KEY, project.id)
  }

  return (
    <ProjectContext.Provider value={{ currentProject, projects, loading, setCurrentProject, refreshProjects: fetchProjects }}>
      {children}
    </ProjectContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
