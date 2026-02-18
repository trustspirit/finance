import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { Committee } from '../types'
import { formatPhone } from '../lib/utils'
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
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const validate = (): string[] => {
    const errs: string[] = []
    if (!displayName.trim()) errs.push(t('validation.displayNameRequired'))
    if (!phone.trim()) errs.push(t('validation.phoneRequired'))
    if (!bankName.trim()) errs.push(t('validation.bankRequired'))
    if (!bankAccount.trim()) errs.push(t('validation.bankAccountRequired'))
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
      await updateAppUser({
        displayName: displayName.trim(),
        phone: phone.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        defaultCommittee: committee,
      })
      setNeedsDisplayName(false)
    } catch (error) {
      console.error('Failed to save profile:', error)
      alert(t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-1">{t('setup.title')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('setup.description')}</p>

        <ErrorAlert errors={errors} />

        <div className="space-y-3">
          <FormField label={t('field.displayName')} required>
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
