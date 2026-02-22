# 서비스 설정 가이드

지불/환불 신청서 웹 서비스의 설치, 설정, 배포 방법을 안내합니다.

## 기술 스택

- **프론트엔드:** React 19 + Vite 7 + TypeScript + Tailwind CSS 4
- **차트:** Recharts 3
- **서버 상태 관리:** TanStack React Query 5
- **다국어:** react-i18next (한국어/영어)
- **인증:** Firebase Authentication (Google)
- **데이터베이스:** Firestore
- **파일 저장소:** Firebase Storage (Cloud Functions)
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
4. **Rules** 탭: 프로젝트 루트의 `firestore.rules` 파일 내용을 붙여넣기 후 **Publish** 클릭
   - 3단계 승인 워크플로우에 맞는 상태 전환별 역할 제한이 적용됩니다.
   - `firebase deploy --only firestore:rules` 명령으로도 배포할 수 있습니다.

### 복합 인덱스

앱을 처음 사용할 때 브라우저 콘솔에 인덱스 생성 링크가 표시됩니다. 링크를 클릭하여 자동 생성하거나, 수동으로 생성:

- Collection: `requests`, Fields: `projectId` (ASC), `requestedBy.uid` (ASC), `createdAt` (DESC)
- Collection: `requests`, Fields: `projectId` (ASC), `createdAt` (DESC)
- Collection: `requests`, Fields: `projectId` (ASC), `status` (ASC)
- Collection: `settlements`, Fields: `projectId` (ASC), `createdAt` (DESC)

## 5. Firebase Storage (영수증/통장사본 업로드)

영수증과 통장사본은 Firebase Storage에 자동 저장됩니다. Cloud Functions가 파일 업로드를 처리하며, 별도의 설정이 필요하지 않습니다.

Storage 경로 구조:
- 영수증: `receipts/{projectId}/{committee}/{timestamp}_{fileName}`
- 통장사본: `bankbook/{userUid}/{timestamp}_{fileName}`

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
| `npm run migrate:three-step` | 3단계 워크플로우 마이그레이션 (프로덕션) |
| `npm run migrate:three-step:emulator` | 3단계 워크플로우 마이그레이션 (에뮬레이터) |

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
| `GCP_SA_KEY` | GCP 서비스 계정 JSON 키 (Firebase CLI 인증용) |

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

3단계 승인 워크플로우: **신청 → 재정 검토 → 최종 승인 → 정산**

| 역할 | 설명 | 권한 |
|------|------|------|
| `user` | 일반 사용자 | 신청서 작성/조회 |
| `finance_ops` | 운영위 재정 | 운영위 신청서 검토/반려 |
| `approver_ops` | 운영위 승인자 | 운영위 검토완료 건 최종 승인/반려 (≤한도), 정산 열람 |
| `finance_prep` | 준비위 재정(총괄) | 모든 위원회 검토/반려, 정산 처리, 승인건 반려, 영수증 관리, 대시보드/예산 설정, 사용자 관리 |
| `approver_prep` | 준비위 승인자 | 준비위 검토완료 건 최종 승인/반려 (≤한도), 정산 열람 |
| `session_director` | 운영 위원장 | 운영위 최종 승인/반려 (금액 무제한), 대시보드, 정산 열람 |
| `logistic_admin` | 준비 위원장 | 준비위 최종 승인/반려 (금액 무제한), 대시보드, 정산 열람 |
| `executive` | 대회장 | 모든 위원회 최종 승인/반려 (금액 무제한), 대시보드, 정산 열람 |
| `admin` | 관리자 | 모든 권한 + 사용자 관리/삭제 + 프로젝트 관리 |

역할별 권한 로직은 `src/lib/roles.ts`에서 관리합니다.

### 상태 흐름

```
pending (대기중) → reviewed (검토완료) → approved (승인) → settled (정산완료)
         ↘ rejected (반려)     ↘ rejected      ↘ force_rejected (반려)
         ↘ cancelled (취소)
```

### 데이터 마이그레이션 (2단계→3단계 전환 시)

기존 2단계 워크플로우에서 3단계로 전환할 때 1회 실행이 필요합니다.

