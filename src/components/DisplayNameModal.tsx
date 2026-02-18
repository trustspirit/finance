import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Committee } from '../types'
import { formatPhone } from '../lib/utils'
import ErrorAlert from './ErrorAlert'
import CommitteeSelect from './CommitteeSelect'
import FormField from './FormField'

export default function DisplayNameModal() {
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
    if (!displayName.trim()) errs.push('선호하는 이름을 입력해주세요.')
    if (!phone.trim()) errs.push('전화번호를 입력해주세요.')
    if (!bankName.trim()) errs.push('은행명을 입력해주세요.')
    if (!bankAccount.trim()) errs.push('계좌번호를 입력해주세요.')
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
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-1">초기 정보 설정</h3>
        <p className="text-sm text-gray-500 mb-4">
          신청서에 사용될 기본 정보를 입력해주세요. 이후 설정에서 변경할 수 있습니다.
        </p>

        <ErrorAlert errors={errors} />

        <div className="space-y-3">
          <FormField label="선호하는 이름" required>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="예: 홍길동" autoFocus
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          <FormField label="전화번호" required>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          <FormField label="은행" required>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
              placeholder="예: 국민은행"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          <FormField label="계좌번호" required>
            <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
              placeholder="예: 123-456-789012"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </FormField>

          <CommitteeSelect value={committee} onChange={setCommittee}
            name="init-committee" label="소속 위원회" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full mt-5 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
          {saving ? '저장 중...' : '시작하기'}
        </button>
      </div>
    </div>
  )
}
