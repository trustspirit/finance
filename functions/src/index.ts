import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import * as nodemailer from 'nodemailer'

admin.initializeApp()

// --- Email notification secrets & config ---
const gmailUser = defineSecret('GMAIL_USER')
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD')

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser.value(),
      pass: gmailAppPassword.value(),
    },
  })
}

const STORAGE_BUCKET = 'finance-96f46.firebasestorage.app'
const bucket = admin.storage().bucket(STORAGE_BUCKET)

interface FileInput {
  name: string
  data: string
}

interface UploadResult {
  fileName: string
  storagePath: string
  url: string
}

async function uploadFileToStorage(file: FileInput, storagePath: string): Promise<UploadResult> {
  if (!file.data.includes(',')) {
    throw new Error('File data must be a base64 data URI')
  }
  const base64Data = file.data.split(',')[1]
  const buffer = Buffer.from(base64Data, 'base64')
  const mimeType = file.data.split(';')[0].split(':')[1]

  const fileRef = bucket.file(storagePath)
  await fileRef.save(buffer, {
    metadata: { contentType: mimeType },
  })

  await fileRef.makePublic()
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath.split('/').map(encodeURIComponent).join('/')}`

  return {
    fileName: file.name,
    storagePath,
    url,
  }
}

// 영수증 업로드
export const uploadReceiptsV2 = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  const { files, committee, projectId } = request.data as {
    files: FileInput[]
    committee: string
    projectId?: string
  }
  if (!files || files.length === 0) {
    throw new HttpsError('invalid-argument', 'No files provided')
  }

  const results: UploadResult[] = []
  for (const file of files) {
    const storagePath = `receipts/${projectId || 'default'}/${committee}/${Date.now()}_${file.name}`
    results.push(await uploadFileToStorage(file, storagePath))
  }
  return results
})

// 통장사본 업로드
export const uploadBankBookV2 = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  const { file } = request.data as { file: FileInput }
  if (!file) {
    throw new HttpsError('invalid-argument', 'No file provided')
  }

  // Delete old bank book file if exists
  const userDoc = await admin.firestore().doc(`users/${request.auth.uid}`).get()
  if (userDoc.exists) {
    const oldPath = userDoc.data()?.bankBookPath
    if (oldPath) {
      try {
        await bucket.file(oldPath).delete()
      } catch {
        // Ignore if file already deleted
      }
    }
  }

  const storagePath = `bankbook/${request.auth.uid}/${Date.now()}_${file.name}`
  return await uploadFileToStorage(file, storagePath)
})

// 파일 다운로드 프록시 (CORS 우회)
export const downloadFileV2 = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  const { storagePath } = request.data as { storagePath: string }
  if (!storagePath) {
    throw new HttpsError('invalid-argument', 'No storage path provided')
  }

  const fileRef = bucket.file(storagePath)
  const [exists] = await fileRef.exists()
  if (!exists) {
    throw new HttpsError('not-found', 'File not found')
  }

  const [buffer] = await fileRef.download()
  const [metadata] = await fileRef.getMetadata()

  return {
    data: buffer.toString('base64'),
    contentType: metadata.contentType || 'application/octet-stream',
    fileName: storagePath.split('/').pop() || 'file',
  }
})

// 30일 지난 삭제된 프로젝트 자동 정리 (매일 실행)
export const cleanupDeletedProjects = onSchedule('every 24 hours', async () => {
  const db = admin.firestore()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const snapshot = await db
    .collection('projects')
    .where('isActive', '==', false)
    .where('deletedAt', '<=', thirtyDaysAgo)
    .get()

  for (const projectDoc of snapshot.docs) {
    const projectId = projectDoc.id
    console.log(`Permanently deleting project: ${projectId}`)

    // Collect all storage paths to delete
    const storagePaths: string[] = []

    // Delete requests + collect receipt paths
    const requests = await db.collection('requests').where('projectId', '==', projectId).get()
    for (const reqDoc of requests.docs) {
      for (const receipt of reqDoc.data().receipts || []) {
        if (receipt.storagePath) storagePaths.push(receipt.storagePath)
      }
    }
    for (let i = 0; i < requests.docs.length; i += 500) {
      const batch = db.batch()
      requests.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    // Delete settlements + collect receipt paths
    const settlements = await db.collection('settlements').where('projectId', '==', projectId).get()
    for (const setDoc of settlements.docs) {
      for (const receipt of setDoc.data().receipts || []) {
        if (receipt.storagePath) storagePaths.push(receipt.storagePath)
      }
    }
    for (let i = 0; i < settlements.docs.length; i += 500) {
      const batch = db.batch()
      settlements.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    // Delete all collected storage files
    await Promise.all(storagePaths.map(p =>
      bucket.file(p).delete().catch(() => { /* ignore missing */ })
    ))

    // Delete entire receipts folder for this project (catch any orphaned files)
    const [orphanedFiles] = await bucket.getFiles({ prefix: `receipts/${projectId}/` })
    await Promise.all(orphanedFiles.map(f =>
      f.delete().catch(() => { /* ignore */ })
    ))

    // Delete the project document
    await projectDoc.ref.delete()
    console.log(`Deleted project ${projectId}: ${requests.size} requests, ${settlements.size} settlements, ${storagePaths.length + orphanedFiles.length} files`)
  }
})

// --- Email Notification Functions ---

const COMMITTEE_LABELS: Record<string, string> = {
  operations: '작전위원회',
  preparation: '준비위원회',
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

function formatDate(date: Date | admin.firestore.Timestamp | null): string {
  if (!date) return '-'
  const d = date instanceof Date ? date : date.toDate()
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function buildStatusChangeEmail(data: Record<string, unknown>, newStatus: 'approved' | 'rejected'): { subject: string; html: string } {
  const totalAmount = data.totalAmount as number
  const approvedBy = data.approvedBy as { name: string } | null
  const rejectionReason = data.rejectionReason as string | null
  const approvedAt = data.approvedAt as admin.firestore.Timestamp | null

  if (newStatus === 'approved') {
    return {
      subject: '[지불/환불] 신청서가 승인되었습니다',
      html: `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #16a34a; margin-bottom: 16px;">신청서가 승인되었습니다</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; color: #6b7280;">신청 금액</td><td style="padding: 8px 0; font-weight: 600;">${formatCurrency(totalAmount)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">승인자</td><td style="padding: 8px 0;">${approvedBy?.name || '-'}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">승인 일시</td><td style="padding: 8px 0;">${formatDate(approvedAt)}</td></tr>
          </table>
          <p style="color: #6b7280; font-size: 14px;">앱에서 상세 내역을 확인하세요.</p>
        </div>
      `,
    }
  }

  return {
    subject: '[지불/환불] 신청서가 반려되었습니다',
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #dc2626; margin-bottom: 16px;">신청서가 반려되었습니다</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0; color: #6b7280;">신청 금액</td><td style="padding: 8px 0; font-weight: 600;">${formatCurrency(totalAmount)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">반려 사유</td><td style="padding: 8px 0; color: #dc2626;">${rejectionReason || '-'}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 14px;">반려 사유를 확인하시고 필요시 재신청해 주세요.</p>
      </div>
    `,
  }
}

