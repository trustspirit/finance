import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { google } from 'googleapis'
import { Readable } from 'stream'
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

function getDriveService() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: SCOPES,
  })
  return google.drive({ version: 'v3', auth })
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
  const base64Data = file.data.split(',')[1]
  const buffer = Buffer.from(base64Data, 'base64')
  const mimeType = file.data.split(';')[0].split(':')[1]

  const stream = new Readable()
  stream.push(buffer)
  stream.push(null)

  const response = await (await drive).files.create({
    requestBody: {
      name: `${Date.now()}_${file.name}`,
      parents: [folderId],
    },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink',
  })

  await (await drive).permissions.create({
    fileId: response.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return {
    fileName: file.name,
    driveFileId: response.data.id!,
    driveUrl: response.data.webViewLink!,
  }
}

// 영수증 업로드
export const uploadReceipts = functions.https.onCall(
  async (request: functions.https.CallableRequest<{ files: FileInput[]; committee: string }>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { files, committee } = request.data
    if (!files || files.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No files provided')
    }

    const folderId = FOLDER_IDS[committee] || ''
    if (!folderId) {
      throw new functions.https.HttpsError('invalid-argument', `Unknown committee: ${committee}`)
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
export const uploadBankBook = functions.https.onCall(
  async (request: functions.https.CallableRequest<{ file: FileInput }>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { file } = request.data
    if (!file) {
      throw new functions.https.HttpsError('invalid-argument', 'No file provided')
    }

    const folderId = FOLDER_IDS.bankbook || ''
    if (!folderId) {
      throw new functions.https.HttpsError('failed-precondition', 'Bankbook folder not configured')
    }

    const drive = getDriveService()
    return await uploadFileToDrive(drive, file, folderId)
  }
)
