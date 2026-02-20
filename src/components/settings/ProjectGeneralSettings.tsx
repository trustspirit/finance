import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Project } from '../../types'
import { useUpdateProject } from '../../hooks/queries/useProjects'

export default function ProjectGeneralSettings({ project }: { project: Project }) {
  const { t } = useTranslation()

  const [name, setName] = useState(project.name || '')
  const [description, setDescription] = useState(project.description || '')
  const [documentNo, setDocumentNo] = useState(project.documentNo || '')
  const [threshold, setThreshold] = useState(project.directorApprovalThreshold ?? 600000)
  const [warningPct, setWarningPct] = useState(project.budgetWarningThreshold ?? 85)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateProject = useUpdateProject()

  const dirty = name !== (project.name || '') ||
    description !== (project.description || '') ||
    documentNo !== (project.documentNo || '') ||
    threshold !== (project.directorApprovalThreshold ?? 600000) ||
    warningPct !== (project.budgetWarningThreshold ?? 85)

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      await updateProject.mutateAsync({
        projectId: project.id,
        data: { name, description, documentNo, directorApprovalThreshold: threshold, budgetWarningThreshold: warningPct },
      })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (err) { console.error('Failed to save:', err) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('project.name')}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('project.description')}</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('dashboard.documentNo')}</label>
        <input type="text" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('project.directorThreshold')}</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">₩</span>
          <input type="number" value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" step="10000" min="0" />
        </div>
        <p className="text-xs text-gray-400 mt-1">{t('project.directorThresholdHint')}</p>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('budget.warningThreshold')}</label>
        <div className="flex items-center gap-2">
          <input type="number" value={warningPct}
            onChange={(e) => setWarningPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" step="5" min="0" max="100" />
          <span className="text-sm text-gray-500">%</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{t('budget.warningThresholdHint')}</p>
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
        <button onClick={handleSave} disabled={saving || !dirty}
          className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-300">
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {saved && <span className="text-xs text-green-600">{t('common.saved')}</span>}
      </div>
    </div>
  )
}
