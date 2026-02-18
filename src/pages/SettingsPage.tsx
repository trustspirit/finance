import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import { formatPhone, fileToBase64 } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { Committee } from '../types'
import Layout from '../components/Layout'
import SignaturePad from '../components/SignaturePad'
import CommitteeSelect from '../components/CommitteeSelect'

export default function SettingsPage() {
  const { appUser, updateAppUser } = useAuth()
  const [displayName, setDisplayName] = useState(appUser?.displayName || '')
  const [phone, setPhone] = useState(appUser?.phone || '')
  const [bankName, setBankName] = useState(appUser?.bankName || '')
  const [bankAccount, setBankAccount] = useState(appUser?.bankAccount || '')
  const [defaultCommittee, setDefaultCommittee] = useState<Committee>(appUser?.defaultCommittee || 'operations')
  const [signature, setSignature] = useState(appUser?.signature || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Bank book
  const [bankBookFile, setBankBookFile] = useState<File | null>(null)
  const [uploadingBankBook, setUploadingBankBook] = useState(false)
  const hasBankBook = !!(appUser?.bankBookDriveUrl)

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert('선호하는 이름을 입력해주세요.')
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
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('저장에 실패했습니다.')
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

      // Save preview as base64 for display
      await updateAppUser({
        bankBookImage: data,
        bankBookDriveId: driveFileId,
        bankBookDriveUrl: driveUrl,
      })
      setBankBookFile(null)
      alert('통장사본이 업로드되었습니다.')
    } catch (error) {
      console.error('Failed to upload bank book:', error)
      alert('업로드에 실패했습니다. Google Drive 설정을 확인해주세요.')
    } finally {
      setUploadingBankBook(false)
    }
  }

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6">설정</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Google 계정 이름</label>
          <input type="text" readOnly value={appUser?.name || ''}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input type="text" readOnly value={appUser?.email || ''}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            선호하는 이름 <span className="text-red-500">*</span>
          </label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="화면에 표시될 이름"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">신청서 및 화면에 이 이름이 표시됩니다.</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">은행</label>
          <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
            placeholder="예: 국민은행"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
          <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
            placeholder="예: 123-456-789012"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        {/* 통장사본 */}
        <div className="mb-4 p-4 border border-gray-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            통장사본 <span className="text-red-500">*</span>
          </label>

          {hasBankBook && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">업로드 완료</span>
                <a href={appUser?.bankBookDriveUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">Google Drive에서 보기</a>
              </div>
              {appUser?.bankBookImage && (
                <img src={appUser.bankBookImage} alt="통장사본"
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
                {uploadingBankBook ? '업로드 중...' : '업로드'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {hasBankBook ? '새 파일을 업로드하면 기존 파일이 교체됩니다.' : '신청서 제출을 위해 통장사본을 업로드해주세요.'}
          </p>
        </div>

        <div className="mb-4">
          <CommitteeSelect value={defaultCommittee} onChange={setDefaultCommittee}
            name="default-committee" label="기본 위원회" />
          <p className="text-xs text-gray-400 mt-1">신청서 작성 시 기본 선택됩니다.</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">서명</label>
          <SignaturePad initialData={signature} onChange={setSignature} />
          <p className="text-xs text-gray-400 mt-1">승인 시 사용될 서명입니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
            {saving ? '저장 중...' : '저장'}
          </button>
          {saved && <span className="text-sm text-green-600">저장되었습니다.</span>}
        </div>
      </div>
    </Layout>
  )
}
