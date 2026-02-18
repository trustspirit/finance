# 서비스 설정 가이드

지불/환불 신청서 웹 서비스의 설치, 설정, 배포 방법을 안내합니다.

## 기술 스택

- **프론트엔드:** React 19 + Vite 7 + TypeScript + Tailwind CSS 4
- **다국어:** react-i18next (한국어/영어)
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
4. **Settings** > Authorized domains에 배포 도메인 추가

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
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'finance', 'approver_ops', 'approver_prep'];
    }
    match /settings/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'finance'];
    }
    match /projects/{projectId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /settlements/{docId} {
      allow read: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'finance', 'approver_ops', 'approver_prep'];
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'finance', 'approver_ops', 'approver_prep'];
    }
  }
}
```

5. **Publish** 클릭

### 복합 인덱스

앱을 처음 사용할 때 브라우저 콘솔에 인덱스 생성 링크가 표시됩니다. 링크를 클릭하여 자동 생성하거나, 수동으로 생성:

- Collection: `requests`, Fields: `projectId` (ASC), `requestedBy.uid` (ASC), `createdAt` (DESC)
- Collection: `requests`, Fields: `projectId` (ASC), `createdAt` (DESC)
- Collection: `requests`, Fields: `projectId` (ASC), `status` (ASC)
- Collection: `settlements`, Fields: `projectId` (ASC), `createdAt` (DESC)

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
| 영수증-운영위원회 | 운영 위원회(Session Committee) 영수증 |
| 영수증-준비위원회 | 준비 위원회(Logistical Committee) 영수증 |
| 통장사본 | 사용자 통장사본 |

각 폴더에 대해:
1. **우클릭 > 공유** > 서비스 계정 이메일 추가 (편집자 권한)
2. 폴더 ID 복사 (URL에서 `folders/` 뒤의 문자열)

### 5-4. Google Drive 폴더 설정

**방법 A: 프로젝트별 설정 (권장)**

웹 서비스의 **설정 > 프로젝트 설정** 탭에서 프로젝트를 편집하여 각 Drive 폴더 ID를 입력합니다. 프로젝트별로 다른 폴더를 사용할 수 있습니다.

**방법 B: 환경 변수 (폴백)**

프로젝트 설정이 없는 경우 `functions/.env` 파일의 값이 사용됩니다:

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

# 개발 서버 실행 (Firebase 프로덕션 연결)
npm run dev

# 개발 서버 실행 (Firebase 에뮬레이터 연결)
npm run dev:emulator
```

브라우저에서 `http://localhost:5173` 접속

### Firebase 에뮬레이터

로컬에서 Firebase 서비스(Auth, Firestore, Functions)를 에뮬레이션하여 개발할 수 있습니다.

```bash
# 에뮬레이터 시작
npm run emulator
```

에뮬레이터 포트 구성 (`firebase.json`):

| 서비스 | 포트 |
|--------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Emulator UI | 4000 |

에뮬레이터 모드에서는 `.env.emulator` 파일이 사용됩니다:

```
VITE_USE_EMULATOR=true
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:fake
```

### Mock 데이터

개발/테스트용 mock 데이터를 Firestore에 넣을 수 있습니다.

```bash
# Mock 데이터 생성 (사용자 4명, 신청서 10건, 정산 2건, 예산 설정)
npm run seed

# Mock 데이터 삭제
npm run seed:clear
```

### npm scripts 전체 목록

| 스크립트 | 설명 |
|----------|------|
| `npm run dev` | Vite 개발 서버 (프로덕션 Firebase) |
| `npm run dev:emulator` | Vite 개발 서버 (에뮬레이터 모드) |
| `npm run emulator` | Firebase 에뮬레이터 시작 |
| `npm run build` | TypeScript 컴파일 + Vite 프로덕션 빌드 |
| `npm run lint` | ESLint 실행 |
| `npm run preview` | 프로덕션 빌드 미리보기 |
| `npm run seed` | Mock 데이터 생성 |
| `npm run seed:clear` | Mock 데이터 삭제 |
| `npm run migrate:projects` | 프로젝트 마이그레이션 (프로덕션) |
| `npm run migrate:projects:emulator` | 프로젝트 마이그레이션 (에뮬레이터) |

## 7. 배포

### 자동 배포 (GitHub Actions)

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 및 배포합니다.

