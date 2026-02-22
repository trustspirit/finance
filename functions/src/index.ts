import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore'
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

const APP_URL = 'https://finance-96f46.web.app'
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

// 사용자 삭제 (Firestore 문서 + Firebase Auth 계정)
export const deleteUserAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  // 호출자가 admin 또는 super_admin인지 확인
  const callerDoc = await admin.firestore().doc(`users/${request.auth.uid}`).get()
  const callerRole = callerDoc.exists ? callerDoc.data()?.role : null
  if (callerRole !== 'admin' && callerRole !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Only admin can delete users')
  }

  const { uid } = request.data as { uid: string }
  if (!uid) {
    throw new HttpsError('invalid-argument', 'User UID is required')
  }

  // super_admin은 삭제 불가
  const targetDoc = await admin.firestore().doc(`users/${uid}`).get()
  if (targetDoc.exists && targetDoc.data()?.role === 'super_admin') {
    throw new HttpsError('permission-denied', 'Cannot delete super_admin')
  }

  // 본인 삭제 불가
  if (uid === request.auth.uid) {
    throw new HttpsError('permission-denied', 'Cannot delete yourself')
  }

  // Firestore 문서 삭제
  await admin.firestore().doc(`users/${uid}`).delete()

  // Firebase Auth 계정 삭제
  try {
    await admin.auth().deleteUser(uid)
  } catch (error) {
    console.warn(`Auth account deletion failed for ${uid}:`, error)
  }

  // 프로젝트 memberUids에서 제거
  const projectsSnap = await admin.firestore().collection('projects')
    .where('memberUids', 'array-contains', uid).get()
  for (const projectDoc of projectsSnap.docs) {
    const memberUids = (projectDoc.data().memberUids || []).filter((id: string) => id !== uid)
    await projectDoc.ref.update({ memberUids })
  }

  console.log(`User ${uid} deleted by ${request.auth.uid}`)
  return { success: true }
})

// --- Email Notification Functions ---

const COMMITTEE_LABELS: Record<string, string> = {
  operations: '운영위원회',
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

// 신청서 생성 시 → 해당 위원회 재정 담당자에게 검토 요청 알림
export const onRequestCreated = onDocumentCreated(
  {
    document: 'requests/{requestId}',
    secrets: [gmailUser, gmailAppPassword],
  },
  async (event) => {
    const data = event.data?.data()
    if (!data) return

    const committee = data.committee as string
    const totalAmount = data.totalAmount as number
    const requestedBy = data.requestedBy as { name: string; email: string }
    const payee = data.payee as string

    // Find finance reviewers for this committee
    const db = admin.firestore()
    const reviewerRoles = committee === 'operations'
      ? ['finance_ops', 'finance_prep']
      : ['finance_prep']

    const usersSnapshot = await db.collection('users')
      .where('role', 'in', reviewerRoles)
      .get()

    if (usersSnapshot.empty) {
      console.log('No finance reviewers found for committee:', committee)
      return
    }

    const transporter = createTransporter()
    const committeeLabel = COMMITTEE_LABELS[committee] || committee

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data()
      const email = user.email as string
      if (!email) continue

      try {
        await transporter.sendMail({
          from: `지불/환불 시스템 <${gmailUser.value()}>`,
          to: email,
          subject: `[지불/환불] 새 신청서 검토 요청 (${committeeLabel})`,
          html: `
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #2563eb; margin-bottom: 16px;">새 신청서가 접수되었습니다</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 0; color: #6b7280;">위원회</td><td style="padding: 8px 0;">${committeeLabel}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">신청자</td><td style="padding: 8px 0;">${payee} (${requestedBy.name})</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">신청 금액</td><td style="padding: 8px 0; font-weight: 600;">${formatCurrency(totalAmount)}</td></tr>
              </table>
              <p style="margin-top: 20px;"><a href="${APP_URL}/admin/requests" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">신청서 검토하기</a></p>
            </div>
          `,
        })
        console.log(`New request notification sent to ${email}`)
      } catch (error) {
        console.error(`Failed to send new request notification to ${email}:`, error)
      }
    }
  }
)

