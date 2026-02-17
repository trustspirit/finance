# 서비스 설정 가이드

지불/환불 신청서 웹 서비스의 설치, 설정, 배포 방법을 안내합니다.

## 기술 스택

- **프론트엔드:** React 18 + Vite + TypeScript + Tailwind CSS
- **인증:** Firebase Authentication (Google)
- **데이터베이스:** Firestore
- **파일 업로드:** Google Drive API (Cloud Functions)
- **호스팅:** Firebase Hosting

---

## 1. 사전 요구사항

- Node.js 20+ 설치
- Firebase CLI 설치: `npm install -g firebase-tools`
- Google 계정 (Firebase/Google Cloud 접근용)

## 2. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트 생성
2. 프로젝트 설정 > 일반 > **웹 앱 추가**
3. 표시되는 Firebase 설정 값을 프로젝트 루트의 `.env.local`에 입력:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## 3. Firebase Authentication

1. Firebase Console > **Authentication** > **Sign-in method**
2. **Google** 제공업체 활성화
3. 프로젝트 지원 이메일 설정
4. **Settings** > Authorized domains에 배포 도메인 추가 (localhost는 기본 포함)

## 4. Firestore Database

1. Firebase Console > **Firestore Database** > **Create database**
2. 위치: `asia-northeast3` (서울) 추천
3. **Production mode**로 생성
4. **Rules** 탭에서 다음 보안 규칙으로 교체:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /requests/{requestId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'approver'];
    }
    match /settings/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'approver'];
    }
    match /settlements/{docId} {
      allow read: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'approver'];
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'approver'];
    }
  }
}
```

5. **Publish** 클릭

### 복합 인덱스 생성

앱을 처음 사용할 때 브라우저 콘솔에 인덱스 생성 링크가 표시됩니다. 링크를 클릭하여 자동 생성하거나, 수동으로 생성:

- Firebase Console > Firestore > **Indexes**
- Collection: `requests`
- Fields: `requestedBy.uid` (Ascending), `createdAt` (Descending)

## 5. Google Drive API (영수증/통장사본 업로드)

### 5-1. API 활성화

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. Firebase 프로젝트 선택
3. **APIs & Services** > **Library** > "Google Drive API" 검색 > **Enable**

### 5-2. 서비스 계정 생성

1. **APIs & Services** > **Credentials** > **+ CREATE CREDENTIALS** > **Service account**
2. 이름: `drive-uploader` > **CREATE AND CONTINUE** > **DONE**
3. 생성된 서비스 계정 클릭 > **Keys** 탭 > **ADD KEY** > **Create new key** > **JSON**
4. 다운로드된 JSON 파일을 프로젝트에 저장:

```bash
mv ~/Downloads/your-project-xxxxxxxx.json functions/service-account.json
```

> `functions/service-account.json`은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

### 5-3. Google Drive 폴더 생성

Google Drive에서 세 개 폴더를 생성합니다:

| 폴더 이름 | 용도 |
|-----------|------|
| `영수증-운영위원회` | 운영 위원회 영수증 |
| `영수증-준비위원회` | 준비 위원회 영수증 |
| `통장사본` | 사용자 통장사본 |

각 폴더에 대해:
1. **우클릭 > 공유** > 서비스 계정 이메일 추가:
   ```
   drive-uploader@your-project.iam.gserviceaccount.com
   ```
   권한: **편집자**
2. 폴더 ID 복사 (URL에서 `folders/` 뒤의 문자열)

### 5-4. Cloud Functions 환경 변수 설정

`functions/.env` 파일 생성:

```
GDRIVE_FOLDER_OPERATIONS=운영위원회_폴더ID
GDRIVE_FOLDER_PREPARATION=준비위원회_폴더ID
GDRIVE_FOLDER_BANKBOOK=통장사본_폴더ID
```

## 6. 로컬 개발

```bash
# 의존성 설치
npm install

# Cloud Functions 의존성 설치
cd functions && npm install && cd ..

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 7. 배포

