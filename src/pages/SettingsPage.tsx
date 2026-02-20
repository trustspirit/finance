import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import Layout from '../components/Layout'
import { CheckIcon, StarIcon, TrashIcon, RestoreIcon } from '../components/Icons'
import Select from '../components/Select'
import PersonalSettings from '../components/settings/PersonalSettings'
import ProjectGeneralSettings from '../components/settings/ProjectGeneralSettings'
import MemberManagement from '../components/settings/MemberManagement'
import ProjectCreateForm from '../components/settings/ProjectCreateForm'
import { useGlobalSettings, useUpdateGlobalSettings } from '../hooks/queries/useSettings'
import { useSoftDeleteProject, useDeletedProjects, useRestoreProject } from '../hooks/queries/useProjects'

function getRemainingDays(deletedAt: unknown): number {
  if (!deletedAt) return 0
  const ts = deletedAt as { seconds?: number; toDate?: () => Date }
  const deletedDate = ts.toDate ? ts.toDate() : new Date((ts.seconds || 0) * 1000)
  const elapsed = Date.now() - deletedDate.getTime()
  return Math.max(0, 30 - Math.floor(elapsed / (1000 * 60 * 60 * 24)))
}

function ProjectManagement() {
  const { t } = useTranslation()
  const { projects } = useProject()
  const activeProjects = projects.filter(p => p.isActive)
  const { data: globalSettings } = useGlobalSettings()
  const updateSettings = useUpdateGlobalSettings()
  const softDelete = useSoftDeleteProject()
  const { data: deletedProjects = [] } = useDeletedProjects()
  const restoreProject = useRestoreProject()
  const defaultProjectId = globalSettings?.defaultProjectId || ''

  const [selectedId, setSelectedId] = useState('')
  const [creating, setCreating] = useState(false)
  const [subTab, setSubTab] = useState<'general' | 'members'>('general')

  // Fallback to first project if selectedId is invalid or empty
  const selectedProject = activeProjects.find(p => p.id === selectedId) || activeProjects[0]
  const effectiveId = selectedProject?.id || ''
  const isDefault = effectiveId === defaultProjectId

  const handleSelect = (value: string) => {
    if (value === '__create__') {
      setCreating(true)
    } else {
      setSelectedId(value)
      setCreating(false)
    }
  }

  const handleCreated = (newId: string) => {
    setSelectedId(newId)
    setCreating(false)
  }

  const handleDelete = async () => {
    if (!selectedProject) return
    if (!confirm(t('project.deleteConfirm', { name: selectedProject.name }))) return
    await softDelete.mutateAsync(effectiveId)
    setSelectedId('')  // fallback logic handles the rest
  }

  const handleRestore = async (projectId: string) => {
    await restoreProject.mutateAsync(projectId)
    setSelectedId(projectId)
  }

  return (
    <div className="space-y-4">
      {/* Project Selector */}
      <Select
        value={creating ? '__create__' : effectiveId}
        onChange={(e) => handleSelect(e.target.value)}
        selectClassName="w-full"
      >
        {activeProjects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
        <option value="__create__">+ {t('project.create')}</option>
      </Select>

      {creating ? (
        <ProjectCreateForm onCreated={handleCreated} onCancel={() => setCreating(false)} />
      ) : selectedProject ? (
        <>
          {/* Project actions */}
          <div className="flex items-center justify-between">
            <div>
              {isDefault ? (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                  <CheckIcon className="w-3 h-3" />
                  {t('project.isDefault')}
                </span>
              ) : (
                <button
                  onClick={() => updateSettings.mutateAsync({ defaultProjectId: effectiveId })}
                  className="inline-flex items-center gap-1 text-xs border border-gray-300 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-50 transition-colors"
                >
                  <StarIcon className="w-3 h-3" />
                  {t('project.setDefault')}
                </button>
              )}
            </div>
            {!isDefault && (
              <button onClick={handleDelete}
                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                {t('common.delete')}
              </button>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1">
            {([
              { key: 'general' as const, label: t('project.general') },
              { key: 'members' as const, label: t('project.members') },
            ]).map(item => (
              <button key={item.key} onClick={() => setSubTab(item.key)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${subTab === item.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
                {item.label}
              </button>
            ))}
          </div>

          {subTab === 'general' ? (
            <ProjectGeneralSettings project={selectedProject} />
          ) : (
            <MemberManagement project={selectedProject} />
          )}
        </>
      ) : null}

      {/* Deleted Projects */}
      {deletedProjects.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('project.recentlyDeleted')}</p>
          <div className="space-y-2">
            {deletedProjects.map(p => {
              const remaining = getRemainingDays(p.deletedAt)
              return (
                <div key={p.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500 line-through">{p.name}</p>
                    <p className="text-xs text-gray-400">{t('project.autoDeleteDays', { days: remaining })}</p>
                  </div>
                  <button onClick={() => handleRestore(p.id)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                    <RestoreIcon className="w-3.5 h-3.5" />
                    {t('project.restore')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { appUser } = useAuth()
  const isAdmin = appUser?.role === 'admin'
  const [tab, setTab] = useState<'personal' | 'project'>(isAdmin ? 'project' : 'personal')

  const tabs = [
    ...(isAdmin ? [
      { key: 'project' as const, label: t('project.projectSettings') },
    ] : []),
    { key: 'personal' as const, label: t('project.personalSettings') },
  ]

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6">{t('settings.title')}</h2>

        {tabs.length > 1 && (
          <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
            {tabs.map(item => (
              <button key={item.key} onClick={() => setTab(item.key)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === item.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {item.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'personal' ? <PersonalSettings /> : <ProjectManagement />}
      </div>
    </Layout>
  )
}
