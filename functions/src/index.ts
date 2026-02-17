import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { google } from 'googleapis'
import { Readable } from 'stream'

admin.initializeApp()

const SCOPES = ['https://www.googleapis.com/auth/drive.file']

function getDriveService() {
  const auth = new google.auth.GoogleAuth({
    scopes: SCOPES,
  })
  return google.drive({ version: 'v3', auth })
}

interface FileInput {
  name: string
  data: string
}

interface ReceiptOutput {
  fileName: string
  driveFileId: string
  driveUrl: string
}

export const uploadReceipts = functions.https.onCall(
  async (request: functions.https.CallableRequest<{ files: FileInput[] }>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }

    const { files } = request.data
    if (!files || files.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No files provided')
    }

    const folderId = process.env.GDRIVE_FOLDER_ID || ''
    const drive = getDriveService()
    const results: ReceiptOutput[] = []

    for (const file of files) {
      const base64Data = file.data.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      const mimeType = file.data.split(';')[0].split(':')[1]

      const stream = new Readable()
      stream.push(buffer)
      stream.push(null)

      const response = await drive.files.create({
        requestBody: {
          name: `${Date.now()}_${file.name}`,
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType,
          body: stream,
        },
        fields: 'id, webViewLink',
      })

      await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      })

      results.push({
        fileName: file.name,
        driveFileId: response.data.id!,
        driveUrl: response.data.webViewLink!,
      })
    }

    return results
  }
)