function buildStatusChangeEmail(data: Record<string, unknown>, newStatus: string, requestId?: string): { subject: string; html: string } {
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
          <p style="margin-top: 20px;"><a href="${APP_URL}/request/${requestId || ''}" style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">상세 내역 확인하기</a></p>
        </div>
      `,
    }
  }

  if (newStatus === 'rejected') {
    return {
      subject: '[지불/환불] 신청서가 반려되었습니다',
      html: `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #dc2626; margin-bottom: 16px;">신청서가 반려되었습니다</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; color: #6b7280;">신청 금액</td><td style="padding: 8px 0; font-weight: 600;">${formatCurrency(totalAmount)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">반려 사유</td><td style="padding: 8px 0; color: #dc2626;">${rejectionReason || '-'}</td></tr>
          </table>
          <p style="margin-top: 20px;"><a href="${APP_URL}/request/${requestId || ''}" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">상세 내역 확인하기</a></p>
        </div>
      `,
    }
  }

  // force_rejected
  return {
    subject: '[지불/환불] 승인된 신청서가 반려되었습니다',
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #ea580c; margin-bottom: 16px;">승인된 신청서가 반려되었습니다</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0; color: #6b7280;">신청 금액</td><td style="padding: 8px 0; font-weight: 600;">${formatCurrency(totalAmount)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">반려 사유</td><td style="padding: 8px 0; color: #ea580c;">${rejectionReason || '-'}</td></tr>
        </table>
        <p style="margin-top: 20px;"><a href="${APP_URL}/request/${requestId || ''}" style="display: inline-block; padding: 10px 20px; background-color: #ea580c; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">상세 내역 확인하기</a></p>
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

    const db = admin.firestore()
    const transporter = createTransporter()

    // 1) pending → reviewed: 해당 위원회 승인자에게 승인 요청 알림
    if (oldStatus === 'pending' && newStatus === 'reviewed') {
      const committee = after.committee as string
      const totalAmount = after.totalAmount as number
      const payee = after.payee as string
      const requestedByUid = (after.requestedBy as { uid: string }).uid
      const committeeLabel = COMMITTEE_LABELS[committee] || committee
      const reqId = event.params?.requestId || ''

      // 신청자의 역할 확인 (위원장이 신청한 건은 executive만 승인 가능)
      const requesterSnap = await db.doc(`users/${requestedByUid}`).get()
      const requesterRole = requesterSnap.exists ? requesterSnap.data()?.role as string : 'user'
      const isDirectorRequest = requesterRole === 'session_director' || requesterRole === 'logistic_admin'

      let approverRoles: string[]
      if (isDirectorRequest) {
        // 위원장이 신청한 건 → executive만 승인 가능
        approverRoles = ['executive']
      } else {
        approverRoles = committee === 'operations'
          ? ['approver_ops', 'session_director', 'executive']
          : ['approver_prep', 'logistic_admin', 'executive']
      }

      const usersSnapshot = await db.collection('users')
        .where('role', 'in', approverRoles)
        .get()

      for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data()
        const email = user.email as string
        if (!email) continue

        try {
          await transporter.sendMail({
            from: `지불/환불 시스템 <${gmailUser.value()}>`,
            to: email,
            subject: `[지불/환불] 승인 요청 (${committeeLabel})`,
            html: `
              <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #16a34a; margin-bottom: 16px;">검토 완료 — 승인이 필요합니다</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr><td style="padding: 8px 0; color: #6b7280;">위원회</td><td style="padding: 8px 0;">${committeeLabel}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">신청자</td><td style="padding: 8px 0;">${payee}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">신청 금액</td><td style="padding: 8px 0; font-weight: 600;">${formatCurrency(totalAmount)}</td></tr>
                </table>
                <p style="margin-top: 20px;"><a href="${APP_URL}/request/${reqId}" style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">신청서 승인하기</a></p>
              </div>
            `,
          })
          console.log(`Approval request notification sent to ${email}`)
        } catch (error) {
          console.error(`Failed to send approval notification to ${email}:`, error)
        }
      }
      return
    }

    // 2) 신청자에게 알림: reviewed→approved, pending|reviewed→rejected, approved→force_rejected
    const shouldNotifyRequester =
      (oldStatus === 'reviewed' && newStatus === 'approved') ||
      ((oldStatus === 'pending' || oldStatus === 'reviewed') && newStatus === 'rejected') ||
      (oldStatus === 'approved' && newStatus === 'force_rejected')

    if (!shouldNotifyRequester) return

    const requestedBy = after.requestedBy as { email: string; name: string } | undefined
    if (!requestedBy?.email) {
      console.warn('No requestedBy email found, skipping notification')
      return
    }

    const requestId = event.params?.requestId || ''
    const { subject, html } = buildStatusChangeEmail(after, newStatus, requestId)

    try {
      await transporter.sendMail({
        from: `지불/환불 시스템 <${gmailUser.value()}>`,
        to: requestedBy.email,
        subject,
        html,
      })
      console.log(`Status change email sent to ${requestedBy.email} (${oldStatus}→${newStatus})`)
    } catch (error) {
      console.error('Failed to send status change email:', error)
    }
  }
)

function buildWeeklyDigestEmail(userName: string, sections: { label: string; count: number }[]): { subject: string; html: string } {
  const totalCount = sections.reduce((sum, s) => sum + s.count, 0)
  const sectionHtml = sections
    .filter(s => s.count > 0)
    .map(s => `<li>${s.label}: <strong>${s.count}건</strong></li>`)
    .join('')

  return {
    subject: `[지불/환불] 처리 대기 ${totalCount}건`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2563eb; margin-bottom: 16px;">주간 처리 현황</h2>
        <p style="margin-bottom: 16px;">${userName}님, 처리가 필요한 건이 있습니다.</p>
        <ul style="margin-bottom: 20px; padding-left: 20px;">${sectionHtml}</ul>
        <p style="margin-top: 20px;"><a href="${APP_URL}/admin/requests" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">확인하기</a></p>
      </div>
    `,
  }
}