```bash
# 프로덕션
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json npm run migrate:three-step

# 에뮬레이터
npm run migrate:three-step:emulator
```

마이그레이션 내용:
- 기존 `finance` 역할 사용자 → `finance_prep`으로 변경
- 기존 신청서에 `reviewedBy`/`reviewedAt` 필드 추가 (null 초기화)
- 이미 승인/정산된 건: `approvedBy` 정보를 `reviewedBy`로 복사

> 멱등성 보장: 여러 번 실행해도 안전합니다.

---

## 프로젝트 구조

```
finanace/
├── .github/workflows/      # GitHub Actions CI/CD
│   └── deploy.yml            # main push 시 자동 빌드/배포
├── src/
│   ├── components/          # 공통 UI 컴포넌트
│   │   ├── AdminRequestModals # 승인/반려 모달
│   │   ├── BudgetWarningBanner # 예산 경고 배너
│   │   ├── CommitteeSelect    # 위원회 라디오 선택
│   │   ├── ConfirmModal       # 제출 확인 모달
│   │   ├── DisplayNameModal   # 초기 가입 정보 입력
│   │   ├── EmptyState         # 빈 상태 표시
│   │   ├── ErrorAlert         # 에러 목록 표시
│   │   ├── FileUpload         # 파일 업로드 + 검증
│   │   ├── FinanceVerification # 지역사무실 재정부 확인란
│   │   ├── FormField          # 폼 필드 래퍼
│   │   ├── Icons              # SVG 아이콘 컴포넌트
│   │   ├── InfiniteScrollSentinel # 무한 스크롤 감지
│   │   ├── InfoGrid           # 정보 그리드 (반응형)
│   │   ├── ItemRow            # 신청서 항목 행
│   │   ├── ItemsTable         # 항목 테이블
│   │   ├── Layout             # 네비게이션 레이아웃 (UserMenu, 모바일 대응)
│   │   ├── Modal              # 접근성 모달 (ESC, 포커스 트랩)
│   │   ├── PageHeader         # 페이지 헤더
│   │   ├── ProjectSelector    # 프로젝트 전환/생성/복원 드롭다운
│   │   ├── ProtectedRoute     # 인증/권한 라우트 가드
│   │   ├── ReceiptGallery     # 영수증 이미지 갤러리
│   │   ├── Select             # 공통 셀렉트 컴포넌트
│   │   ├── SignatureBlock     # 신청자/승인자 서명 블록
│   │   ├── SignaturePad       # 캔버스 서명 패드
│   │   ├── Spinner            # 로딩 스피너
│   │   ├── StatCard           # 통계 카드
│   │   ├── StatusBadge        # 상태 배지
│   │   ├── StatusProgress    # 상태 진행 표시 (4단계 스텝)
│   │   ├── Tooltip            # 툴팁
│   │   ├── dashboard/         # 대시보드 차트 컴포넌트
│   │   │   ├── BudgetCodeBarChart   # 예산 코드별 바 차트
│   │   │   ├── BudgetRingGauge      # 예산 사용률 영역 차트
│   │   │   ├── BudgetSettingsSection # 예산 설정 섹션
│   │   │   ├── CommitteeBarChart    # 위원회별 바 차트
│   │   │   ├── MonthlyTrendChart    # 신청 추이 차트 (일별/월별 토글)
│   │   │   └── TabbedCharts         # 탭 차트 컨테이너
│   │   └── settings/          # 설정 하위 컴포넌트
│   │       ├── MemberManagement     # 멤버 관리
│   │       ├── PersonalSettings     # 개인 설정
│   │       ├── ProjectCreateForm    # 프로젝트 생성 폼
│   │       └── ProjectGeneralSettings # 프로젝트 일반 설정
│   ├── constants/           # 상수
│   │   ├── budgetCodes.ts     # 예산 코드 (i18n key 기반)
│   │   ├── labels.ts          # 라벨 상수 (deprecated, i18n 사용)
│   │   └── sessions.ts        # 세션 목록
│   ├── contexts/            # React Context
│   │   ├── AuthContext.tsx    # 인증 + 사용자 관리
│   │   └── ProjectContext.tsx # 프로젝트 선택/전환 관리
│   ├── hooks/               # React Query 커스텀 훅
│   │   ├── useBudgetUsage.ts  # 예산 사용률 계산
│   │   └── queries/           # 데이터 페칭 훅
│   │       ├── queryKeys.ts       # React Query 키 관리
│   │       ├── useCloudFunctions.ts # Cloud Functions 호출
│   │       ├── useProjects.ts     # 프로젝트 CRUD
│   │       ├── useRequests.ts     # 신청서 조회 (무한 스크롤)
│   │       ├── useSettings.ts     # 글로벌 설정
│   │       ├── useSettlements.ts  # 정산 조회
│   │       └── useUsers.ts        # 사용자 조회
│   ├── lib/                 # 유틸리티
│   │   ├── firebase.ts        # Firebase 설정 (에뮬레이터 자동 연결 포함)
│   │   ├── i18n.ts            # i18next 설정
│   │   ├── pdfExport.ts       # PDF 생성 로직
│   │   ├── queryClient.ts     # React Query 클라이언트 설정
│   │   ├── roles.ts           # 역할별 권한 판별 함수
│   │   └── utils.ts           # 공통 유틸 (formatPhone, fileToBase64 등)
│   ├── locales/             # 번역 파일
│   │   ├── ko.json            # 한국어
│   │   └── en.json            # 영어
│   ├── pages/               # 페이지 컴포넌트 (14개, lazy-loaded)
│   │   ├── LoginPage          # Google 로그인
│   │   ├── RequestFormPage    # 신청서 작성 (draft 자동저장)
│   │   ├── MyRequestsPage     # 내 신청 내역
│   │   ├── RequestDetailPage  # 신청서 상세 (영수증/통장사본 미리보기)
│   │   ├── ResubmitPage       # 반려된 신청서 수정 후 재신청
│   │   ├── AdminRequestsPage  # 신청 관리 (승인/반려)
│   │   ├── ReceiptsPage       # 영수증 전체 조회/일괄 다운로드
│   │   ├── SettlementPage     # 정산 처리 (승인건 선택)
│   │   ├── SettlementListPage # 정산 내역 목록
│   │   ├── SettlementReportPage # 정산 리포트 (PDF 내보내기)
│   │   ├── DashboardPage      # 대시보드 (예산 현황/차트/설정)
│   │   ├── AdminUsersPage     # 사용자 관리
│   │   ├── ProfilePage        # 내 설정 (개인 정보/통장사본/서명/언어)
│   │   └── SettingsPage       # 프로젝트 설정 (Admin 전용)
│   └── types/               # TypeScript 타입
│       └── index.ts           # 역할, 위원회, 신청서, 정산, 프로젝트 타입 정의
├── functions/               # Cloud Functions (2nd Gen)
│   └── src/index.ts           # uploadReceiptsV2, uploadBankBookV2, downloadFileV2, cleanupDeletedProjects, onRequestCreated, onRequestStatusChange, weeklyApproverDigest, migrateToThreeStepWorkflow
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
| `projects` | 프로젝트(대회) 설정 (예산, Document No., 승인 기준, 멤버) |
| `settings` | 글로벌 설정 (기본 프로젝트 ID) |

## Firebase Storage 구조

파일은 Firebase Storage 버킷에 자동 저장됩니다.

| 경로 패턴 | 용도 |
|-----------|------|
| `receipts/{projectId}/{committee}/{timestamp}_{fileName}` | 영수증 파일 |
| `bankbook/{userUid}/{timestamp}_{fileName}` | 통장사본 |

프로젝트 삭제 시 해당 프로젝트의 Storage 파일도 자동으로 정리됩니다.

## 코드 분할 (Code Splitting)

Vite의 `manualChunks`와 React `lazy()`를 사용하여 청크를 분리합니다:

| 청크 | 내용 |
|------|------|
| `vendor-react` | React, React DOM, React Router |
| `vendor-firebase` | Firebase SDK |
| `vendor-recharts` | Recharts 차트 라이브러리 |
| `vendor-i18n` | i18next |
| `index` | 앱 코어 (AuthContext, Layout 등) |
| 각 페이지 | Lazy-loaded 페이지별 청크 |

모든 청크가 500KB 미만으로 Rollup 경고 없이 빌드됩니다.