function buildWeeklyDigestEmail(userName: string, pendingCount: number, committee?: string): { subject: string; html: string } {
  const committeeText = committee ? ` (${COMMITTEE_LABELS[committee] || committee})` : ''
  return {
    subject: `[지불/환불] 승인 대기중인 신청서 ${pendingCount}건`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2563eb; margin-bottom: 16px;">승인 대기중인 신청서${committeeText}</h2>
        <p style="margin-bottom: 16px;">${userName}님, 현재 <strong>${pendingCount}건</strong>의 신청서가 승인을 기다리고 있습니다.</p>
        <p style="color: #6b7280; font-size: 14px;">앱에 접속하여 대기중인 신청서를 확인해 주세요.</p>
      </div>
    `,
  }
}

// 신청서 상태 변경 시 이메일 알림
export const onRequestStatusChange = onDocumentUpdated(
  {
    document: 'requests/{requestId}',
    secrets: [gmailUser, gmailAppPassword],
  },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return

    const oldStatus = before.status as string
    const newStatus = after.status as string

    // Only notify on pending → approved or pending → rejected
    if (oldStatus !== 'pending') return
    if (newStatus !== 'approved' && newStatus !== 'rejected') return

    const requestedBy = after.requestedBy as { email: string; name: string } | undefined
    if (!requestedBy?.email) {
      console.warn('No requestedBy email found, skipping notification')
      return
    }

    const { subject, html } = buildStatusChangeEmail(after, newStatus as 'approved' | 'rejected')

    try {
      const transporter = createTransporter()
      await transporter.sendMail({
        from: `지불/환불 시스템 <${gmailUser.value()}>`,
        to: requestedBy.email,
        subject,
        html,
      })
      console.log(`Status change email sent to ${requestedBy.email} (${newStatus})`)
    } catch (error) {
      console.error('Failed to send status change email:', error)
    }
  }
)

// 매주 일요일 09:00 KST 승인 대기 알림
export const weeklyApproverDigest = onSchedule(
  {
    schedule: 'every sunday 00:00',
    timeZone: 'UTC',
    secrets: [gmailUser, gmailAppPassword],
  },
  async () => {
    const db = admin.firestore()

    // 승인 역할이 있는 활성 사용자 조회
    const approverRoles = ['approver_ops', 'approver_prep', 'finance', 'director', 'admin']
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', approverRoles)
      .get()

    if (usersSnapshot.empty) {
      console.log('No approver users found')
      return
    }

    // 활성 프로젝트의 대기중 신청서 조회
    const pendingSnapshot = await db.collection('requests')
      .where('status', '==', 'pending')
      .get()

    if (pendingSnapshot.empty) {
      console.log('No pending requests found')
      return
    }

    // 위원회별 대기 건수 집계
    let opsCount = 0
    let prepCount = 0
    for (const doc of pendingSnapshot.docs) {
      const committee = doc.data().committee as string
      if (committee === 'operations') opsCount++
      else if (committee === 'preparation') prepCount++
    }
    const totalCount = pendingSnapshot.size

    const transporter = createTransporter()

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data()
      const role = user.role as string
      const email = user.email as string
      const name = (user.name || user.displayName || '') as string

      if (!email) continue

      // 역할별 조회 로직
      let count = 0
      let committee: string | undefined

      if (role === 'approver_ops') {
        count = opsCount
        committee = 'operations'
      } else if (role === 'approver_prep') {
        count = prepCount
        committee = 'preparation'
      } else {
        // finance, director, admin → 전체
        count = totalCount
      }

      if (count === 0) continue

      const { subject, html } = buildWeeklyDigestEmail(name, count, committee)

      try {
        await transporter.sendMail({
          from: `지불/환불 시스템 <${gmailUser.value()}>`,
          to: email,
          subject,
          html,
        })
        console.log(`Weekly digest sent to ${email}: ${count} pending`)
      } catch (error) {
        console.error(`Failed to send weekly digest to ${email}:`, error)
      }
    }
  }
)
