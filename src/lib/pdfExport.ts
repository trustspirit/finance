import { Settlement, Receipt } from '../types'
import i18n from './i18n'
import { formatFirestoreDate } from './utils'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts)

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function preloadImages(receipts: Receipt[]) {
  return Promise.all(
    receipts.map((r) =>
      new Promise<{ fileName: string; dataUrl: string | null }>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            canvas.getContext('2d')?.drawImage(img, 0, 0)
            resolve({ fileName: r.fileName, dataUrl: canvas.toDataURL('image/png') })
          } catch {
            resolve({ fileName: r.fileName, dataUrl: null })
          }
        }
        img.onerror = () => resolve({ fileName: r.fileName, dataUrl: null })
        img.src = r.url || `https://drive.google.com/uc?export=view&id=${r.driveFileId}`
      })
    )
  )
}

function buildPdfStyles() {
  return `
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
    .receipt-page { page-break-before: always; }
    .receipt-page h2 { font-size: 14px; margin-bottom: 12px; }
    .receipt-img { max-width: 100%; max-height: 700px; margin-bottom: 16px; }
    .receipt-name { font-size: 10px; color: #666; margin-bottom: 8px; }
    .receipt-link { font-size: 10px; color: #666; word-break: break-all; }
    @media print { body { padding: 10mm; } }
  `
}

export async function exportSettlementPdf(settlement: Settlement, documentNo = '', projectName = '') {
  const images = await preloadImages(settlement.receipts)
  const dateStr = formatFirestoreDate(settlement.createdAt) || new Date().toLocaleDateString('ko-KR')

  const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${t('settlement.reportTitle')} - ${escapeHtml(settlement.payee)}</title>
  <style>${buildPdfStyles()}</style>
</head><body>
  <h1>${t('settlement.reportTitle')}</h1>
  ${projectName ? `<p class="subtitle" style="font-weight:600;">${escapeHtml(projectName)}</p>` : ''}
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
    <thead><tr>
      <th>#</th><th>${t('field.comments')}</th><th>Budget Code</th><th class="text-right">${t('field.totalAmount')}</th>
    </tr></thead>
    <tbody>
      ${settlement.items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${item.budgetCode} (${t(`budgetCode.${item.budgetCode}`)})</td>
          <td class="text-right">₩${item.amount.toLocaleString()}</td>
        </tr>`).join('')}
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
      ${settlement.requestedBySignature ? `<img src="${settlement.requestedBySignature}" alt="requester signature" style="max-height:50px;" />` : ''}
      <div style="border-top:1px solid #ccc; width:200px; margin-top:4px; padding-top:2px; font-size:10px;">${escapeHtml(settlement.payee)}</div>
    </div>
    <div style="flex:1; text-align:center;">
      <p style="font-size:10px; color:#666; margin-bottom:4px;">Approved by (signature of budget approver)</p>
      ${settlement.approvalSignature ? `<img src="${settlement.approvalSignature}" alt="signature" style="max-height:50px;" />` : ''}
      <div style="border-top:1px solid #ccc; width:200px; margin:4px auto 0; padding-top:2px; font-size:10px;">${settlement.approvedBy ? escapeHtml(settlement.approvedBy.name) : '&nbsp;'}</div>
    </div>
  </div>

  <div style="margin-top:30px; border:1px solid #ddd; padding:12px; font-size:11px;">
    <p style="font-weight:600; margin-bottom:8px;">Area Office Finance Verification</p>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
      <div><p style="color:#666; font-size:10px;">Document No.</p><p style="font-weight:600;">${escapeHtml(documentNo) || '-'}</p></div>
      <div><p style="color:#666; font-size:10px;">Signature</p><div style="border-bottom:1px solid #ccc; height:30px;"></div></div>
      <div><p style="color:#666; font-size:10px;">Date approved</p><div style="border-bottom:1px solid #ccc; height:20px;"></div></div>
    </div>
    <div style="margin-top:8px;"><p style="color:#666; font-size:10px;">Additional Information / Comments</p><div style="border-bottom:1px solid #ccc; height:30px;"></div></div>
  </div>

  ${images.length > 0 ? `
  <div class="receipt-page">
    <h2>${t('field.receipts')}</h2>
    ${images.map((img) => img.dataUrl
      ? `<div><p class="receipt-name">${escapeHtml(img.fileName)}</p><img class="receipt-img" src="${img.dataUrl}" /></div>`
      : `<div><p class="receipt-name">${escapeHtml(img.fileName)}</p><p class="receipt-link">Failed to load image.</p></div>`
    ).join('')}
  </div>` : ''}
</body></html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 1500)
    return true
  }
  return false
}
