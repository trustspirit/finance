import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { useTranslation } from "react-i18next";
import { UNIQUE_BUDGET_CODES } from "../../constants/budgetCodes";

interface Props {
  byBudgetCode: Record<
    number,
    { count: number; amount: number; approvedAmount: number }
  >;
  budgetByCode: Record<number, number>;
  hasBudget: boolean;
}

export default function BudgetCodeBarChart({
  byBudgetCode,
  budgetByCode,
  hasBudget,
}: Props) {
  const { t, i18n } = useTranslation();

  const data = UNIQUE_BUDGET_CODES.map((code) => {
    const d = byBudgetCode[code] || { count: 0, amount: 0, approvedAmount: 0 };
    const allocated = budgetByCode[code] || 0;
    const over = hasBudget && allocated > 0 && d.approvedAmount > allocated;
    return {
      name: t(`budgetCode.${code}`),
      code,
      allocated,
      approved: d.approvedAmount,
      over,
    };
  }).filter((d) => d.approved > 0 || d.allocated > 0);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          {t("dashboard.byBudgetCode")}
        </h3>
        <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
          {t("common.noData")}
        </div>
      </div>
    );
  }

  const formatAxis = (v: number) =>
    v >= 10000
      ? `${(v / 10000).toFixed(0)}${i18n.language === "ko" ? "\uB9CC" : "k"}`
      : v.toLocaleString();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">
        {t("dashboard.byBudgetCode")}
      </h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              tickFormatter={formatAxis}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={100}
            />
            <Tooltip
              formatter={(v: number | undefined) =>
                `\u20A9${(v ?? 0).toLocaleString()}`
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {hasBudget && (
              <Bar
                dataKey="allocated"
                name={t("dashboard.allocatedBudget")}
                fill="#D1D5DB"
                radius={[0, 4, 4, 0]}
              />
            )}
            <Bar
              dataKey="approved"
              name={t("dashboard.approvedAmount")}
              radius={[0, 4, 4, 0]}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.code}
                  fill={entry.over ? "#EF4444" : "#3B82F6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