// 매주 일요일 09:00 KST 처리 대기 알림
export const weeklyApproverDigest = onSchedule(
  {
    schedule: 'every sunday 00:00',
    timeZone: 'UTC',
    secrets: [gmailUser, gmailAppPassword],
  },
  async () => {
    const db = admin.firestore()

    // 관련 역할 사용자 조회
    const relevantRoles = ['finance_ops', 'finance_prep', 'approver_ops', 'approver_prep', 'session_director', 'logistic_admin', 'executive']
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', relevantRoles)
      .get()

    if (usersSnapshot.empty) {
      console.log('No relevant users found')
      return
    }

    // pending 신청서 (검토 대상) - 위원회별 집계
    const pendingSnapshot = await db.collection('requests')
      .where('status', '==', 'pending')
      .get()

    let opsPendingCount = 0
    let prepPendingCount = 0
    for (const doc of pendingSnapshot.docs) {
      const committee = doc.data().committee as string
      if (committee === 'operations') opsPendingCount++
      else if (committee === 'preparation') prepPendingCount++
    }

    // reviewed 신청서 (승인 대상) - 위원회별 집계
    const reviewedSnapshot = await db.collection('requests')
      .where('status', '==', 'reviewed')
      .get()

    let opsReviewedCount = 0
    let prepReviewedCount = 0
    for (const doc of reviewedSnapshot.docs) {
      const committee = doc.data().committee as string
      if (committee === 'operations') opsReviewedCount++
      else if (committee === 'preparation') prepReviewedCount++
    }
    const totalReviewedCount = reviewedSnapshot.size

    // approved 미정산 건수
    const approvedSnapshot = await db.collection('requests')
      .where('status', '==', 'approved')
      .get()

    const totalApprovedUnsettledCount = approvedSnapshot.size

    const transporter = createTransporter()

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data()
      const role = user.role as string
      const email = user.email as string
      const name = (user.displayName || user.name || '') as string

      if (!email) continue

      const sections: { label: string; count: number }[] = []

      if (role === 'finance_ops') {
        // 운영위 재정: 운영위 검토 대상
        sections.push({ label: '운영위 검토 대기', count: opsPendingCount })
      } else if (role === 'finance_prep') {
        // 준비위 재정(총괄): 준비위 검토 대상 + 승인건 중 미정산
        sections.push({ label: '준비위 검토 대기', count: prepPendingCount })
        sections.push({ label: '승인 미정산', count: totalApprovedUnsettledCount })
      } else if (role === 'approver_ops') {
        // 운영위 승인자: 운영위 승인 대기
        sections.push({ label: '운영위 승인 대기', count: opsReviewedCount })
      } else if (role === 'approver_prep') {
        // 준비위 승인자: 준비위 승인 대기
        sections.push({ label: '준비위 승인 대기', count: prepReviewedCount })
      } else if (role === 'session_director') {
        // 운영 위원장: 운영위 승인 대기
        sections.push({ label: '운영위 승인 대기', count: opsReviewedCount })
      } else if (role === 'logistic_admin') {
        // 준비 위원장: 준비위 승인 대기
        sections.push({ label: '준비위 승인 대기', count: prepReviewedCount })
      } else if (role === 'executive') {
        // 대회장: 전체 승인 대기 + 미정산
        sections.push({ label: '승인 대기', count: totalReviewedCount })
        sections.push({ label: '승인 미정산', count: totalApprovedUnsettledCount })
      }

      const totalCount = sections.reduce((sum, s) => sum + s.count, 0)
      if (totalCount === 0) continue

      const { subject, html } = buildWeeklyDigestEmail(name, sections)

      try {
        await transporter.sendMail({
          from: `지불/환불 시스템 <${gmailUser.value()}>`,
          to: email,
          subject,
          html,
        })
        console.log(`Weekly digest sent to ${email}: ${totalCount} items`)
      } catch (error) {
        console.error(`Failed to send weekly digest to ${email}:`, error)
      }
    }
  }
)
