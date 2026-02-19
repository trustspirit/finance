import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { google } from 'googleapis'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'

admin.initializeApp()

const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'service-account.json')

// Google Drive 폴더 ID
const FOLDER_IDS: Record<string, string> = {
  operations: process.env.GDRIVE_FOLDER_OPERATIONS || '',
  preparation: process.env.GDRIVE_FOLDER_PREPARATION || '',
  bankbook: process.env.GDRIVE_FOLDER_BANKBOOK || '',
}

const functionConfig = {
  secrets: ['DRIVE_SERVICE_ACCOUNT'],
}

let _driveService: ReturnType<typeof google.drive> | null = null
function getDriveService() {
  if (!_driveService) {
    // Secret Manager에서 credentials 로드, 없으면 로컬 파일 fallback
    const secretJson = process.env.DRIVE_SERVICE_ACCOUNT
    let auth
    if (secretJson) {
      const credentials = JSON.parse(secretJson)
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
      })
    } else if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: SCOPES,
      })
    } else {
      throw new Error('No Drive service account credentials found')
    }
    _driveService = google.drive({ version: 'v3', auth })
  }
  return _driveService
}

interface FileInput {
  name: string
  data: string
}

interface UploadResult {
  fileName: string
  driveFileId: string
  driveUrl: string
}

async function uploadFileToDrive(drive: ReturnType<typeof getDriveService>, file: FileInput, folderId: string): Promise<UploadResult> {
  if (!file.data.includes(',')) {
    throw new Error('File data must be a base64 data URI')
  }
  const base64Data = file.data.split(',')[1]
  const buffer = Buffer.from(base64Data, 'base64')
  const mimeType = file.data.split(';')[0].split(':')[1]

  const stream = new Readable()
  stream.push(buffer)
  stream.push(null)

  const response = await drive.files.create({
    requestBody: {
      name: `${Date.now()}_${file.name}`,
      parents: [folderId],
    },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })

  await drive.permissions.create({
    fileId: response.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })

  return {
    fileName: file.name,
    driveFileId: response.data.id!,
    driveUrl: response.data.webViewLink!,
  }
}

async function getProjectFolderId(projectId: string | undefined, committee: string): Promise<string> {
  if (projectId) {
    try {
      const projectDoc = await admin.firestore().doc(`projects/${projectId}`).get()
      if (projectDoc.exists) {
        const folderId = projectDoc.data()?.driveFolders?.[committee]
        if (folderId) return folderId
      }
    } catch (err) {
      console.warn('Failed to fetch project Drive settings, falling back to env vars:', err)
    }
  }
  return FOLDER_IDS[committee] || ''
}

// 영수증 업로드
export const uploadReceipts = functions.runWith(functionConfig).https.onCall(
  async (data: { files: FileInput[]; committee: string; projectId?: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { files, committee, projectId } = data
    if (!files || files.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No files provided')
    }

    const folderId = await getProjectFolderId(projectId, committee)
    if (!folderId) {
      throw new functions.https.HttpsError('invalid-argument', `No Drive folder configured for committee: ${committee}`)
    }

    const drive = getDriveService()
    const results: UploadResult[] = []
    for (const file of files) {
      results.push(await uploadFileToDrive(drive, file, folderId))
    }
    return results
  }
)

// 통장사본 업로드
export const uploadBankBook = functions.runWith(functionConfig).https.onCall(
  async (data: { file: FileInput; projectId?: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { file, projectId } = data
    if (!file) {
      throw new functions.https.HttpsError('invalid-argument', 'No file provided')
    }

    const folderId = await getProjectFolderId(projectId, 'bankbook')
    if (!folderId) {
      throw new functions.https.HttpsError('failed-precondition', 'Bankbook folder not configured')
    }

    const drive = getDriveService()
    return await uploadFileToDrive(drive, file, folderId)
  }
)
