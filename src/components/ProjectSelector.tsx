import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin as checkIsAdmin } from '../lib/roles'
import { useTranslation } from 'react-i18next'
import { FolderIcon, ChevronDownIcon, CloseIcon, RestoreIcon } from './Icons'
import ProjectCreateForm from './settings/ProjectCreateForm'
import { useDeletedProjects, useRestoreProject } from '../hooks/queries/useProjects'
import { queryKeys } from '../hooks/queries/queryKeys'
import type { Project } from '../types'

function getRemainingDays(deletedAt: unknown): number {
  if (!deletedAt) return 0
  const ts = deletedAt as { seconds?: number; toDate?: () => Date }
  const deletedDate = ts.toDate ? ts.toDate() : new Date((ts.seconds || 0) * 1000)
  const elapsed = Date.now() - deletedDate.getTime()
  return Math.max(0, 30 - Math.floor(elapsed / (1000 * 60 * 60 * 24)))
}

export default function ProjectSelector() {
  const { t } = useTranslation()
  const { currentProject, projects, setCurrentProject } = useProject()
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const role = appUser?.role || 'user'
  const isAdmin = checkIsAdmin(role)
  const [open, setOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const { data: deletedProjects = [] } = useDeletedProjects({ enabled: isAdmin })
  const restoreProject = useRestoreProject()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close modal on Escape key
  useEffect(() => {
    if (!showCreateModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCreateModal(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showCreateModal])

  const handleCreated = useCallback(async (newId: string) => {
    // Wait for projects to refetch so the new project is in the cache
    await queryClient.refetchQueries({ queryKey: queryKeys.projects.root() })
    setCurrentProject({ id: newId } as Project)
    setShowCreateModal(false)
  }, [queryClient, setCurrentProject])

  const handleRestore = useCallback(async (projectId: string) => {
    try {
      await restoreProject.mutateAsync(projectId)
      // Wait for projects to refetch so the restored project is in the cache
      await queryClient.refetchQueries({ queryKey: queryKeys.projects.root() })
      setCurrentProject({ id: projectId } as Project)
      setOpen(false)
    } catch {
      alert(t('project.restoreFailed'))
    }
  }, [restoreProject, queryClient, setCurrentProject, t])

  // Hide if only 1 project and not admin
  if (projects.length <= 1 && !isAdmin) return null

  const showDeletedSection = isAdmin && deletedProjects.length > 0

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors max-w-[200px]"
        >
          <FolderIcon className="w-4 h-4 shrink-0" />
          <span className="truncate">{currentProject?.name || t('project.select')}</span>
          <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setCurrentProject(p)
                  setOpen(false)
                  const path = location.pathname
                  if (path.match(/^\/(request|admin\/settlement)\/[^/]+$/)) {
                    if (path.startsWith('/admin/settlement/')) {
                      navigate('/admin/settlements')
                    } else {
                      navigate('/my-requests')
                    }
                  }
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  currentProject?.id === p.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {p.name}
              </button>
            ))}
            {isAdmin && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => {
                    setOpen(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  + {t('project.create')}
                </button>
              </>
            )}
            {showDeletedSection && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <p className="px-4 py-1 text-xs text-gray-400">{t('project.recentlyDeleted')}</p>
                {deletedProjects.map((p) => (
                  <div key={p.id} className="px-4 py-1.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-400 line-through truncate">{p.name}</p>
                      <p className="text-xs text-gray-300">{t('project.autoDeleteDays', { days: getRemainingDays(p.deletedAt) })}</p>
                    </div>
                    <button
                      onClick={() => handleRestore(p.id)}
                      disabled={restoreProject.isPending}
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 transition-colors ml-2"
                    >
                      <RestoreIcon className="w-3.5 h-3.5" />
                      {t('project.restore')}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('project.create')}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{t('project.create')}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <ProjectCreateForm
              onCreated={handleCreated}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
