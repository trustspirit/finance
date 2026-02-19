import { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useProjects } from '../hooks/queries/useProjects'
import { Project } from '../types'

const STORAGE_KEY = 'selectedProjectId'

interface ProjectContextType {
  currentProject: Project | null
  projects: Project[]
  loading: boolean
  setCurrentProject: (project: Project) => void
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth()
  const { data: projects = [], isLoading } = useProjects(appUser)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  )

  const currentProject = useMemo(
    () => projects.find(p => p.id === selectedId) ?? projects[0] ?? null,
    [projects, selectedId]
  )

  const setCurrentProject = (project: Project) => {
    setSelectedId(project.id)
    localStorage.setItem(STORAGE_KEY, project.id)
  }

  return (
    <ProjectContext.Provider value={{ currentProject, projects, loading: isLoading, setCurrentProject }}>
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
