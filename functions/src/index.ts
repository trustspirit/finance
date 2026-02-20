import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

admin.initializeApp()

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