워크플로우 파일: `.github/workflows/deploy.yml`

**필요한 GitHub Secrets:**

| Secret | 설명 |
|--------|------|
| `VITE_FIREBASE_API_KEY` | Firebase API 키 |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth 도메인 |
| `VITE_FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage 버킷 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase 메시징 Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase 앱 ID |
| `FIREBASE_TOKEN` | Firebase CLI 토큰 (`firebase login:ci`로 생성) |
| `GDRIVE_FOLDER_OPERATIONS` | 운영위 영수증 Google Drive 폴더 ID |
| `GDRIVE_FOLDER_PREPARATION` | 준비위 영수증 Google Drive 폴더 ID |

> `docs/`, `scripts/`, `*.md`, `.gitignore` 변경 시에는 배포가 트리거되지 않습니다.

### 수동 배포

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

1. Google 계정으로 로그인
2. Firebase Console > **Firestore Database**
3. `users` 컬렉션 > 해당 사용자 문서 클릭
4. `role` 필드를 `user` → `admin`으로 변경
5. 로그아웃 후 다시 로그인하면 관리자 메뉴 표시

이후 추가 관리자/승인자는 웹 서비스의 **사용자 관리** 페이지에서 지정할 수 있습니다.

---

## 사용자 역할 체계

| 역할 | 설명 | 권한 |
|------|------|------|
| `user` | 일반 사용자 | 신청서 작성/조회 |
| `approver_ops` | 운영위원회 승인자 | 운영위 신청 승인/반려, 정산 |
| `approver_prep` | 준비위원회 승인자 | 준비위 신청 승인/반려, 정산 |
| `finance` | 재정 담당 | 모든 위원회 승인/반려, 정산, 대시보드/예산 설정 |
| `admin` | 관리자 | 모든 권한 + 사용자 관리 + 프로젝트 관리 |

역할별 권한 로직은 `src/lib/roles.ts`에서 관리합니다.

---

## 프로젝트 구조

```
finanace/
├── .github/workflows/      # GitHub Actions CI/CD
│   └── deploy.yml            # main push 시 자동 빌드/배포
├── src/
│   ├── components/          # 공통 UI 컴포넌트 (21개)
│   │   ├── CommitteeSelect    # 위원회 라디오 선택
│   │   ├── ConfirmModal       # 제출 확인 모달
│   │   ├── DisplayNameModal   # 초기 가입 정보 입력
│   │   ├── EmptyState         # 빈 상태 표시
│   │   ├── ErrorAlert         # 에러 목록 표시
│   │   ├── FileUpload         # 파일 업로드 + 검증
│   │   ├── FinanceVerification # 지역사무실 재정부 확인란
│   │   ├── FormField          # 폼 필드 래퍼
│   │   ├── InfoGrid           # 정보 그리드 (반응형)
│   │   ├── ItemRow            # 신청서 항목 행
│   │   ├── ItemsTable         # 항목 테이블
│   │   ├── Layout             # 네비게이션 레이아웃 (모바일 대응)
│   │   ├── Modal              # 접근성 모달 (ESC, 포커스 트랩)
│   │   ├── PageHeader         # 페이지 헤더
│   │   ├── ProjectSelector    # 프로젝트 전환 드롭다운
│   │   ├── ProtectedRoute     # 인증/권한 라우트 가드
│   │   ├── ReceiptGallery     # 영수증 이미지 갤러리
│   │   ├── SignatureBlock     # 신청자/승인자 서명 블록
│   │   ├── SignaturePad       # 캔버스 서명 패드
│   │   ├── Spinner            # 로딩 스피너
│   │   └── StatusBadge        # 상태 배지
│   ├── constants/           # 상수
│   │   ├── budgetCodes.ts     # 예산 코드 (i18n key 기반)
│   │   ├── labels.ts          # 라벨 상수 (deprecated, i18n 사용)
│   │   └── sessions.ts        # 세션 목록
│   ├── contexts/            # React Context
│   │   ├── AuthContext.tsx    # 인증 + 사용자 관리
│   │   └── ProjectContext.tsx # 프로젝트 선택/전환 관리
│   ├── lib/                 # 유틸리티
│   │   ├── firebase.ts        # Firebase 설정 (에뮬레이터 자동 연결 포함)
│   │   ├── i18n.ts            # i18next 설정
│   │   ├── pdfExport.ts       # PDF 생성 로직
│   │   ├── roles.ts           # 역할별 권한 판별 함수
│   │   └── utils.ts           # 공통 유틸 (formatPhone, fileToBase64 등)
│   ├── locales/             # 번역 파일
│   │   ├── ko.json            # 한국어
│   │   └── en.json            # 영어
│   ├── pages/               # 페이지 컴포넌트 (12개, lazy-loaded)
│   │   ├── LoginPage          # Google 로그인
│   │   ├── RequestFormPage    # 신청서 작성 (draft 자동저장)
│   │   ├── MyRequestsPage     # 내 신청 내역
│   │   ├── RequestDetailPage  # 신청서 상세 (영수증/통장사본 미리보기)
│   │   ├── ResubmitPage       # 반려된 신청서 수정 후 재신청
│   │   ├── AdminRequestsPage  # 신청 관리 (승인/반려)
│   │   ├── SettlementPage     # 정산 처리 (승인건 선택)
│   │   ├── SettlementListPage # 정산 내역 목록
│   │   ├── SettlementReportPage # 정산 리포트 (PDF 내보내기)
│   │   ├── DashboardPage      # 대시보드 (예산 현황/설정)
│   │   ├── AdminUsersPage     # 사용자 관리
│   │   └── SettingsPage       # 설정 (프로필/통장사본/서명/언어)
│   └── types/               # TypeScript 타입
│       └── index.ts           # 역할, 위원회, 신청서, 정산 타입 정의
├── functions/               # Cloud Functions
│   ├── src/index.ts           # uploadReceipts, uploadBankBook
│   ├── service-account.json   (gitignored)
│   └── .env                   (gitignored)
├── scripts/                 # 유틸리티 스크립트
│   ├── seed.ts                # Mock 데이터 생성
│   ├── clear.ts               # Mock 데이터 삭제
│   └── migrate-projects.ts   # 프로젝트 마이그레이션
├── firebase.json            # Firebase 설정 (호스팅 + Functions + 에뮬레이터)
├── .env.local               # Firebase 클라이언트 설정 (gitignored)
├── .env.emulator            # Firebase 에뮬레이터 설정
├── README.md                # 사용자 가이드
└── SETUP.md                 # 이 파일
```

## Firestore 컬렉션 구조

| 컬렉션 | 용도 |
|--------|------|
| `users` | 사용자 정보 (이름, 연락처, 은행, 통장사본, 서명, 권한, 할당된 프로젝트) |
| `requests` | 신청서 데이터 (프로젝트ID, 항목, 영수증, 승인/정산 정보) |
| `settlements` | 정산 리포트 (프로젝트ID, 신청자별 통합 항목/영수증) |
| `projects` | 프로젝트(대회) 설정 (예산, Document No., Drive 폴더, 멤버) |
| `settings` | 글로벌 설정 (기본 프로젝트 ID) |

## Google Drive 폴더 구조

프로젝트별로 독립적인 Drive 폴더를 설정할 수 있습니다. **설정 > 프로젝트 설정**에서 각 프로젝트의 Drive 폴더 ID를 입력합니다.

| 폴더 | 용도 | 설정 위치 |
|------|------|-----------|
| 영수증-운영위원회 | Session Committee 영수증 | 프로젝트 설정 > 운영위 폴더 ID |
| 영수증-준비위원회 | Logistical Committee 영수증 | 프로젝트 설정 > 준비위 폴더 ID |
| 통장사본 | 사용자 통장사본 | 프로젝트 설정 > 통장사본 폴더 ID |

Drive 폴더 ID는 Google Drive URL에서 `folders/` 뒤의 문자열입니다.
프로젝트 설정이 비어있으면 `functions/.env` 환경변수가 폴백으로 사용됩니다.

## 코드 분할 (Code Splitting)

Vite의 `manualChunks`와 React `lazy()`를 사용하여 청크를 분리합니다:

| 청크 | 내용 |
|------|------|
| `vendor-react` | React, React DOM, React Router |
| `vendor-firebase` | Firebase SDK |
| `vendor-i18n` | i18next |
| `index` | 앱 코어 (AuthContext, Layout 등) |
| 각 페이지 | Lazy-loaded 페이지별 청크 |

모든 청크가 500KB 미만으로 Rollup 경고 없이 빌드됩니다.
