import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { formatFirestoreDate } from '../lib/utils'
import { exportSettlementPdf } from '../lib/pdfExport'
import { useSettlement } from '../hooks/queries/useSettlements'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import InfoGrid from '../components/InfoGrid'
import ItemsTable from '../components/ItemsTable'
import SignatureBlock from '../components/SignatureBlock'
import FinanceVerification from '../components/FinanceVerification'

export default function SettlementReportPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { currentProject } = useProject()
  const { data: settlement, isLoading: loading } = useSettlement(id)
  const documentNo = currentProject?.documentNo || ''
  const projectName = currentProject?.name || ''
  const [exporting, setExporting] = useState(false)

  const handleExportPdf = async () => {
    if (!settlement) return
    setExporting(true)
    const success = await exportSettlementPdf(settlement, documentNo, projectName)
    if (!success) alert('Popup blocked. Please allow popups for this site.')
    setExporting(false)
  }

  if (loading) return <Layout><Spinner /></Layout>
  if (!settlement || (currentProject && settlement.projectId !== currentProject.id)) {
    return <Layout><p className="text-gray-500">{t('detail.notFound')}</p></Layout>
  }

  const dateStr = formatFirestoreDate(settlement.createdAt)

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{t('settlement.reportTitle')}</h2>
            <p className="text-sm text-gray-500">{t('settlement.reportSubtitle')}</p>
          </div>
          <button onClick={handleExportPdf} disabled={exporting}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
            {exporting ? t('settlement.exporting') : t('settlement.exportPdf')}
          </button>
        </div>

        <InfoGrid className="mb-6" items={[
          { label: t('field.payee'), value: settlement.payee },
          { label: t('settlement.settlementDate'), value: dateStr },
          { label: t('field.phone'), value: settlement.phone },
          { label: t('field.session'), value: settlement.session },
          { label: t('field.bankAndAccount'), value: `${settlement.bankName} ${settlement.bankAccount}` },
          { label: t('committee.label'), value: t(`committee.${settlement.committee}`) },
        ]} />

        <div className="mb-2 text-sm text-gray-500">
          {t('settlement.requestCount')}: {settlement.requestIds.length}
        </div>

        <ItemsTable items={settlement.items} totalAmount={settlement.totalAmount} />

        {settlement.receipts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t('field.receipts')} ({settlement.receipts.length})
            </h3>
            <ul className="space-y-1">
              {settlement.receipts.map((r, i) => (
                <li key={i}>
                  <a href={r.url || r.driveUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline">{r.fileName}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <SignatureBlock
          payeeName={settlement.payee}
          requesterSignature={settlement.requestedBySignature}
          signatureData={settlement.approvalSignature}
          approverName={settlement.approvedBy?.name}
        />
        <FinanceVerification documentNo={documentNo} />

        <div className="mt-6">
          <Link to="/admin/settlements" className="text-sm text-purple-600 hover:underline">
            {t('settlement.backToList')}
          </Link>
        </div>
      </div>
    </Layout>
  )
}
