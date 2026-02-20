import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useTranslation } from 'react-i18next'

const STATUS_COLORS: Record<string, string> = {
  pending: '#EAB308',
  approved: '#22C55E',
  settled: '#A855F7',
  rejected: '#EF4444',
}

interface Props {
  pending: number
  approved: number
  settled: number
  rejected: number
}

export default function StatusDonutChart({ pending, approved, settled, rejected }: Props) {
  const { t } = useTranslation()
  const total = pending + approved + settled + rejected

  const data = [
    { name: t('status.pending'), value: pending, key: 'pending' },
    { name: t('status.approved'), value: approved, key: 'approved' },
    { name: t('status.settled'), value: settled, key: 'settled' },
    { name: t('status.rejected'), value: rejected, key: 'rejected' },
  ].filter(d => d.value > 0)

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">{t('dashboard.statusDistribution')}</h3>
        <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
          {t('common.noData')}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">{t('dashboard.statusDistribution')}</h3>
      <div className="relative h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | undefined, name?: string) => [t('form.itemCount', { count: value ?? 0 }), name ?? '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-gray-500">{t('dashboard.totalRequests')}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {data.map(d => (
          <div key={d.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.key] }} />
            <span className="text-gray-600">{d.name} {d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
