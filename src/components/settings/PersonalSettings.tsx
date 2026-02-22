import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../hooks/queries/queryKeys'
import { formatPhone, formatBankAccount, fileToBase64, validateBankBookFile } from '../../lib/utils'
import BankSelect from '../BankSelect'
import { useAuth } from '../../contexts/AuthContext'
import { Committee } from '../../types'
import SignaturePad from '../SignaturePad'
import CommitteeSelect from '../CommitteeSelect'
import { useUploadBankBook } from '../../hooks/queries/useCloudFunctions'

export default function PersonalSettings() {
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
  const hasBankBook = !!(appUser?.bankBookUrl || appUser?.bankBookDriveUrl)

  // Re-format account number when bank changes
  const bankNameMounted = useRef(false)
  useEffect(() => {
    if (!bankNameMounted.current) { bankNameMounted.current = true; return }
    if (bankName && bankAccount) setBankAccount(formatBankAccount(bankAccount, bankName))
  }, [bankName]) // eslint-disable-line react-hooks/exhaustive-deps

  const queryClient = useQueryClient()
  const uploadBankBook = useUploadBankBook()

  const handleSave = async () => {
    if (!displayName.trim()) { alert(t('validation.displayNameRequired')); return }
    setSaving(true); setSaved(false)
    try {
      await updateAppUser({ displayName: displayName.trim(), phone: phone.trim(), bankName: bankName.trim(), bankAccount: bankAccount.trim(), defaultCommittee, signature })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { alert(t('settings.saveFailed')) } finally { setSaving(false) }
  }

  const handleUploadBankBook = async () => {
    if (!bankBookFile) return
    setUploadingBankBook(true)
    try {
      const data = await fileToBase64(bankBookFile)
      const { storagePath, url } = await uploadBankBook.mutateAsync({ file: { name: bankBookFile.name, data } })
      await updateAppUser({ bankBookImage: '', bankBookPath: storagePath, bankBookUrl: url })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
      setBankBookFile(null); alert(t('settings.bankBookUploadSuccess'))
    } catch { alert(t('settings.bankBookUploadFailed')) } finally { setUploadingBankBook(false) }
  }

  return (
    <>
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">{i18n.language.startsWith('ko') ? '언어' : 'Language'}</label>
        <div className="flex gap-2">
          <button onClick={() => i18n.changeLanguage('ko')} className={`px-4 py-2 rounded text-sm font-medium ${i18n.language.startsWith('ko') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>한국어</button>
          <button onClick={() => i18n.changeLanguage('en')} className={`px-4 py-2 rounded text-sm font-medium ${i18n.language.startsWith('en') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>English</button>
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
        <BankSelect value={bankName} onChange={setBankName} label={t('field.bank')} />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('field.bankAccount')}</label>
        <input type="text" value={bankAccount}
          onChange={(e) => setBankAccount(formatBankAccount(e.target.value, bankName))}
          placeholder={t('field.bankAccount')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div className="mb-4 p-4 border border-gray-200 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('field.bankBook')} <span className="text-red-500">*</span></label>
        {hasBankBook && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('settings.bankBookUploaded')}</span>
              <a href={appUser?.bankBookUrl || appUser?.bankBookDriveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{t('settings.bankBookViewDrive')}</a>
            </div>
            {(appUser?.bankBookUrl || appUser?.bankBookDriveUrl) && <img src={appUser.bankBookUrl || appUser.bankBookDriveUrl} alt={t('field.bankBook')} className="max-h-32 border border-gray-200 rounded" />}
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
