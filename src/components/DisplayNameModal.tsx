import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { Committee } from '../types'
import { formatPhone, fileToBase64, validateBankBookFile } from '../lib/utils'
import ErrorAlert from './ErrorAlert'
import CommitteeSelect from './CommitteeSelect'
import FormField from './FormField'

export default function DisplayNameModal() {
  const { t } = useTranslation()
  const { appUser, updateAppUser, setNeedsDisplayName } = useAuth()
  const [displayName, setDisplayName] = useState(appUser?.name || '')
  const [phone, setPhone] = useState(appUser?.phone || '')
  const [bankName, setBankName] = useState(appUser?.bankName || '')
  const [bankAccount, setBankAccount] = useState(appUser?.bankAccount || '')
  const [committee, setCommittee] = useState<Committee>('operations')
  const [bankBookFile, setBankBookFile] = useState<File | null>(null)
  const [bankBookError, setBankBookError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const validate = (): string[] => {
    const errs: string[] = []
    if (!displayName.trim()) errs.push(t('validation.displayNameRequired'))
    if (!phone.trim()) errs.push(t('validation.phoneRequired'))
    if (!bankName.trim()) errs.push(t('validation.bankRequired'))
    if (!bankAccount.trim()) errs.push(t('validation.bankAccountRequired'))
    // bankBook is optional at initial setup - required at request submission
    return errs
  }

  const handleSave = async () => {
    const validationErrors = validate()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])
    setSaving(true)
    try {
      // Upload bank book if selected
      if (bankBookFile) {
        const data = await fileToBase64(bankBookFile)
        const uploadFn = httpsCallable<
          { file: { name: string; data: string } },
          { fileName: string; storagePath: string; url: string }
        >(functions, 'uploadBankBook')
        const result = await uploadFn({ file: { name: bankBookFile.name, data } })
        const { storagePath, url } = result.data
        await updateAppUser({
          displayName: displayName.trim(),
          phone: phone.trim(),
          bankName: bankName.trim(),
          bankAccount: bankAccount.trim(),
          defaultCommittee: committee,
          bankBookImage: '',
          bankBookPath: storagePath,
          bankBookUrl: url,
        })
      } else {
        await updateAppUser({
          displayName: displayName.trim(),
          phone: phone.trim(),
          bankName: bankName.trim(),
          bankAccount: bankAccount.trim(),
          defaultCommittee: committee,
        })
      }
      setNeedsDisplayName(false)
    } catch (error) {
      console.error('Failed to save profile:', error)
      alert(t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-1">{t('setup.title')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('setup.description')}</p>

        <ErrorAlert errors={errors} />

        <div className="space-y-3">
          <FormField label={t('field.displayName')} required hint={t('settings.displayNameHint')}>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              autoFocus className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          <FormField label={t('field.phone')} required>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          <FormField label={t('field.bank')} required>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          <FormField label={t('field.bankAccount')} required>
            <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          {/* Bank Book Upload */}
          <FormField label={t('field.bankBook')} hint={t('settings.bankBookRequiredHint')}>
            <input type="file" accept=".png,.jpg,.jpeg,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                if (f) {
                  const err = validateBankBookFile(f)
                  if (err) { setBankBookError(err); setBankBookFile(null); e.target.value = ''; return }
                }
                setBankBookError(null)
                setBankBookFile(f)
              }}
              className="w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {bankBookError && <p className="text-xs text-red-600 mt-1">{bankBookError}</p>}
            {bankBookFile && (
              <p className="text-xs text-green-600 mt-1">{bankBookFile.name} ({(bankBookFile.size / 1024).toFixed(0)}KB)</p>
            )}
          </FormField>

          <CommitteeSelect value={committee} onChange={setCommittee}
            name="init-committee" label={t('field.defaultCommittee')} />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full mt-5 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
          {saving ? t('setup.saving') : t('setup.start')}
        </button>
      </div>
    </div>
  )
}
