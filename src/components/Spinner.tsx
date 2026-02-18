import { useTranslation } from 'react-i18next'

export default function Spinner({ text }: { text?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin mb-3" />
      <p className="text-sm text-gray-500">{text ?? t('common.loading')}</p>
    </div>
  )
}
