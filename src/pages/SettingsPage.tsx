import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, doc, setDoc, arrayUnion, arrayRemove, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, functions } from '../lib/firebase'
import { formatPhone, fileToBase64, validateBankBookFile } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { Committee, Project, AppUser } from '../types'
import Layout from '../components/Layout'
import SignaturePad from '../components/SignaturePad'
import CommitteeSelect from '../components/CommitteeSelect'

function PersonalSettings() {
  const { t, i18n } = useTranslation()
  const { appUser, updateAppUser } = useAuth()
  const [displayName, setDisplayName] = useState(appUser?.displayName || '')
  const [phone, setPhone] = useState(appUser?.phone || '')
  const [bankName, setBankName] = useState(appUser?.bankName || '')
  const [bankAccount, setBankAccount] = useState(appUser?.bankAccount || '')
  const [defaultCommittee, setDefaultCommittee] = useState<Committee>(appUser?.defaultCommittee || 'operations')
  const [signature, setSignature] = useState(appUser?.signature || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [bankBookFile, setBankBookFile] = useState<File | null>(null)
  const [uploadingBankBook, setUploadingBankBook] = useState(false)
  const [bankBookError, setBankBookError] = useState<string | null>(null)
  const hasBankBook = !!(appUser?.bankBookDriveUrl)

  const handleSave = async () => {
    if (!displayName.trim()) { alert(t('validation.displayNameRequired')); return }
    setSaving(true); setSaved(false)
    try {
      await updateAppUser({ displayName: displayName.trim(), phone: phone.trim(), bankName: bankName.trim(), bankAccount: bankAccount.trim(), defaultCommittee, signature })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { alert(t('settings.saveFailed')) } finally { setSaving(false) }
  }

  const handleUploadBankBook = async () => {
    if (!bankBookFile) return
    setUploadingBankBook(true)
    try {
      const data = await fileToBase64(bankBookFile)
      const uploadFn = httpsCallable<{ file: { name: string; data: string } }, { fileName: string; driveFileId: string; driveUrl: string }>(functions, 'uploadBankBook')
      const result = await uploadFn({ file: { name: bankBookFile.name, data } })
      const { driveFileId, driveUrl } = result.data
      await updateAppUser({ bankBookImage: data, bankBookDriveId: driveFileId, bankBookDriveUrl: driveUrl })
      setBankBookFile(null); alert(t('settings.bankBookUploadSuccess'))
    } catch { alert(t('settings.bankBookUploadFailed')) } finally { setUploadingBankBook(false) }
  }

  return (
    <>
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">{i18n.language === 'ko' ? '언어' : 'Language'}</label>
        <div className="flex gap-2">
          <button onClick={() => i18n.changeLanguage('ko')} className={`px-4 py-2 rounded text-sm font-medium ${i18n.language === 'ko' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>한국어</button>
          <button onClick={() => i18n.changeLanguage('en')} className={`px-4 py-2 rounded text-sm font-medium ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>English</button>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.googleName')}</label>
        <input type="text" readOnly value={appUser?.name || ''} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.email')}</label>
        <input type="text" readOnly value={appUser?.email || ''} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.displayName')} <span className="text-red-500">*</span></label>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        <p className="text-xs text-gray-400 mt-1">{t('settings.displayNameHint')}</p>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.phone')}</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.bank')}</label>
        <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.bankAccount')}</label>
        <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div className="mb-4 p-4 border border-gray-200 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('field.bankBook')} <span className="text-red-500">*</span></label>
        {hasBankBook && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('settings.bankBookUploaded')}</span>
              <a href={appUser?.bankBookDriveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{t('settings.bankBookViewDrive')}</a>
            </div>
            {appUser?.bankBookImage && <img src={appUser.bankBookImage} alt={t('field.bankBook')} className="max-h-32 border border-gray-200 rounded" />}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => {
            const f = e.target.files?.[0] || null
            if (f) { const err = validateBankBookFile(f); if (err) { setBankBookError(err); setBankBookFile(null); e.target.value = ''; return } }
            setBankBookError(null); setBankBookFile(f)
          }} className="text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {bankBookError && <p className="text-xs text-red-600 mt-1">{bankBookError}</p>}
          {bankBookFile && (
            <button onClick={handleUploadBankBook} disabled={uploadingBankBook} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400 whitespace-nowrap">
              {uploadingBankBook ? t('settings.bankBookUploading') : t('settings.bankBookUpload')}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">{hasBankBook ? t('settings.bankBookReplaceHint') : t('settings.bankBookRequiredHint')}</p>
      </div>
      <div className="mb-4">
        <CommitteeSelect value={defaultCommittee} onChange={setDefaultCommittee} name="default-committee" label={t('field.defaultCommittee')} />
        <p className="text-xs text-gray-400 mt-1">{t('settings.committeeHint')}</p>
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.signature')}</label>
        <SignaturePad initialData={signature} onChange={setSignature} />
        <p className="text-xs text-gray-400 mt-1">{t('settings.signatureHint')}</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {saved && <span className="text-sm text-green-600">{t('common.saved')}</span>}
      </div>
    </>
  )
}

function ProjectManagement() {
  const { t } = useTranslation()
  const { appUser } = useAuth()
  const { refreshProjects } = useProject()
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [defaultProjectId, setDefaultProjectId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', description: '', documentNo: '', driveFolders: { operations: '', preparation: '', bankbook: '' } })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [projSnap, userSnap, globalSnap] = await Promise.all([
          getDocs(collection(db, 'projects')),
          getDocs(collection(db, 'users')),
          getDoc(doc(db, 'settings', 'global')),
        ])
        setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project)))
        setUsers(userSnap.docs.map(d => d.data() as AppUser))
        if (globalSnap.exists()) setDefaultProjectId(globalSnap.data().defaultProjectId || '')
      } catch (err) { console.error('Failed to fetch projects:', err) }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim() || !appUser) return
    setCreating(true)
    try {
      const ref = doc(collection(db, 'projects'))
      await setDoc(ref, {
        name: newName.trim(),
        description: newDesc.trim(),
        createdAt: serverTimestamp(),
        createdBy: { uid: appUser.uid, name: appUser.displayName || appUser.name, email: appUser.email },
        budgetConfig: { totalBudget: 0, byCode: {} },
        documentNo: '',
        driveFolders: { operations: '', preparation: '', bankbook: '' },
        memberUids: [appUser.uid],
        isActive: true,
      })
      setProjects(prev => [...prev, { id: ref.id, name: newName.trim(), description: newDesc.trim(), memberUids: [appUser.uid], isActive: true } as Project])
      setNewName(''); setNewDesc(''); setShowCreate(false)
      await refreshProjects()
    } catch (err) { console.error('Failed to create project:', err) }
    finally { setCreating(false) }
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm(t('common.confirm') + '?')) return
    try {
      await setDoc(doc(db, 'projects', projectId), { isActive: false }, { merge: true })
      setProjects(prev => prev.filter(p => p.id !== projectId))
      await refreshProjects()
    } catch (err) { console.error('Failed to delete project:', err) }
  }

  const handleSetDefault = async (projectId: string) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { defaultProjectId: projectId }, { merge: true })
      setDefaultProjectId(projectId)
    } catch (err) { console.error('Failed to set default:', err) }
  }

  const startEdit = (p: Project) => {
    setEditingId(p.id)
    setEditData({
      name: p.name || '',
      description: p.description || '',
      documentNo: p.documentNo || '',
      driveFolders: p.driveFolders || { operations: '', preparation: '', bankbook: '' },
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    try {
      await setDoc(doc(db, 'projects', editingId), {
        name: editData.name,
        description: editData.description,
        documentNo: editData.documentNo,
        driveFolders: editData.driveFolders,
      }, { merge: true })
      setProjects(prev => prev.map(p => p.id === editingId ? { ...p, ...editData } : p))
      setEditingId(null)
      await refreshProjects()
    } catch (err) { console.error('Failed to save:', err) }
    finally { setSavingEdit(false) }
  }

  const handleToggleMember = async (projectId: string, uid: string, add: boolean) => {
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'projects', projectId), {
        memberUids: add ? arrayUnion(uid) : arrayRemove(uid),
      })
      batch.update(doc(db, 'users', uid), {
        projectIds: add ? arrayUnion(projectId) : arrayRemove(projectId),
      })
      await batch.commit()
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p
        const members = p.memberUids || []
        return { ...p, memberUids: add ? [...members, uid] : members.filter(u => u !== uid) }
      }))
    } catch (err) { console.error('Failed to toggle member:', err) }
  }

  if (loading) return <p className="text-sm text-gray-500">{t('common.loading')}</p>

  return (
    <div className="space-y-6">
      {/* Create Project */}
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

      {/* Project List */}
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
                <label className="block text-xs text-gray-500 mb-1">{t('project.driveFolders')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('project.driveFolderHint')}</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">{t('project.operationsFolder')}</label>
                    <input type="text" value={editData.driveFolders.operations}
                      onChange={(e) => setEditData({ ...editData, driveFolders: { ...editData.driveFolders, operations: e.target.value } })}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono" placeholder="1abc..." />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t('project.preparationFolder')}</label>
                    <input type="text" value={editData.driveFolders.preparation}
                      onChange={(e) => setEditData({ ...editData, driveFolders: { ...editData.driveFolders, preparation: e.target.value } })}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono" placeholder="1abc..." />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t('project.bankbookFolder')}</label>
                    <input type="text" value={editData.driveFolders.bankbook}
                      onChange={(e) => setEditData({ ...editData, driveFolders: { ...editData.driveFolders, bankbook: e.target.value } })}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono" placeholder="1abc..." />
                  </div>
                </div>
              </div>
              {/* Members */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('project.members')}</label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {users.map(u => (
                    <label key={u.uid} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                      <input type="checkbox" checked={(p.memberUids || []).includes(u.uid)}
                        onChange={(e) => handleToggleMember(p.id, u.uid, e.target.checked)} />
                      <span>{u.displayName || u.name}</span>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </label>
                  ))}
                </div>
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

export default function SettingsPage() {
  const { t } = useTranslation()
  const { appUser } = useAuth()
  const isAdmin = appUser?.role === 'admin'
  const [tab, setTab] = useState<'personal' | 'project'>(isAdmin ? 'project' : 'personal')

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6">{t('settings.title')}</h2>

        {isAdmin && (
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            <button onClick={() => setTab('project')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'project' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t('project.projectSettings')}
            </button>
            <button onClick={() => setTab('personal')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'personal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t('project.personalSettings')}
            </button>
          </div>
        )}

        {tab === 'personal' ? <PersonalSettings /> : <ProjectManagement />}
      </div>
    </Layout>
  )
}
