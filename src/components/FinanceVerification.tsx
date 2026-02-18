interface Props {
  documentNo?: string
}

export default function FinanceVerification({ documentNo = 'KOR01-6762808-5xxx-KYSA2025KOR' }: Props) {
  return (
    <div className="mb-6 border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Area Office Finance Verification</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">Document No.</p>
          <p className="font-mono font-medium">{documentNo}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Signature</p>
          <div className="border-b border-gray-300 h-8" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Date approved</p>
          <div className="border-b border-gray-300 h-6" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs text-gray-500">Additional Information / Comments</p>
        <div className="border-b border-gray-300 h-8" />
      </div>
    </div>
  )
}
