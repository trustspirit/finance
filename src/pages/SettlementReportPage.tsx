import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useTranslation } from 'react-i18next'
import { formatFirestoreDate } from '../lib/utils'
import { Settlement } from '../types'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import InfoGrid from '../components/InfoGrid'

export default function SettlementReportPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, 'settlements', id))
        if (snap.exists()) {
          setSettlement({ id: snap.id, ...snap.data() } as Settlement)
        }
      } catch (error) {
        console.error('Failed to fetch settlement:', error)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const handleExportPdf = async () => {
    if (!settlement) return
    setExporting(true)

    // Preload receipt images
    const imagePromises = settlement.receipts.map((r) => {
      return new Promise<{ fileName: string; dataUrl: string | null }>((resolve) => {
        const directUrl = `https://drive.google.com/uc?export=view&id=${r.driveFileId}`
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            const ctx = canvas.getContext('2d')
            ctx?.drawImage(img, 0, 0)
            resolve({ fileName: r.fileName, dataUrl: canvas.toDataURL('image/png') })
          } catch {
            resolve({ fileName: r.fileName, dataUrl: null })
          }
        }
        img.onerror = () => resolve({ fileName: r.fileName, dataUrl: null })
        img.src = directUrl
      })
    })

    const images = await Promise.all(imagePromises)

    const dateStr = formatFirestoreDate(settlement.createdAt) || new Date().toLocaleDateString('ko-KR')

    // Build print HTML
    const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${t('settlement.reportTitle')} - ${settlement.payee}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif; font-size: 12px; color: #333; padding: 20mm; }
    h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; font-size: 11px; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 20px; font-size: 12px; }
    .info-grid .label { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .text-right { text-align: right; }
    .total-row { font-weight: 700; background: #f9f9f9; }
    .signature-section { margin-top: 30px; display: flex; justify-content: space-between; }
    .signature-box { text-align: center; }
    .signature-box img { max-height: 60px; }
    .signature-label { font-size: 10px; color: #666; margin-top: 4px; }
    .receipt-page { page-break-before: always; }
    .receipt-page h2 { font-size: 14px; margin-bottom: 12px; }
    .receipt-img { max-width: 100%; max-height: 700px; margin-bottom: 16px; }
    .receipt-name { font-size: 10px; color: #666; margin-bottom: 8px; }
    .receipt-link { font-size: 10px; color: #666; word-break: break-all; }
    @media print { body { padding: 10mm; } }
  </style>
</head>
<body>
  <h1>${t('settlement.reportTitle')}</h1>
  <p class="subtitle">${t('settlement.reportSubtitle')}</p>

  <div class="info-grid">
    <div><span class="label">${t('field.payee')}:</span> ${escapeHtml(settlement.payee)}</div>
    <div><span class="label">${t('settlement.settlementDate')}:</span> ${escapeHtml(dateStr)}</div>
    <div><span class="label">${t('field.phone')}:</span> ${escapeHtml(settlement.phone)}</div>
    <div><span class="label">${t('field.session')}:</span> ${escapeHtml(settlement.session)}</div>
    <div><span class="label">${t('field.bankAndAccount')}:</span> ${escapeHtml(settlement.bankName)} ${escapeHtml(settlement.bankAccount)}</div>
    <div><span class="label">${t('committee.label')}:</span> ${t(`committee.${settlement.committee}`)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${t('field.comments')}</th>
        <th>Budget Code</th>
        <th class="text-right">${t('field.totalAmount')}</th>
      </tr>
    </thead>
    <tbody>
      ${settlement.items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${item.budgetCode} (${t(`budgetCode.${item.budgetCode}`)})</td>
          <td class="text-right">₩${item.amount.toLocaleString()}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3" class="text-right">${t('field.totalAmount')}</td>
        <td class="text-right">₩${settlement.totalAmount.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <p style="font-size:11px; color:#666;">${t('settlement.requestCount')}: ${settlement.requestIds.length} | ${t('field.receipts')}: ${settlement.receipts.length}</p>

  <div style="margin-top:30px; display:flex; justify-content:space-between; align-items:flex-end;">
    <div style="flex:1;">
      <p style="font-size:10px; color:#666; margin-bottom:4px;">Requested by</p>
      ${settlement.approvalSignature ? `<img src="${settlement.approvalSignature}" alt="${t('approval.approvalSignature')}" style="max-height:50px;" />` : ''}
      <div style="border-top:1px solid #ccc; width:200px; margin-top:4px; padding-top:2px; font-size:10px;">${escapeHtml(settlement.payee)}</div>
    </div>
    <div style="flex:1; text-align:center;">
      <p style="font-size:10px; color:#666; margin-bottom:4px;">Approved by (signature of budget approver)</p>
      <div style="border-top:1px solid #ccc; width:200px; margin:4px auto 0; padding-top:2px; font-size:10px;">&nbsp;</div>
    </div>
  </div>

  <div style="margin-top:30px; border:1px solid #ddd; padding:12px; font-size:11px;">
    <p style="font-weight:600; margin-bottom:8px;">Area Office Finance Verification</p>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
      <div>
        <p style="color:#666; font-size:10px;">Document No.</p>
        <p style="font-weight:600;">KOR01-6762808-5xxx-KYSA2025KOR</p>
      </div>
      <div>
        <p style="color:#666; font-size:10px;">Due Date</p>
        <div style="border-bottom:1px solid #ccc; height:20px;"></div>
      </div>
      <div>
        <p style="color:#666; font-size:10px;">Signature</p>
        <div style="border-bottom:1px solid #ccc; height:30px;"></div>
      </div>
      <div>
        <p style="color:#666; font-size:10px;">Date approved</p>
        <div style="border-bottom:1px solid #ccc; height:20px;"></div>
      </div>
    </div>
    <div style="margin-top:8px;">
      <p style="color:#666; font-size:10px;">Additional Information / Comments</p>
      <div style="border-bottom:1px solid #ccc; height:30px;"></div>
    </div>
  </div>

  ${images.length > 0 ? `
  <div class="receipt-page">
    <h2>${t('field.receipts')}</h2>
    ${images.map((img) => img.dataUrl
      ? `<div><p class="receipt-name">${escapeHtml(img.fileName)}</p><img class="receipt-img" src="${img.dataUrl}" /></div>`
      : `<div><p class="receipt-name">${escapeHtml(img.fileName)}</p><p class="receipt-link">Failed to load image. Please check directly on Google Drive.</p></div>`
    ).join('')}
  </div>
  ` : ''}
</body>
</html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printHtml)
      printWindow.document.close()
      // Wait for images to load
      setTimeout(() => {
        printWindow.print()
        setExporting(false)
      }, 1500)
    } else {
      alert('Popup blocked. Please allow popups for this site.')
      setExporting(false)
    }
  }

  if (loading) return <Layout><Spinner /></Layout>
  if (!settlement) return <Layout><p className="text-gray-500">{t('detail.notFound')}</p></Layout>

  const dateStr = formatFirestoreDate(settlement.createdAt)

  return (
    <Layout>
      <div ref={reportRef} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
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

        <table className="w-full text-sm mb-6">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">{t('field.comments')}</th>
              <th className="text-left px-3 py-2">Budget Code</th>
              <th className="text-right px-3 py-2">{t('field.totalAmount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settlement.items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2">
                  {item.budgetCode}
                  <span className="ml-1 text-gray-400 text-xs">{t(`budgetCode.${item.budgetCode}`)}</span>
                </td>
                <td className="px-3 py-2 text-right">₩{item.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right">{t('field.totalAmount')}</td>
              <td className="px-3 py-2 text-right">₩{settlement.totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        {settlement.receipts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">{t('field.receipts')} ({settlement.receipts.length})</h3>
            <ul className="space-y-1">
              {settlement.receipts.map((r, i) => (
                <li key={i}>
                  <a href={r.driveUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline">{r.fileName}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Signatures */}
        <div className="mb-6 pt-4 border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Requested by</p>
              {settlement.approvalSignature && (
                <img src={settlement.approvalSignature} alt={t('approval.approvalSignature')} className="max-h-16 mb-1" />
              )}
              <div className="border-t border-gray-300 pt-1 text-sm">{settlement.payee}</div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Approved by (budget approver)</p>
              <div className="border-t border-gray-300 pt-1 text-sm h-16">&nbsp;</div>
            </div>
          </div>
        </div>

        {/* Area Office Finance Verification */}
        <div className="mb-6 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Area Office Finance Verification</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Document No.</p>
              <p className="font-mono font-medium">KOR01-6762808-5xxx-KYSA2025KOR</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Due Date</p>
              <div className="border-b border-gray-300 h-6"></div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Signature</p>
              <div className="border-b border-gray-300 h-8"></div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Date approved</p>
              <div className="border-b border-gray-300 h-6"></div>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-gray-500">Additional Information / Comments</p>
            <div className="border-b border-gray-300 h-8"></div>
          </div>
        </div>

        <div className="mt-6">
          <Link to="/admin/settlements" className="text-sm text-purple-600 hover:underline">{t('settlement.backToList')}</Link>
        </div>
      </div>
    </Layout>
  )
}
