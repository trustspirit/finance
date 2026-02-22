export interface BankInfo {
  code: string
  name: string
  format: number[]
  maxDigits: number
}

export const BANKS: BankInfo[] = [
  { code: 'kb', name: 'KB국민은행', format: [3, 2, 4, 3], maxDigits: 12 },
  { code: 'shinhan', name: '신한은행', format: [3, 3, 6], maxDigits: 12 },
  { code: 'woori', name: '우리은행', format: [4, 3, 6], maxDigits: 13 },
  { code: 'hana', name: '하나은행', format: [3, 6, 5], maxDigits: 14 },
  { code: 'ibk', name: 'IBK기업은행', format: [3, 6, 2, 3], maxDigits: 14 },
  { code: 'nh', name: 'NH농협', format: [3, 4, 4, 2], maxDigits: 13 },
  { code: 'kakao', name: '카카오뱅크', format: [4, 2, 7], maxDigits: 13 },
  { code: 'toss', name: '토스뱅크', format: [4, 4, 4], maxDigits: 12 },
  { code: 'sc', name: 'SC제일은행', format: [3, 2, 6], maxDigits: 11 },
  { code: 'daegu', name: '대구은행', format: [3, 2, 6, 1], maxDigits: 12 },
  { code: 'busan', name: '부산은행', format: [3, 4, 4, 2], maxDigits: 13 },
  { code: 'gwangju', name: '광주은행', format: [3, 3, 6], maxDigits: 12 },
  { code: 'jeonbuk', name: '전북은행', format: [3, 2, 7], maxDigits: 12 },
  { code: 'jeju', name: '제주은행', format: [2, 2, 6], maxDigits: 10 },
  { code: 'suhyup', name: '수협', format: [3, 2, 6], maxDigits: 11 },
  { code: 'saemaeul', name: '새마을금고', format: [4, 2, 7], maxDigits: 13 },
  { code: 'shinhyup', name: '신협', format: [3, 3, 6], maxDigits: 12 },
  { code: 'post', name: '우체국', format: [6, 2, 6], maxDigits: 14 },
  { code: 'kdb', name: 'KDB산업은행', format: [3, 7, 3], maxDigits: 13 },
  { code: 'kyongnam', name: '경남은행', format: [3, 2, 7], maxDigits: 12 },
  { code: 'kfcc', name: '산림조합', format: [3, 3, 6], maxDigits: 12 },
]
