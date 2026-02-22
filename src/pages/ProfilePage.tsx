import { useTranslation } from 'react-i18next'
import Layout from '../components/Layout'
import PersonalSettings from '../components/settings/PersonalSettings'

export default function ProfilePage() {
  const { t } = useTranslation()

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6">{t('project.personalSettings')}</h2>
        <PersonalSettings />
      </div>
    </Layout>
  )
}
