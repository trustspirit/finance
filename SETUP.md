# Firebase & Google Drive 설정 가이드

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트 생성
2. 프로젝트 설정 > 일반 > 웹 앱 추가
3. Firebase 설정 값을 `.env.local`에 입력

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## 2. Firebase Authentication 설정

1. Firebase Console > Authentication > Sign-in method
2. Google 제공업체 활성화
3. 프로젝트 지원 이메일 설정

## 3. Firestore Database 설정

1. Firebase Console > Firestore Database > 데이터베이스 만들기
2. 보안 규칙 설정:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /requests/{requestId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'approver'];
    }
  }
}
```

3. 복합 인덱스 생성 (Firestore > 인덱스):
   - Collection: `requests`, Fields: `requestedBy.uid` (ASC), `createdAt` (DESC)

## 4. Google Drive API 설정

1. [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Enable APIs
2. Google Drive API 활성화
3. Service Accounts > 서비스 계정 생성
4. 서비스 계정 키(JSON) 다운로드
5. 키 파일을 `functions/service-account.json`으로 저장 (gitignore에 추가됨)

## 5. Google Drive 폴더 설정

1. Google Drive에서 영수증용 폴더 생성
2. 서비스 계정 이메일(xxx@xxx.iam.gserviceaccount.com)에 폴더 공유 (편집자 권한)
3. 폴더 ID 복사 (URL에서 `folders/` 뒤의 문자열)
4. Cloud Functions 환경 변수 설정:

```bash
# Firebase Functions 환경변수 설정
firebase functions:config:set gdrive.folder_id="YOUR_FOLDER_ID"

# 또는 .env 파일 사용 (functions/.env)
GDRIVE_FOLDER_ID=YOUR_FOLDER_ID
```

## 6. Firebase CLI 설치 & 배포

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 로그인
firebase login

# 프로젝트 연결
firebase use --add your-project-id

# Functions 의존성 설치
cd functions && npm install && cd ..

# 빌드
npm run build

# 배포
firebase deploy
```

## 7. 관리자 설정

Firestore Console에서 `users` 컬렉션의 특정 사용자 문서의 `role` 필드를 `admin` 또는 `approver`로 변경

## 로컬 개발

```bash
# 프론트엔드 개발 서버
npm run dev

# Firebase 에뮬레이터 (선택)
firebase emulators:start
```
