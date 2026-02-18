import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import { formatPhone, fileToBase64 } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { Committee } from '../types'
import Layout from '../components/Layout'
import SignaturePad from '../components/SignaturePad'
import CommitteeSelect from '../components/CommitteeSelect'

export default function SettingsPage() {
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
  const hasBankBook = !!(appUser?.bankBookDriveUrl)

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert(t('validation.displayNameRequired'))
      return
    }
    setSaving(true)
    setSaved(false)
    try {
      await updateAppUser({
        displayName: displayName.trim(),
        phone: phone.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        defaultCommittee,
        signature,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert(t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleUploadBankBook = async () => {
    if (!bankBookFile) return
    setUploadingBankBook(true)
    try {
      const data = await fileToBase64(bankBookFile)
      const uploadFn = httpsCallable<
        { file: { name: string; data: string } },
        { fileName: string; driveFileId: string; driveUrl: string }
      >(functions, 'uploadBankBook')
      const result = await uploadFn({ file: { name: bankBookFile.name, data } })
      const { driveFileId, driveUrl } = result.data
      await updateAppUser({
        bankBookImage: data,
        bankBookDriveId: driveFileId,
        bankBookDriveUrl: driveUrl,
      })
      setBankBookFile(null)
      alert(t('settings.bankBookUploadSuccess'))
    } catch {
      alert(t('settings.bankBookUploadFailed'))
    } finally {
      setUploadingBankBook(false)
    }
  }

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6">{t('settings.title')}</h2>

        {/* Language */}
        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {i18n.language === 'ko' ? '언어' : 'Language'}
          </label>
          <div className="flex gap-2">
            <button onClick={() => i18n.changeLanguage('ko')}
              className={`px-4 py-2 rounded text-sm font-medium ${i18n.language === 'ko' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              한국어
            </button>
            <button onClick={() => i18n.changeLanguage('en')}
              className={`px-4 py-2 rounded text-sm font-medium ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              English
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.googleName')}</label>
          <input type="text" readOnly value={appUser?.name || ''}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.email')}</label>
          <input type="text" readOnly value={appUser?.email || ''}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('field.displayName')} <span className="text-red-500">*</span>
          </label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">{t('settings.displayNameHint')}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.phone')}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.bank')}</label>
          <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.bankAccount')}</label>
          <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        {/* Bank Book */}
        <div className="mb-4 p-4 border border-gray-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('field.bankBook')} <span className="text-red-500">*</span>
          </label>
          {hasBankBook && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('settings.bankBookUploaded')}</span>
                <a href={appUser?.bankBookDriveUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">{t('settings.bankBookViewDrive')}</a>
              </div>
              {appUser?.bankBookImage && (
                <img src={appUser.bankBookImage} alt={t('field.bankBook')}
                  className="max-h-32 border border-gray-200 rounded" />
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*,.pdf"
              onChange={(e) => setBankBookFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {bankBookFile && (
              <button onClick={handleUploadBankBook} disabled={uploadingBankBook}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400 whitespace-nowrap">
                {uploadingBankBook ? t('settings.bankBookUploading') : t('settings.bankBookUpload')}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {hasBankBook ? t('settings.bankBookReplaceHint') : t('settings.bankBookRequiredHint')}
          </p>
        </div>

        <div className="mb-4">
          <CommitteeSelect value={defaultCommittee} onChange={setDefaultCommittee}
            name="default-committee" label={t('field.defaultCommittee')} />
          <p className="text-xs text-gray-400 mt-1">{t('settings.committeeHint')}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.signature')}</label>
          <SignaturePad initialData={signature} onChange={setSignature} />
          <p className="text-xs text-gray-400 mt-1">{t('settings.signatureHint')}</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
            {saving ? t('common.saving') : t('common.save')}
          </button>
          {saved && <span className="text-sm text-green-600">{t('common.saved')}</span>}
        </div>
      </div>
    </Layout>
  )
}
