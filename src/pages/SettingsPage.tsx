import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import Layout from '../components/Layout'
import PersonalSettings from '../components/settings/PersonalSettings'
import ProjectGeneralSettings from '../components/settings/ProjectGeneralSettings'
import MemberManagement from '../components/settings/MemberManagement'
import ProjectCreateForm from '../components/settings/ProjectCreateForm'
import { useGlobalSettings, useUpdateGlobalSettings } from '../hooks/queries/useSettings'
import { useUpdateProject } from '../hooks/queries/useProjects'

function ProjectManagement() {
  const { t } = useTranslation()
  const { projects } = useProject()
  const activeProjects = projects.filter(p => p.isActive)
  const { data: globalSettings } = useGlobalSettings()
  const updateSettings = useUpdateGlobalSettings()
  const updateProject = useUpdateProject()
  const defaultProjectId = globalSettings?.defaultProjectId || ''

  const [selectedId, setSelectedId] = useState(activeProjects[0]?.id || '')
  const [creating, setCreating] = useState(false)
  const [subTab, setSubTab] = useState<'general' | 'members'>('general')

  const selectedProject = activeProjects.find(p => p.id === selectedId)
  const isDefault = selectedId === defaultProjectId

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

  return (
    <div className="space-y-4">
      {/* Project Selector */}
      <select
        value={creating ? '__create__' : selectedId}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      >
        {activeProjects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
        <option value="__create__">+ {t('project.create')}</option>
      </select>

      {creating ? (
        <ProjectCreateForm onCreated={handleCreated} onCancel={() => setCreating(false)} />
      ) : selectedProject ? (
        <>
          {/* Project actions */}
          <div className="flex items-center justify-between">
            <div>
              {isDefault ? (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  {t('project.isDefault')}
                </span>
              ) : (
                <button
                  onClick={() => updateSettings.mutateAsync({ defaultProjectId: selectedId })}
                  className="inline-flex items-center gap-1 text-xs border border-gray-300 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  {t('project.setDefault')}
                </button>
              )}
            </div>
            {!isDefault && (
              <button
                onClick={async () => {
                  if (!confirm(t('project.deleteConfirm', { name: selectedProject.name }))) return
                  await updateProject.mutateAsync({ projectId: selectedId, data: { isActive: false } })
                }}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
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
