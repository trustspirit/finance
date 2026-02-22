import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";

interface Props {
  byCommittee: Record<
    string,
    { count: number; amount: number; approvedAmount: number }
  >;
}

export default function CommitteeBarChart({ byCommittee }: Props) {
  const { t, i18n } = useTranslation();

  const data = Object.entries(byCommittee).map(([key, d]) => ({
    name: t(`committee.${key}`, key),
    total: d.amount,
    approved: d.approvedAmount,
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
        {t("common.noData")}
      </div>
    );
  }

  const formatYAxis = (v: number) => {
    const isKo = i18n.language === "ko";
    if (v >= 100000000) return `${(v / 100000000).toFixed(v % 100000000 === 0 ? 0 : 1)}${isKo ? "억" : "B"}`;
    if (v >= 10000) return `${(v / 10000).toFixed(0)}${isKo ? "만" : "k"}`;
    return v.toLocaleString();
  };

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
          <Tooltip
            formatter={(v: number | undefined) =>
              `\u20A9${(v ?? 0).toLocaleString()}`
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="total"
            name={t("dashboard.amount")}
            fill="#D1D5DB"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="approved"
            name={t("dashboard.approvedAmount")}
            fill="#3B82F6"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
