import { BANKS } from '../constants/banks'

/** 전화번호 자동 포맷 (010-0000-0000) */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

/** 계좌번호 자동 포맷 (은행별 패턴) */
export function formatBankAccount(value: string, bankName: string): string {
  const bank = BANKS.find(b => b.name === bankName)
  const digits = value.replace(/\D/g, '').slice(0, bank?.maxDigits ?? 16)
  if (!bank) return digits

  let result = ''
  let pos = 0
  for (const len of bank.format) {
    if (pos >= digits.length) break
    if (pos > 0) result += '-'
    result += digits.slice(pos, pos + len)
    pos += len
  }
  return result
}

/** File → base64 data URL 변환 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}

/** Firestore Timestamp → 한국어 날짜 문자열 */
export function formatFirestoreDate(date: unknown): string {
  if (date && typeof date === 'object' && 'toDate' in date) {
    return (date as { toDate: () => Date }).toDate().toLocaleDateString('ko-KR')
  }
  return '-'
}

/** Firestore Timestamp → HH:MM 시간 문자열 */
export function formatFirestoreTime(date: unknown): string {
  if (date && typeof date === 'object' && 'toDate' in date) {
    const d = (date as { toDate: () => Date }).toDate()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return ''
}

/** 파일 유효성 검증 (허용 형식 + 용량) */
export function validateFiles(files: File[], t?: (key: string, opts?: Record<string, unknown>) => string): { valid: File[]; errors: string[] } {
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf']
  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf']
  const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

  const errors: string[] = []
  const valid: File[] = []

  for (const f of files) {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_TYPES.includes(f.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push(t
        ? t('validation.invalidFileType', { name: f.name })
        : `"${f.name}" - Invalid format (PNG, JPG, PDF only)`)
    } else if (f.size > MAX_FILE_SIZE) {
      errors.push(t
        ? t('validation.fileTooLarge', { name: f.name, size: (f.size / 1024 / 1024).toFixed(1) })
        : `"${f.name}" - Exceeds 2MB (${(f.size / 1024 / 1024).toFixed(1)}MB)`)
    } else {
      valid.push(f)
    }
  }

  return { valid, errors }
}

/** 통장사본 파일 검증 (PNG/JPG/PDF, 800KB 이하) */
export function validateBankBookFile(file: File): string | null {
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf']
  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf']
  const MAX_SIZE = 800 * 1024 // 800KB

  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return `PNG, JPG, PDF only`
  }
  if (file.size > MAX_SIZE) {
    return `Max 800KB (${(file.size / 1024).toFixed(0)}KB)`
  }
  return null
}
