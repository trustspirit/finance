import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatFirestoreDate } from '../lib/utils'
import { Settlement } from '../types'
import { BUDGET_CODE_LABELS } from '../constants/budgetCodes'
import { COMMITTEE_LABELS } from '../constants/labels'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import InfoGrid from '../components/InfoGrid'

export default function SettlementReportPage() {
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
  <title>정산 리포트 - ${settlement.payee}</title>
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
  <h1>지불 / 환불 정산 리포트</h1>
  <p class="subtitle">Payment / Reimbursement Settlement Report</p>

  <div class="info-grid">
    <div><span class="label">신청자:</span> ${escapeHtml(settlement.payee)}</div>
    <div><span class="label">정산일:</span> ${escapeHtml(dateStr)}</div>
    <div><span class="label">전화번호:</span> ${escapeHtml(settlement.phone)}</div>
    <div><span class="label">세션:</span> ${escapeHtml(settlement.session)}</div>
    <div><span class="label">은행:</span> ${escapeHtml(settlement.bankName)} ${escapeHtml(settlement.bankAccount)}</div>
    <div><span class="label">위원회:</span> ${COMMITTEE_LABELS[settlement.committee]}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>설명</th>
        <th>예산 코드</th>
        <th class="text-right">금액</th>
      </tr>
    </thead>
    <tbody>
      ${settlement.items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${item.budgetCode} (${BUDGET_CODE_LABELS[item.budgetCode] || ''})</td>
          <td class="text-right">₩${item.amount.toLocaleString()}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3" class="text-right">합계</td>
        <td class="text-right">₩${settlement.totalAmount.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <p style="font-size:11px; color:#666;">통합 신청 건수: ${settlement.requestIds.length}건 | 영수증: ${settlement.receipts.length}개</p>

  ${settlement.approvalSignature ? `
  <div class="signature-section">
    <div class="signature-box">
      <img src="${settlement.approvalSignature}" alt="승인 서명" />
      <div class="signature-label">승인자 서명</div>
    </div>
  </div>
  ` : ''}

  ${images.length > 0 ? `
  <div class="receipt-page">
    <h2>첨부 영수증</h2>
    ${images.map((img) => img.dataUrl
      ? `<div><p class="receipt-name">${escapeHtml(img.fileName)}</p><img class="receipt-img" src="${img.dataUrl}" /></div>`
      : `<div><p class="receipt-name">${escapeHtml(img.fileName)}</p><p class="receipt-link">이미지를 불러올 수 없습니다. Google Drive에서 직접 확인해주세요.</p></div>`
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
      alert('팝업이 차단되었습니다. 팝업을 허용해주세요.')
      setExporting(false)
    }
  }

  if (loading) return <Layout><Spinner /></Layout>
  if (!settlement) return <Layout><p className="text-gray-500">정산 리포트를 찾을 수 없습니다.</p></Layout>

  const dateStr = formatFirestoreDate(settlement.createdAt)

  return (
    <Layout>
      <div ref={reportRef} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">지불 / 환불 정산 리포트</h2>
            <p className="text-sm text-gray-500">Payment / Reimbursement Settlement Report</p>
          </div>
          <button onClick={handleExportPdf} disabled={exporting}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400">
            {exporting ? '준비 중...' : 'PDF 내보내기'}
          </button>
        </div>

        <InfoGrid className="mb-6" items={[
          { label: '신청자', value: settlement.payee },
          { label: '정산일', value: dateStr },
          { label: '전화번호', value: settlement.phone },
          { label: '세션', value: settlement.session },
          { label: '은행 / 계좌', value: `${settlement.bankName} ${settlement.bankAccount}` },
          { label: '위원회', value: COMMITTEE_LABELS[settlement.committee] },
        ]} />

        <div className="mb-2 text-sm text-gray-500">
          통합 신청 건수: {settlement.requestIds.length}건
        </div>

        <table className="w-full text-sm mb-6">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">설명</th>
              <th className="text-left px-3 py-2">예산 코드</th>
              <th className="text-right px-3 py-2">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settlement.items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2">
                  {item.budgetCode}
                  <span className="ml-1 text-gray-400 text-xs">{BUDGET_CODE_LABELS[item.budgetCode]}</span>
                </td>
                <td className="px-3 py-2 text-right">₩{item.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right">합계</td>
              <td className="px-3 py-2 text-right">₩{settlement.totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        {settlement.receipts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">영수증 ({settlement.receipts.length}개)</h3>
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

        {settlement.approvalSignature && (
          <div className="mb-6 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">승인 서명</h3>
            <div className="border border-gray-200 rounded p-2 bg-gray-50 inline-block">
              <img src={settlement.approvalSignature} alt="승인 서명" className="max-h-20" />
            </div>
          </div>
        )}

        <div className="mt-6">
          <Link to="/admin/settlements" className="text-sm text-purple-600 hover:underline">← 정산 내역으로</Link>
        </div>
      </div>
    </Layout>
  )
}
