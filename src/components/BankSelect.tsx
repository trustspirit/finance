import { useTranslation } from 'react-i18next'
import { BANKS } from '../constants/banks'
import Select from './Select'

interface Props {
  value: string
  onChange: (bankName: string) => void
  label?: string
  required?: boolean
}

export default function BankSelect({ value, onChange, label, required }: Props) {
  const { t } = useTranslation()
  const isKnownBank = !value || BANKS.some(b => b.name === value)

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      label={label ?? `${t('field.bankSelect')} ${required ? '*' : ''}`}
    >
      <option value="">{t('field.bankSelect')}</option>
      {!isKnownBank && (
        <option value={value}>{value} (기존 입력)</option>
      )}
      {BANKS.map((bank) => (
        <option key={bank.code} value={bank.name}>
          {bank.name}
        </option>
      ))}
    </Select>
  )
}
