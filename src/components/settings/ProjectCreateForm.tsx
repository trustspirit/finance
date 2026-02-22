import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { Project } from '../../types'
import { useCreateProject } from '../../hooks/queries/useProjects'

export default function ProjectCreateForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const { appUser } = useAuth()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const createProject = useCreateProject()

  const handleCreate = async () => {
    if (!name.trim() || !appUser) return
    setSaving(true)
    setError('')
    try {
      const newDocRef = doc(collection(db, 'projects'))
      await createProject.mutateAsync({
        projectId: newDocRef.id,
        project: {
          name: name.trim(),
          description: desc.trim(),
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
      onCreated(newDocRef.id)
    } catch (err) {
      console.error('Failed to create project:', err)
      setError(t('project.createFailed'))
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('project.name')}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm" autoFocus />
      <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('project.description')}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={saving || !name.trim()} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400">
          {saving ? t('common.saving') : t('project.create')}
        </button>
        <button onClick={onCancel} disabled={saving} className="text-sm text-gray-500 hover:text-gray-700">{t('common.cancel')}</button>
      </div>
    </div>
  )
}
