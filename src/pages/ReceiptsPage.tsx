import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import { useProject } from '../contexts/ProjectContext'
import { useInfiniteRequests } from '../hooks/queries/useRequests'
import { Committee, Receipt } from '../types'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel'
import JSZip from 'jszip'

interface ReceiptRow {
  receipt: Receipt
  requestDate: string
  payee: string
  committee: Committee
  requestId: string
}

function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith('.pdf')
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center bg-gray-50 text-gray-400 ${className}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span className="text-[9px] font-medium">PDF</span>
    </div>
  )
}

export default function ReceiptsPage() {
  const { t } = useTranslation()
  const { currentProject } = useProject()
  const {
    data,
    isLoading: loading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteRequests(currentProject?.id)
  const [committeeFilter, setCommitteeFilter] = useState<Committee | 'all'>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const requests = data?.pages.flatMap(p => p.items) ?? []

  const rows: ReceiptRow[] = useMemo(() => {
    const result: ReceiptRow[] = []
    for (const req of requests.filter((r) => r.status !== 'cancelled')) {
      for (const receipt of req.receipts) {
        result.push({
          receipt,
          requestDate: req.date,
          payee: req.payee,
          committee: req.committee,
          requestId: req.id,
        })
      }
    }
    return result
  }, [requests])

  const filtered = committeeFilter === 'all'
    ? rows
    : rows.filter((r) => r.committee === committeeFilter)

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((_, i) => i)))
    }
  }

  const toggleOne = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // Reset selection when filter changes
  const handleFilterChange = (f: Committee | 'all') => {
    setCommitteeFilter(f)
    setSelected(new Set())
  }

  const downloadFn = httpsCallable<
    { storagePath: string },
    { data: string; contentType: string; fileName: string }
  >(functions, 'downloadFile')

  const downloadOneFile = async (row: ReceiptRow): Promise<{ bytes: Uint8Array; ext: string } | null> => {
    try {
      if (row.receipt.storagePath) {
        const result = await downloadFn({ storagePath: row.receipt.storagePath })
        const binary = atob(result.data.data)
        const bytes = new Uint8Array(binary.length)
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
        return { bytes, ext: row.receipt.fileName.split('.').pop() || 'jpg' }
      } else {
        const url = row.receipt.url || row.receipt.driveUrl
        if (!url) return null
        const response = await fetch(url, { mode: 'cors' })
        if (!response.ok) return null
        const blob = await response.blob()
        if (blob.size === 0) return null
        const reader = new FileReader()
        const bytes = await new Promise<Uint8Array>((resolve) => {
          reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
          reader.readAsArrayBuffer(blob)
        })
        return { bytes, ext: row.receipt.fileName.split('.').pop() || 'jpg' }
      }
    } catch (err) {
      console.warn('Download error:', row.receipt.fileName, err)
      return null
    }
  }

  const handleDownload = async () => {
    if (selected.size === 0) return
    setDownloading(true)

    try {
      const selectedRows = filtered.filter((_, i) => selected.has(i))

      // Single file: download directly
      if (selectedRows.length === 1) {
        const row = selectedRows[0]
        const file = await downloadOneFile(row)
        if (!file) { alert(t('receipts.downloadFailed')); return }
        const blob = new Blob([file.bytes as unknown as BlobPart])
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${row.requestDate}_${row.payee}.${file.ext}`
        link.click()
        URL.revokeObjectURL(link.href)
        return
      }

      // Multiple files: ZIP
      const zip = new JSZip()
      let failCount = 0
      await Promise.all(
        selectedRows.map(async (row, i) => {
          const file = await downloadOneFile(row)
          if (!file) { failCount++; return }
          const name = `${row.requestDate}_${row.payee}_${i + 1}.${file.ext}`
          zip.file(name, file.bytes)
        })
      )

      if (failCount > 0) {
        alert(t('receipts.partialDownload', { failed: failCount, total: selectedRows.length }))
      }
      if (Object.keys(zip.files).length === 0) return

      const content = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      const label = committeeFilter === 'all' ? 'all' : t(`committee.${committeeFilter}Short`)
      link.download = `receipts_${label}_${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      console.error('Download failed:', err)
      alert(t('receipts.downloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Layout>
      <PageHeader title={t('receipts.title')} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['all', 'operations', 'preparation'] as const).map((f) => (
          <button key={f} onClick={() => handleFilterChange(f)}
            className={`px-3 py-1 rounded text-sm ${committeeFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {f === 'all' ? t('status.all') : t(`committee.${f}Short`)}
          </button>
        ))}

        {someSelected && (
          <button onClick={handleDownload} disabled={downloading}
            className="ml-auto px-4 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading
              ? t('receipts.downloading')
              : selected.size === 1
                ? t('receipts.download')
                : t('receipts.downloadZip', { count: selected.size })}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        {t('receipts.totalCount', { count: filtered.length })}
      </p>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('receipts.noReceipts')} />
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-lg shadow">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="rounded border-gray-300" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.receipts')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.payee')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.date')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('field.committee')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((row, i) => {
                    const imgUrl = row.receipt.url || row.receipt.driveUrl
                    return (
                      <tr key={`${row.requestId}-${i}`}
                        className={`hover:bg-gray-50 ${selected.has(i) ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(i)} onChange={() => toggleOne(i)}
                            className="rounded border-gray-300" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {imgUrl && (
                              <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                                {isPdf(row.receipt.fileName) ? (
                                  <object data={imgUrl} type="application/pdf"
                                    className="w-10 h-10 rounded border border-gray-200 bg-white pointer-events-none">
                                    <PdfIcon className="w-10 h-10 rounded border border-gray-200" />
                                  </object>
                                ) : (
                                  <img src={imgUrl} alt={row.receipt.fileName}
                                    className="w-10 h-10 object-cover rounded border border-gray-200 bg-gray-50" />
                                )}
                              </a>
                            )}
                            <a href={imgUrl} target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate max-w-[200px]">
                              {row.receipt.fileName}
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.payee}</td>
                        <td className="px-4 py-3 text-gray-500">{row.requestDate}</td>
                        <td className="px-4 py-3 text-gray-500">{t(`committee.${row.committee}Short`)}</td>
                        <td className="px-4 py-3 text-center">
                          <Link to={`/request/${row.requestId}`}
                            className="text-xs text-blue-600 hover:underline">{t('receipts.viewRequest')}</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {filtered.map((row, i) => {
              const imgUrl = row.receipt.url || row.receipt.driveUrl
              return (
                <div key={`${row.requestId}-${i}`}
                  className={`bg-white rounded-lg shadow p-3 flex items-center gap-3 ${selected.has(i) ? 'ring-2 ring-blue-400' : ''}`}
                  onClick={() => toggleOne(i)}>
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleOne(i)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 shrink-0" />
                  {imgUrl && (
                    isPdf(row.receipt.fileName) ? (
                      <object data={imgUrl} type="application/pdf"
                        className="w-12 h-12 rounded border border-gray-200 bg-white pointer-events-none shrink-0">
                        <PdfIcon className="w-12 h-12 rounded border border-gray-200 shrink-0" />
                      </object>
                    ) : (
                      <img src={imgUrl} alt={row.receipt.fileName}
                        className="w-12 h-12 object-cover rounded border border-gray-200 bg-gray-50 shrink-0" />
                    )
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{row.receipt.fileName}</p>
                    <p className="text-xs text-gray-500">{row.payee} &middot; {row.requestDate}</p>
                    <p className="text-xs text-gray-400">
                      {t(`committee.${row.committee}Short`)}
                      {' · '}
                      <Link to={`/request/${row.requestId}`} onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:underline">{t('receipts.viewRequest')}</Link>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <InfiniteScrollSentinel
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </>
      )}
    </Layout>
  )
}
