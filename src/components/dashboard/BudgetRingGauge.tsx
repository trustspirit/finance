import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";

interface Props {
  totalBudget: number;
  approvedAmount: number;
  pendingAmount: number;
}

export default function BudgetRingGauge({
  totalBudget,
  approvedAmount,
  pendingAmount,
}: Props) {
  const { t } = useTranslation();

  const remaining = Math.max(0, totalBudget - approvedAmount - pendingAmount);
  const usagePercent =
    totalBudget > 0 ? Math.round((approvedAmount / totalBudget) * 100) : 0;

  if (totalBudget === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          {t("dashboard.budgetOverview")}
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500">
              {t("dashboard.totalBudget")}
            </p>
            <p className="text-lg font-bold text-gray-400">
              {t("dashboard.notSet")}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("dashboard.used")}</p>
            <p className="text-lg font-bold text-blue-600">
              {"\u20A9"}
              {approvedAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t("dashboard.pendingAmount")}
            </p>
            <p className="text-lg font-bold text-yellow-600">
              {"\u20A9"}
              {pendingAmount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const segments = [
    { name: t("dashboard.used"), value: approvedAmount, fill: "#3B82F6" },
    {
      name: t("dashboard.pendingAmount"),
      value: pendingAmount,
      fill: "#EAB308",
    },
    { name: t("dashboard.remaining"), value: remaining, fill: "#E5E7EB" },
  ].filter((d) => d.value > 0);

  if (segments.length === 0) {
    segments.push({
      name: t("dashboard.remaining"),
      value: totalBudget,
      fill: "#E5E7EB",
    });
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">
        {t("dashboard.budgetOverview")}
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-[180px] h-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                paddingAngle={1}
                dataKey="value"
              >
                {segments.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p
                className={`text-2xl font-bold ${usagePercent > 90 ? "text-red-600" : usagePercent > 70 ? "text-yellow-600" : "text-blue-600"}`}
              >
                {usagePercent}%
              </p>
              <p className="text-xs text-gray-500">{t("dashboard.used")}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">
              {t("dashboard.totalBudget")}
            </p>
            <p className="text-lg font-bold">
              {"\u20A9"}
              {totalBudget.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("dashboard.used")}</p>
            <p className="text-lg font-bold text-blue-600">
              {"\u20A9"}
              {approvedAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t("dashboard.pendingAmount")}
            </p>
            <p className="text-lg font-bold text-yellow-600">
              {"\u20A9"}
              {pendingAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("dashboard.remaining")}</p>
            <p
              className={`text-lg font-bold ${totalBudget - approvedAmount <= 0 ? "text-red-600" : "text-green-600"}`}
            >
              {"\u20A9"}
              {(totalBudget - approvedAmount).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {segments
          .filter((s) => s.fill !== "#E5E7EB")
          .map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: s.fill }}
              />
              <span className="text-gray-600">{s.name}</span>
            </div>
          ))}
        {remaining > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <span className="text-gray-600">{t("dashboard.remaining")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
