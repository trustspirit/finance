import * as functions from 'firebase-functions'
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
export const uploadReceipts = functions.https.onCall(
  async (data: { files: FileInput[]; committee: string; projectId?: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { files, committee, projectId } = data
    if (!files || files.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No files provided')
    }

    const results: UploadResult[] = []
    for (const file of files) {
      const storagePath = `receipts/${projectId || 'default'}/${committee}/${Date.now()}_${file.name}`
      results.push(await uploadFileToStorage(file, storagePath))
    }
    return results
  }
)

// 통장사본 업로드
export const uploadBankBook = functions.https.onCall(
  async (data: { file: FileInput }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { file } = data
    if (!file) {
      throw new functions.https.HttpsError('invalid-argument', 'No file provided')
    }

    // Delete old bank book file if exists
    const userDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get()
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

    const storagePath = `bankbook/${context.auth.uid}/${Date.now()}_${file.name}`
    return await uploadFileToStorage(file, storagePath)
  }
)

// 파일 다운로드 프록시 (CORS 우회)
export const downloadFile = functions.https.onCall(
  async (data: { storagePath: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { storagePath } = data
    if (!storagePath) {
      throw new functions.https.HttpsError('invalid-argument', 'No storage path provided')
    }

    const fileRef = bucket.file(storagePath)
    const [exists] = await fileRef.exists()
    if (!exists) {
      throw new functions.https.HttpsError('not-found', 'File not found')
    }

    const [buffer] = await fileRef.download()
    const [metadata] = await fileRef.getMetadata()

    return {
      data: buffer.toString('base64'),
      contentType: metadata.contentType || 'application/octet-stream',
      fileName: storagePath.split('/').pop() || 'file',
    }
  }
)
