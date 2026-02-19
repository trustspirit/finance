"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBankBook = exports.uploadReceipts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
const stream_1 = require("stream");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
admin.initializeApp();
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'service-account.json');
// Google Drive 폴더 ID
const FOLDER_IDS = {
    operations: process.env.GDRIVE_FOLDER_OPERATIONS || '',
    preparation: process.env.GDRIVE_FOLDER_PREPARATION || '',
    bankbook: process.env.GDRIVE_FOLDER_BANKBOOK || '',
};
const functionConfig = {
    secrets: ['DRIVE_SERVICE_ACCOUNT'],
};
let _driveService = null;
function getDriveService() {
    if (!_driveService) {
        // Secret Manager에서 credentials 로드, 없으면 로컬 파일 fallback
        const secretJson = process.env.DRIVE_SERVICE_ACCOUNT;
        let auth;
        if (secretJson) {
            const credentials = JSON.parse(secretJson);
            auth = new googleapis_1.google.auth.GoogleAuth({
                credentials,
                scopes: SCOPES,
            });
        }
        else if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
            auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: SERVICE_ACCOUNT_PATH,
                scopes: SCOPES,
            });
        }
        else {
            throw new Error('No Drive service account credentials found');
        }
        _driveService = googleapis_1.google.drive({ version: 'v3', auth });
    }
    return _driveService;
}
async function uploadFileToDrive(drive, file, folderId) {
    if (!file.data.includes(',')) {
        throw new Error('File data must be a base64 data URI');
    }
    const base64Data = file.data.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = file.data.split(';')[0].split(':')[1];
    const stream = new stream_1.Readable();
    stream.push(buffer);
    stream.push(null);
    const response = await drive.files.create({
        requestBody: {
            name: `${Date.now()}_${file.name}`,
            parents: [folderId],
        },
        media: { mimeType, body: stream },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
    });
    await drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
    });
    return {
        fileName: file.name,
        driveFileId: response.data.id,
        driveUrl: response.data.webViewLink,
    };
}
async function getProjectFolderId(projectId, committee) {
    if (projectId) {
        try {
            const projectDoc = await admin.firestore().doc(`projects/${projectId}`).get();
            if (projectDoc.exists) {
                const folderId = projectDoc.data()?.driveFolders?.[committee];
                if (folderId)
                    return folderId;
            }
        }
        catch (err) {
            console.warn('Failed to fetch project Drive settings, falling back to env vars:', err);
        }
    }
    return FOLDER_IDS[committee] || '';
}
// 영수증 업로드
exports.uploadReceipts = functions.runWith(functionConfig).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { files, committee, projectId } = data;
    if (!files || files.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No files provided');
    }
    const folderId = await getProjectFolderId(projectId, committee);
    if (!folderId) {
        throw new functions.https.HttpsError('invalid-argument', `No Drive folder configured for committee: ${committee}`);
    }
    const drive = getDriveService();
    const results = [];
    for (const file of files) {
        results.push(await uploadFileToDrive(drive, file, folderId));
    }
    return results;
});
// 통장사본 업로드
exports.uploadBankBook = functions.runWith(functionConfig).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { file, projectId } = data;
    if (!file) {
        throw new functions.https.HttpsError('invalid-argument', 'No file provided');
    }
    const folderId = await getProjectFolderId(projectId, 'bankbook');
    if (!folderId) {
        throw new functions.https.HttpsError('failed-precondition', 'Bankbook folder not configured');
    }
    const drive = getDriveService();
    return await uploadFileToDrive(drive, file, folderId);
});
//# sourceMappingURL=index.js.map