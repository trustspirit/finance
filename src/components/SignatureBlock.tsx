import { useTranslation } from 'react-i18next'

interface Props {
  payeeName: string
  signatureData?: string | null
}

export default function SignatureBlock({ payeeName, signatureData }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mb-6 pt-4 border-t">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-gray-500 mb-1">Requested by</p>
          {signatureData && (
            <img src={signatureData} alt={t('approval.approvalSignature')} className="max-h-16 mb-1" />
          )}
          <div className="border-t border-gray-300 pt-1 text-sm">{payeeName}</div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Approved by (budget approver)</p>
          <div className="border-t border-gray-300 pt-1 text-sm h-16">&nbsp;</div>
        </div>
      </div>
    </div>
  )
}
