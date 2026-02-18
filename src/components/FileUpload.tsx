import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { validateFiles } from '../lib/utils'

interface Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  label?: string
  required?: boolean
  existingCount?: number
  existingLabel?: string
}

export default function FileUpload({
  files, onFilesChange, label, required = true,
  existingCount, existingLabel,
}: Props) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<string[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const { valid, errors: fileErrs } = validateFiles(selected)
    setErrors(fileErrs)
    onFilesChange(valid)
    if (fileErrs.length > 0) e.target.value = ''
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label ?? t('field.receipts')} {required && <span className="text-red-500">*</span>}
      </label>
      {existingCount && existingCount > 0 && files.length === 0 && existingLabel && (
        <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
          {existingLabel}
        </div>
      )}
      <input
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.pdf"
        onChange={handleChange}
        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      <p className="text-xs text-gray-400 mt-1">{t('form.receiptHint')}</p>
      {errors.length > 0 && (
        <ul className="mt-2 text-sm text-red-600 space-y-1">
          {errors.map((err, i) => <li key={i}>{err}</li>)}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="mt-2 text-sm text-gray-600">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span>{f.name}</span>
              <span className="text-xs text-gray-400">({(f.size / 1024).toFixed(0)}KB)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
