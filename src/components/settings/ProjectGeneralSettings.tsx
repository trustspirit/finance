import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../hooks/queries/queryKeys'
import { collection, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useProject } from '../../contexts/ProjectContext'
import { Project } from '../../types'
import { useGlobalSettings, useUpdateGlobalSettings } from '../../hooks/queries/useSettings'
import { useCreateProject, useUpdateProject } from '../../hooks/queries/useProjects'

export default function ProjectGeneralSettings() {
  const { t } = useTranslation()
  const { appUser } = useAuth()
  const { projects } = useProject()
  const { data: globalSettings } = useGlobalSettings()
  const defaultProjectId = globalSettings?.defaultProjectId || ''
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.root() })
  }, [queryClient])

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', description: '', documentNo: '', directorApprovalThreshold: 600000, budgetWarningThreshold: 85 })
  const [savingEdit, setSavingEdit] = useState(false)

  const createProject = useCreateProject()
  const updateProjectMutation = useUpdateProject()
  const updateSettings = useUpdateGlobalSettings()

  const handleCreate = async () => {
    if (!newName.trim() || !appUser) return
    setCreating(true)
    try {
      const newDocRef = doc(collection(db, 'projects'))
      await createProject.mutateAsync({
        projectId: newDocRef.id,
        project: {
          name: newName.trim(),
          description: newDesc.trim(),
          createdAt: serverTimestamp(),
          createdBy: { uid: appUser.uid, name: appUser.displayName || appUser.name, email: appUser.email },
          budgetConfig: { totalBudget: 0, byCode: {} },
          documentNo: '',
          directorApprovalThreshold: 600000,
          budgetWarningThreshold: 85,
          memberUids: [appUser.uid],
          isActive: true,
        } as unknown as Omit<Project, 'id'>,
      })
      setNewName(''); setNewDesc(''); setShowCreate(false)
    } catch (err) { console.error('Failed to create project:', err) }
    finally { setCreating(false) }
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm(t('common.confirm') + '?')) return
    try {
      await updateProjectMutation.mutateAsync({ projectId, data: { isActive: false } })
    } catch (err) { console.error('Failed to delete project:', err) }
  }

  const handleSetDefault = async (projectId: string) => {
    try {
      await updateSettings.mutateAsync({ defaultProjectId: projectId })
    } catch (err) { console.error('Failed to set default:', err) }
  }

  const startEdit = (p: Project) => {
    setEditingId(p.id)
    setEditData({
      name: p.name || '',
      description: p.description || '',
      documentNo: p.documentNo || '',
      directorApprovalThreshold: p.directorApprovalThreshold ?? 600000,
      budgetWarningThreshold: p.budgetWarningThreshold ?? 85,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    try {
      await updateProjectMutation.mutateAsync({
        projectId: editingId,
        data: {
          name: editData.name,
          description: editData.description,
          documentNo: editData.documentNo,
          directorApprovalThreshold: editData.directorApprovalThreshold,
          budgetWarningThreshold: editData.budgetWarningThreshold,
        },
      })
      setEditingId(null)
    } catch (err) { console.error('Failed to save:', err) }
    finally { setSavingEdit(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            + {t('project.create')}
          </button>
        ) : (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('project.name')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2" />
            <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('project.description')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3" />
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating || !newName.trim()} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400">
                {creating ? t('common.saving') : t('project.create')}
              </button>
              <button onClick={() => setShowCreate(false)} className="text-sm text-gray-500 hover:text-gray-700">{t('common.cancel')}</button>
            </div>
          </div>
        )}
      </div>

      {projects.filter(p => p.isActive).map(p => (
        <div key={p.id} className="border border-gray-200 rounded-lg p-4">
          {editingId === p.id ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('project.name')}</label>
                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('project.description')}</label>
                <input type="text" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('dashboard.documentNo')}</label>
                <input type="text" value={editData.documentNo} onChange={(e) => setEditData({ ...editData, documentNo: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('project.directorThreshold')}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">₩</span>
                  <input type="number" value={editData.directorApprovalThreshold}
                    onChange={(e) => setEditData({ ...editData, directorApprovalThreshold: Number(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm" step="10000" min="0" />
                </div>
                <p className="text-xs text-gray-400 mt-1">{t('project.directorThresholdHint')}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('budget.warningThreshold')}</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={editData.budgetWarningThreshold}
                    onChange={(e) => setEditData({ ...editData, budgetWarningThreshold: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm" step="5" min="0" max="100" />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t('budget.warningThresholdHint')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={savingEdit} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400">
                  {savingEdit ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setEditingId(null)} className="text-sm text-gray-500 hover:text-gray-700">{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{p.name}</h3>
                  {p.id === defaultProjectId && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('project.isDefault')}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs text-blue-600 hover:text-blue-800">{t('common.edit')}</button>
                  {p.id !== defaultProjectId && (
                    <>
                      <button onClick={() => handleSetDefault(p.id)} className="text-xs text-green-600 hover:text-green-800">{t('project.setDefault')}</button>
                      <button onClick={() => handleDelete(p.id)} className="text-xs text-red-600 hover:text-red-800">{t('common.delete')}</button>
                    </>
                  )}
                </div>
              </div>
              {p.description && <p className="text-sm text-gray-500 mb-1">{p.description}</p>}
              <p className="text-xs text-gray-400">{t('project.memberCount', { count: (p.memberUids || []).length })}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
