/**
 * Firestore Mock Data Seed Script
 * Usage: npx tsx scripts/seed.ts
 *
 * Creates:
 * - 4 users (admin, approver, 2 regular users)
 * - 10 payment requests (pending, approved, rejected, settled)
 * - 1 settlement report
 * - Budget config
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'functions', 'service-account.json'), 'utf8'),
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Simple signature SVG as base64
const MOCK_SIGNATURE =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10,40 C30,10 50,50 80,30 S120,10 150,35 S180,50 190,30" fill="none" stroke="#000" stroke-width="2"/></svg>',
  ).toString('base64');

const daysAgo = (d: number) => Timestamp.fromDate(new Date(Date.now() - d * 86400000));

// ============ USERS ============
const users = [
  {
    uid: 'mock-admin-001',
    email: 'admin@example.com',
    name: 'Admin User',
    displayName: '정신영',
    phone: '010-1234-5678',
    bankName: '국민은행',
    bankAccount: '123-456-789012',
    defaultCommittee: 'operations',
    signature: MOCK_SIGNATURE,
    bankBookImage: '',
    bankBookDriveId: '',
    bankBookDriveUrl: '',
    role: 'admin',
  },
  {
    uid: 'mock-approver-001',
    email: 'approver@example.com',
    name: 'Approver User',
    displayName: '김민수',
    phone: '010-2345-6789',
    bankName: '신한은행',
    bankAccount: '234-567-890123',
    defaultCommittee: 'operations',
    signature: MOCK_SIGNATURE,
    bankBookImage: '',
    bankBookDriveId: '',
    bankBookDriveUrl: '',
    role: 'approver',
  },
  {
    uid: 'mock-user-001',
    email: 'younghee@example.com',
    name: 'Younghee Lee',
    displayName: '이영희',
    phone: '010-3456-7890',
    bankName: '하나은행',
    bankAccount: '345-678-901234',
    defaultCommittee: 'operations',
    signature: '',
    bankBookImage: '',
    bankBookDriveId: '',
    bankBookDriveUrl: 'https://drive.google.com/mock-bankbook-1',
    role: 'user',
  },
  {
    uid: 'mock-user-002',
    email: 'junhyuk@example.com',
    name: 'Junhyuk Park',
    displayName: '박준혁',
    phone: '010-4567-8901',
    bankName: '우리은행',
    bankAccount: '456-789-012345',
    defaultCommittee: 'preparation',
    signature: '',
    bankBookImage: '',
    bankBookDriveId: '',
    bankBookDriveUrl: 'https://drive.google.com/mock-bankbook-2',
    role: 'user',
  },
];

// ============ MOCK RECEIPTS ============
const mockReceipt = (name: string) => ({
  fileName: name,
  driveFileId: 'mock-file-id-' + Math.random().toString(36).slice(2, 8),
  driveUrl: 'https://drive.google.com/file/d/mock/view',
});

// ============ REQUESTS ============
const requests = [
  // --- PENDING (3) ---
  {
    id: 'req-pending-001',
    createdAt: daysAgo(1),
    status: 'pending',
    payee: '이영희',
    phone: '010-3456-7890',
    bankName: '하나은행',
    bankAccount: '345-678-901234',
    date: '2025-02-15',
    session: '한국',
    committee: 'operations',
    items: [
      { description: '운영위원회 훈련 점심 도시락', budgetCode: 5400, amount: 568000 },
      { description: '운영위원회 교통비', budgetCode: 5110, amount: 82600 },
    ],
    totalAmount: 650600,
    receipts: [mockReceipt('lunch_receipt.jpg'), mockReceipt('transport_receipt.pdf')],
    requestedBy: { uid: 'mock-user-001', name: '이영희', email: 'younghee@example.com' },
    approvedBy: null,
    approvalSignature: null,
    approvedAt: null,
    rejectionReason: null,
    settlementId: null,
    originalRequestId: null,
    comments: '운영위원회 2월 훈련 모임 관련 비용입니다.',
  },
  {
    id: 'req-pending-002',
    createdAt: daysAgo(2),
    status: 'pending',
    payee: '이영희',
    phone: '010-3456-7890',
    bankName: '하나은행',
    bankAccount: '345-678-901234',
    date: '2025-02-13',
    session: '한국',
    committee: 'operations',
    items: [
      { description: '행사 자료 인쇄비', budgetCode: 5200, amount: 150000 },
      { description: '문구류 구매', budgetCode: 5200, amount: 45000 },
    ],
    totalAmount: 195000,
    receipts: [mockReceipt('print_receipt.png')],
    requestedBy: { uid: 'mock-user-001', name: '이영희', email: 'younghee@example.com' },
    approvedBy: null,
    approvalSignature: null,
    approvedAt: null,
    rejectionReason: null,
    settlementId: null,
    originalRequestId: null,
    comments: '',
  },
  {
    id: 'req-pending-003',
    createdAt: daysAgo(1),
    status: 'pending',
    payee: '박준혁',
    phone: '010-4567-8901',
    bankName: '우리은행',
    bankAccount: '456-789-012345',
    date: '2025-02-16',
    session: '한국',
    committee: 'preparation',
    items: [
      { description: '준비위원회 회의실 대여', budgetCode: 5862, amount: 200000 },
      { description: '회의 다과', budgetCode: 5400, amount: 85000 },
    ],
    totalAmount: 285000,
    receipts: [mockReceipt('room_rental.jpg'), mockReceipt('refreshments.jpg')],
    requestedBy: { uid: 'mock-user-002', name: '박준혁', email: 'junhyuk@example.com' },
    approvedBy: null,
    approvalSignature: null,
    approvedAt: null,
    rejectionReason: null,
    settlementId: null,
    originalRequestId: null,
    comments: '준비위원회 3차 회의 관련 비용',
  },

  // --- APPROVED (3) ---
  {
    id: 'req-approved-001',
    createdAt: daysAgo(7),
    status: 'approved',
    payee: '이영희',
    phone: '010-3456-7890',
    bankName: '하나은행',
    bankAccount: '345-678-901234',
    date: '2025-02-08',
    session: '한국',
    committee: 'operations',
    items: [{ description: '참가자 교통비 지원', budgetCode: 5110, amount: 320000 }],
    totalAmount: 320000,
    receipts: [mockReceipt('transport_support.pdf')],
    requestedBy: { uid: 'mock-user-001', name: '이영희', email: 'younghee@example.com' },
    approvedBy: {
      uid: 'mock-approver-001',
      name: '김민수',
      email: 'approver@example.com',
    },
    approvalSignature: MOCK_SIGNATURE,
    approvedAt: daysAgo(5),
    rejectionReason: null,
    settlementId: null,
    originalRequestId: null,
    comments: '',
  },
  {
    id: 'req-approved-002',
    createdAt: daysAgo(10),
    status: 'approved',
    payee: '박준혁',
    phone: '010-4567-8901',
    bankName: '우리은행',
    bankAccount: '456-789-012345',
    date: '2025-02-05',
    session: '한국',
    committee: 'preparation',
    items: [
      { description: 'T-shirts 제작', budgetCode: 5200, amount: 1200000 },
      { description: '포스터 인쇄', budgetCode: 5200, amount: 180000 },
    ],
    totalAmount: 1380000,
    receipts: [mockReceipt('tshirt_invoice.pdf'), mockReceipt('poster_receipt.jpg')],
    requestedBy: { uid: 'mock-user-002', name: '박준혁', email: 'junhyuk@example.com' },
    approvedBy: { uid: 'mock-admin-001', name: '정신영', email: 'admin@example.com' },
    approvalSignature: MOCK_SIGNATURE,
    approvedAt: daysAgo(8),
    rejectionReason: null,
    settlementId: null,
    originalRequestId: null,
    comments: '2025 행사 물품',
  },
  {
    id: 'req-approved-003',
    createdAt: daysAgo(6),
    status: 'approved',
    payee: '박준혁',
    phone: '010-4567-8901',
    bankName: '우리은행',
    bankAccount: '456-789-012345',
    date: '2025-02-10',
    session: '한국',
    committee: 'preparation',
    items: [
      { description: '시설 대여비 (체육관)', budgetCode: 5862, amount: 500000 },
      { description: '장비 대여비', budgetCode: 5862, amount: 150000 },
    ],
    totalAmount: 650000,
    receipts: [mockReceipt('facility_receipt.pdf')],
    requestedBy: { uid: 'mock-user-002', name: '박준혁', email: 'junhyuk@example.com' },
    approvedBy: {
      uid: 'mock-approver-001',
      name: '김민수',
      email: 'approver@example.com',
    },
    approvalSignature: MOCK_SIGNATURE,
    approvedAt: daysAgo(4),
    rejectionReason: null,
    settlementId: null,
    originalRequestId: null,
    comments: '',
  },

  // --- REJECTED (2) ---
  {
    id: 'req-rejected-001',
    createdAt: daysAgo(5),
    status: 'rejected',
    payee: '이영희',
    phone: '010-3456-7890',
    bankName: '하나은행',
    bankAccount: '345-678-901234',
    date: '2025-02-10',
    session: '한국',
    committee: 'operations',
    items: [{ description: '개인 식사비', budgetCode: 5400, amount: 25000 }],
    totalAmount: 25000,
    receipts: [mockReceipt('personal_meal.jpg')],
    requestedBy: { uid: 'mock-user-001', name: '이영희', email: 'younghee@example.com' },
    approvedBy: {
      uid: 'mock-approver-001',
      name: '김민수',
      email: 'approver@example.com',
    },
    approvalSignature: null,
    approvedAt: daysAgo(4),
    rejectionReason:
      '개인 식사비는 환불 대상이 아닙니다. 행사와 직접 관련된 비용만 신청 가능합니다.',
    settlementId: null,
    originalRequestId: null,
    comments: '',
  },
  {
    id: 'req-rejected-002',
    createdAt: daysAgo(8),
    status: 'rejected',
    payee: '박준혁',
    phone: '010-4567-8901',
    bankName: '우리은행',
    bankAccount: '456-789-012345',
    date: '2025-02-07',
    session: '한국',
    committee: 'preparation',
    items: [{ description: '숙박비 (호텔)', budgetCode: 5862, amount: 350000 }],
    totalAmount: 350000,
    receipts: [mockReceipt('hotel_receipt.pdf')],
    requestedBy: { uid: 'mock-user-002', name: '박준혁', email: 'junhyuk@example.com' },
    approvedBy: { uid: 'mock-admin-001', name: '정신영', email: 'admin@example.com' },
    approvalSignature: null,
    approvedAt: daysAgo(6),
    rejectionReason:
      '영수증의 금액과 신청 금액이 일치하지 않습니다. 확인 후 재신청해주세요.',
    settlementId: null,
    originalRequestId: null,
    comments: '위원회 출장 숙박',
  },

  // --- SETTLED (2) ---
  {
    id: 'req-settled-001',
    createdAt: daysAgo(20),
    status: 'settled',
    payee: '이영희',
    phone: '010-3456-7890',
    bankName: '하나은행',
    bankAccount: '345-678-901234',
    date: '2025-01-25',
    session: '한국',
    committee: 'operations',
    items: [
      { description: '1월 운영위 식사비', budgetCode: 5400, amount: 450000 },
      { description: '1월 운영위 교통비', budgetCode: 5110, amount: 120000 },
    ],
    totalAmount: 570000,
    receipts: [mockReceipt('jan_meal.jpg'), mockReceipt('jan_transport.pdf')],
    requestedBy: { uid: 'mock-user-001', name: '이영희', email: 'younghee@example.com' },
    approvedBy: {
      uid: 'mock-approver-001',
      name: '김민수',
      email: 'approver@example.com',
    },
    approvalSignature: MOCK_SIGNATURE,
    approvedAt: daysAgo(18),
    rejectionReason: null,
    settlementId: 'settlement-001',
    originalRequestId: null,
    comments: '1월 운영위원회 정기 회의',
  },
  {
    id: 'req-settled-002',
    createdAt: daysAgo(22),
    status: 'settled',
    payee: '박준혁',
    phone: '010-4567-8901',
    bankName: '우리은행',
    bankAccount: '456-789-012345',
    date: '2025-01-23',
    session: '한국',
    committee: 'preparation',
    items: [
      { description: '1월 준비위 홍보물 제작', budgetCode: 5400, amount: 280000 },
      { description: '1월 준비위 팜플렛 인쇄', budgetCode: 5200, amount: 95000 },
    ],
    totalAmount: 375000,
    receipts: [mockReceipt('jan_promo.pdf'), mockReceipt('jan_pamphlet.jpg')],
    requestedBy: { uid: 'mock-user-002', name: '박준혁', email: 'junhyuk@example.com' },
    approvedBy: { uid: 'mock-admin-001', name: '정신영', email: 'admin@example.com' },
    approvalSignature: MOCK_SIGNATURE,
    approvedAt: daysAgo(20),
    rejectionReason: null,
    settlementId: 'settlement-002',
    originalRequestId: null,
    comments: '1월 준비위원회 홍보 관련',
  },
];

// ============ SETTLEMENTS (per payee) ============
const settlements = [
  {
    id: 'settlement-001',
    createdAt: daysAgo(15),
    createdBy: { uid: 'mock-admin-001', name: '정신영', email: 'admin@example.com' },
    payee: '이영희',
    phone: '010-3456-7890',
    bankName: '하나은행',
    bankAccount: '345-678-901234',
    session: '한국',
    committee: 'operations' as const,
    items: [
      { description: '1월 운영위 식사비', budgetCode: 5400, amount: 450000 },
      { description: '1월 운영위 교통비', budgetCode: 5110, amount: 120000 },
    ],
    totalAmount: 570000,
    receipts: [mockReceipt('jan_meal.jpg'), mockReceipt('jan_transport.pdf')],
    requestIds: ['req-settled-001'],
    approvedBy: {
      uid: 'mock-approver-001',
      name: '김민수',
      email: 'approver@example.com',
    },
    approvalSignature: MOCK_SIGNATURE,
  },
  {
    id: 'settlement-002',
    createdAt: daysAgo(15),
    createdBy: { uid: 'mock-admin-001', name: '정신영', email: 'admin@example.com' },
    payee: '박준혁',
    phone: '010-4567-8901',
    bankName: '우리은행',
    bankAccount: '456-789-012345',
    session: '한국',
    committee: 'preparation' as const,
    items: [
      { description: '1월 준비위 홍보물 제작', budgetCode: 5400, amount: 280000 },
      { description: '1월 준비위 팜플렛 인쇄', budgetCode: 5200, amount: 95000 },
    ],
    totalAmount: 375000,
    receipts: [mockReceipt('jan_promo.pdf'), mockReceipt('jan_pamphlet.jpg')],
    requestIds: ['req-settled-002'],
    approvedBy: { uid: 'mock-admin-001', name: '정신영', email: 'admin@example.com' },
    approvalSignature: MOCK_SIGNATURE,
  },
];

// ============ BUDGET CONFIG ============
const budgetConfig = {
  totalBudget: 10000000,
  byCode: {
    5862: 2000000,
    5110: 2000000,
    5400: 3000000,
    5200: 2000000,
    4500: 1000000,
  },
};

// ============ SEED ============
async function seed() {
  console.log('🌱 Seeding Firestore with mock data...\n');

  // Users
  console.log('👤 Creating users...');
  for (const user of users) {
    await db.collection('users').doc(user.uid).set(user);
    console.log(`   ✓ ${user.displayName} (${user.role})`);
  }

  // Requests
  console.log('\n📋 Creating payment requests...');
  for (const req of requests) {
    const { id, ...data } = req;
    await db.collection('requests').doc(id).set(data);
    console.log(
      `   ✓ ${req.payee} - ${req.status} - ₩${req.totalAmount.toLocaleString()}`,
    );
  }

  // Settlements
  console.log('\n📊 Creating settlements...');
  for (const s of settlements) {
    const { id: sId, ...sData } = s;
    await db.collection('settlements').doc(sId).set(sData);
    console.log(`   ✓ ${s.payee} - ₩${s.totalAmount.toLocaleString()}`);
  }

  // Budget Config
  console.log('\n💰 Setting budget config...');
  await db.collection('settings').doc('budget-config').set(budgetConfig);
  console.log(`   ✓ Total: ₩${budgetConfig.totalBudget.toLocaleString()}`);

  console.log('\n✅ Seed complete!');
  console.log('\n📊 Summary:');
  console.log(`   Users:      ${users.length}`);
  console.log(
    `   Requests:   ${requests.length} (3 pending, 3 approved, 2 rejected, 2 settled)`,
  );
  console.log(`   Settlements: ${settlements.length}`);
  console.log(`   Budget:     ₩${budgetConfig.totalBudget.toLocaleString()}`);
  console.log(
    '\n💡 Login with any Google account, then change your user doc\'s role to "admin" in Firestore Console to see all features.',
  );

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