```bash
# Firebase CLI 로그인
firebase login

# 프로젝트 연결
firebase use --add your-project-id

# 프론트엔드 빌드
npm run build

# 전체 배포 (Hosting + Functions)
firebase deploy

# 또는 개별 배포
firebase deploy --only hosting
firebase deploy --only functions
```

## 8. 최초 관리자 설정

배포 후 최초 관리자를 수동으로 지정해야 합니다:

1. Google 계정으로 로그인 (최초 사용자 등록)
2. Firebase Console > **Firestore Database**
3. `users` 컬렉션 > 해당 사용자 문서 클릭
4. `role` 필드를 `user` → `admin`으로 변경
5. 해당 사용자가 로그아웃 후 다시 로그인하면 관리자 메뉴 표시

이후 추가 관리자/승인자는 웹 서비스의 **사용자 관리** 페이지에서 지정할 수 있습니다.

---

## 프로젝트 구조

```
finanace/
├── src/
│   ├── components/       # 공통 컴포넌트
│   │   ├── DisplayNameModal.tsx   # 최초 가입 정보 입력
│   │   ├── ItemRow.tsx            # 신청서 항목 행
│   │   ├── Layout.tsx             # 네비게이션 레이아웃
│   │   ├── ProtectedRoute.tsx     # 인증/권한 라우트 가드
│   │   ├── SignaturePad.tsx       # 서명 패드
│   │   └── StatusBadge.tsx        # 상태 배지
│   ├── constants/        # 상수 (예산 코드, 세션)
│   ├── contexts/         # React Context (인증)
│   ├── lib/              # Firebase 설정
│   ├── pages/            # 페이지 컴포넌트
│   │   ├── LoginPage.tsx              # 로그인
│   │   ├── RequestFormPage.tsx        # 신청서 작성 (draft 자동저장)
│   │   ├── MyRequestsPage.tsx         # 내 신청 내역
│   │   ├── RequestDetailPage.tsx      # 신청서 상세 (영수증/통장사본 미리보기)
│   │   ├── AdminRequestsPage.tsx      # 신청 관리 (승인/반려)
│   │   ├── SettlementPage.tsx         # 정산 처리 (승인건 선택)
│   │   ├── SettlementListPage.tsx     # 정산 내역 목록
│   │   ├── SettlementReportPage.tsx   # 정산 리포트 (PDF 내보내기)
│   │   ├── DashboardPage.tsx          # 대시보드 (예산 현황/설정)
│   │   ├── AdminUsersPage.tsx         # 사용자 관리
│   │   └── SettingsPage.tsx           # 설정 (프로필/통장사본/서명)
│   └── types/            # TypeScript 타입
├── functions/            # Cloud Functions
│   ├── src/index.ts          # uploadReceipts, uploadBankBook
│   ├── service-account.json  (gitignored)
│   └── .env                  (gitignored)
├── firebase.json         # Firebase 설정
├── .env.local            # Firebase 클라이언트 설정 (gitignored)
├── README.md             # 사용자 가이드
└── SETUP.md              # 이 파일
```

## Firestore 컬렉션 구조

| 컬렉션 | 용도 |
|--------|------|
| `users` | 사용자 정보 (이름, 연락처, 은행, 통장사본, 서명, 권한) |
| `requests` | 신청서 데이터 (항목, 영수증, 승인/정산 정보) |
| `settlements` | 정산 리포트 (신청자별 통합 항목/영수증) |
| `settings` | 서비스 설정 (예산 등) |

## Google Drive 폴더 구조

| 폴더 | 환경변수 | 용도 |
|------|---------|------|
| 영수증-운영위원회 | `GDRIVE_FOLDER_OPERATIONS` | 운영 위원회 영수증 |
| 영수증-준비위원회 | `GDRIVE_FOLDER_PREPARATION` | 준비 위원회 영수증 |
| 통장사본 | `GDRIVE_FOLDER_BANKBOOK` | 사용자 통장사본 |
