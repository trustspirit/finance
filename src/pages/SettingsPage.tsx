import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import Layout from '../components/Layout'
import { CheckIcon, StarIcon, TrashIcon } from '../components/Icons'
import ProjectGeneralSettings from '../components/settings/ProjectGeneralSettings'
import MemberManagement from '../components/settings/MemberManagement'
import { useGlobalSettings, useUpdateGlobalSettings } from '../hooks/queries/useSettings'
import { useSoftDeleteProject } from '../hooks/queries/useProjects'

function ProjectManagement() {
  const { t } = useTranslation()
  const { currentProject, projects, setCurrentProject } = useProject()
  const activeProjects = projects.filter(p => p.isActive)
  const { data: globalSettings, isLoading: settingsLoading } = useGlobalSettings()
  const updateSettings = useUpdateGlobalSettings()
  const softDelete = useSoftDeleteProject()
  const defaultProjectId = globalSettings?.defaultProjectId || ''

  const [subTab, setSubTab] = useState<'general' | 'members'>('general')

  const selectedProject = currentProject || activeProjects[0]
  const effectiveId = selectedProject?.id || ''
  const isDefault = effectiveId === defaultProjectId

  const handleDelete = async () => {
    if (!selectedProject) return
    if (!confirm(t('project.deleteConfirm', { name: selectedProject.name }))) return
    await softDelete.mutateAsync(effectiveId)
    const remaining = activeProjects.filter(p => p.id !== effectiveId)
    if (remaining.length > 0) setCurrentProject(remaining[0])
  }

  return (
    <div className="space-y-4">
      {/* Project Header */}
      {selectedProject && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <span>{selectedProject.name}</span>
          {isDefault && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" />
              {t('project.isDefault')}
            </span>
          )}
        </div>
      )}

      {selectedProject ? (
        <>
          {/* Project actions */}
          {!settingsLoading && <div className="flex items-center justify-between">
            <div>
              {!isDefault && (
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
          </div>}

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
            <ProjectGeneralSettings key={effectiveId} project={selectedProject} />
          ) : (
            <MemberManagement project={selectedProject} />
          )}
        </>
      ) : null}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6">{t('project.projectSettings')}</h2>
        <ProjectManagement />
      </div>
    </Layout>
  )
}
