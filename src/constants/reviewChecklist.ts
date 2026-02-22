export interface ChecklistItem {
  key: string // i18n key suffix
}

// 검토 단계 (pending → reviewed)
export const REVIEW_CHECKLIST: ChecklistItem[] = [
  { key: 'receiptsMatchItems' },
  { key: 'amountsCorrect' },
  { key: 'budgetCodesValid' },
  { key: 'bankBookNameMatches' },
]

// 승인 단계 (reviewed → approved)
export const APPROVAL_CHECKLIST: ChecklistItem[] = [
  { key: 'itemsAppropriate' },
  { key: 'budgetSufficient' },
  { key: 'bankBookNameMatches' },
]

// 정산 리뷰 단계
export const SETTLEMENT_CHECKLIST: ChecklistItem[] = [
  { key: 'receiptsMatchItems' },
  { key: 'approvalSignatureExists' },
  { key: 'bankBookNameMatches' },
]

// 신청서 제출 전 확인사항
export const SUBMISSION_CHECKLIST: ChecklistItem[] = [
  { key: 'receiptsMatchItems' },
  { key: 'amountsCorrect' },
  { key: 'budgetCodesValid' },
  { key: 'bankBookNameMatches' },
  { key: 'bankBookCorrect' },
]
