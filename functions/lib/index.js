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
exports.downloadFileV2 = exports.uploadBankBookV2 = exports.uploadReceiptsV2 = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const STORAGE_BUCKET = 'finance-96f46.firebasestorage.app';
const bucket = admin.storage().bucket(STORAGE_BUCKET);
async function uploadFileToStorage(file, storagePath) {
    if (!file.data.includes(',')) {
        throw new Error('File data must be a base64 data URI');
    }
    const base64Data = file.data.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = file.data.split(';')[0].split(':')[1];
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
        metadata: { contentType: mimeType },
    });
    await fileRef.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
    return {
        fileName: file.name,
        storagePath,
        url,
    };
}
// 영수증 업로드
exports.uploadReceiptsV2 = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { files, committee, projectId } = request.data;
    if (!files || files.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'No files provided');
    }
    const results = [];
    for (const file of files) {
        const storagePath = `receipts/${projectId || 'default'}/${committee}/${Date.now()}_${file.name}`;
        results.push(await uploadFileToStorage(file, storagePath));
    }
    return results;
});
// 통장사본 업로드
exports.uploadBankBookV2 = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { file } = request.data;
    if (!file) {
        throw new https_1.HttpsError('invalid-argument', 'No file provided');
    }
    // Delete old bank book file if exists
    const userDoc = await admin.firestore().doc(`users/${request.auth.uid}`).get();
    if (userDoc.exists) {
        const oldPath = userDoc.data()?.bankBookPath;
        if (oldPath) {
            try {
                await bucket.file(oldPath).delete();
            }
            catch {
                // Ignore if file already deleted
            }
        }
    }
    const storagePath = `bankbook/${request.auth.uid}/${Date.now()}_${file.name}`;
    return await uploadFileToStorage(file, storagePath);
});
// 파일 다운로드 프록시 (CORS 우회)
exports.downloadFileV2 = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { storagePath } = request.data;
    if (!storagePath) {
        throw new https_1.HttpsError('invalid-argument', 'No storage path provided');
    }
    const fileRef = bucket.file(storagePath);
    const [exists] = await fileRef.exists();
    if (!exists) {
        throw new https_1.HttpsError('not-found', 'File not found');
    }
    const [buffer] = await fileRef.download();
    const [metadata] = await fileRef.getMetadata();
    return {
        data: buffer.toString('base64'),
        contentType: metadata.contentType || 'application/octet-stream',
        fileName: storagePath.split('/').pop() || 'file',
    };
});
//# sourceMappingURL=index.js.map