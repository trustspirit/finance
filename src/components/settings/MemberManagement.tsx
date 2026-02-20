import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../../contexts/ProjectContext'
import { useInfiniteUsers } from '../../hooks/queries/useUsers'
import { useUpdateProjectMembers } from '../../hooks/queries/useProjects'
import InfiniteScrollSentinel from '../InfiniteScrollSentinel'

export default function MemberManagement() {
  const { t } = useTranslation()
  const { projects } = useProject()
  const {
    data: usersData,
    isLoading: usersLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteUsers()
  const users = usersData?.pages.flatMap(p => p.items) ?? []
  const updateMembersMutation = useUpdateProjectMembers()

  const activeProjects = projects.filter(p => p.isActive)
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjects[0]?.id || '')
  const selectedProject = activeProjects.find(p => p.id === selectedProjectId)
  const membersContainerRef = useRef<HTMLDivElement>(null)

  const memberUids = new Set(selectedProject?.memberUids || [])

  const handleToggle = async (uid: string, add: boolean) => {
    if (!selectedProject) return
    try {
      await updateMembersMutation.mutateAsync({
        projectId: selectedProject.id,
        addUids: add ? [uid] : [],
        removeUids: add ? [] : [uid],
        currentMemberUids: selectedProject.memberUids || [],
      })
    } catch (err) { console.error('Failed to toggle member:', err) }
  }

  if (usersLoading) return <p className="text-sm text-gray-500">{t('common.loading')}</p>

  return (
    <div className="space-y-4">
      {activeProjects.length > 1 && (
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          {activeProjects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {selectedProject && (
        <>
          <p className="text-xs text-gray-500">
            {t('project.memberCount', { count: memberUids.size })}
          </p>
          <div ref={membersContainerRef} className="max-h-80 overflow-y-auto space-y-1">
            {users.map(u => (
              <label key={u.uid} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded">
                <input
                  type="checkbox"
                  checked={memberUids.has(u.uid)}
                  onChange={(e) => handleToggle(u.uid, e.target.checked)}
                />
                <span className="font-medium">{u.displayName || u.name}</span>
                <span className="text-xs text-gray-400">{u.email}</span>
              </label>
            ))}
            <InfiniteScrollSentinel
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              rootRef={membersContainerRef}
            />
          </div>
        </>
      )}
    </div>
  )
}
