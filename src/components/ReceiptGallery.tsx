import { useTranslation } from 'react-i18next'
import { Receipt } from '../types'

interface Props {
  receipts: Receipt[]
  title?: string
}

export default function ReceiptGallery({ receipts, title }: Props) {
  const { t } = useTranslation()
  if (receipts.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        {title ?? t('field.receipts')} ({receipts.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {receipts.map((r, i) => (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <a href={r.driveUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={`https://drive.google.com/thumbnail?id=${r.driveFileId}&sz=w400`}
                alt={r.fileName}
                className="w-full h-48 object-contain bg-gray-50"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </a>
            <div className="px-3 py-2 bg-gray-50 border-t">
              <a href={r.driveUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline truncate block">{r.fileName}</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
