import { useState, useEffect, useMemo } from 'react'
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
    const { valid, errors: fileErrs } = validateFiles(selected, t)
    setErrors(fileErrs)
    onFilesChange([...files, ...valid])
    e.target.value = ''
  }

  // Generate preview URLs synchronously for render, clean up on files change / unmount
  const previews = useMemo(() =>
    files.map((f) => ({
      url: URL.createObjectURL(f),
      isImage: f.type.startsWith('image/'),
    })), [files])

  useEffect(() => {
    return () => { previews.forEach(p => URL.revokeObjectURL(p.url)) }
  }, [previews])

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
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((f, i) => (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {previews[i].isImage ? (
                <img src={previews[i].url} alt={f.name}
                  className="w-full h-32 object-contain bg-white" />
              ) : (
                <object data={previews[i].url} type="application/pdf"
                  className="w-full h-32 bg-white pointer-events-none">
                  <p className="text-xs text-gray-400 p-2">{f.name}</p>
                </object>
              )}
              <div className="px-2 py-1.5 border-t flex items-center justify-between gap-1">
                <span className="text-xs text-gray-600 truncate">{f.name}</span>
                <button type="button" onClick={() => onFilesChange(files.filter((_, j) => j !== i))}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
