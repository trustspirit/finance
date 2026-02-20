import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";

interface Props {
  requests: { date: string; totalAmount: number }[];
}

export default function MonthlyTrendChart({ requests }: Props) {
  const { t, i18n } = useTranslation();

  const data = useMemo(() => {
    const now = new Date();
    const months: {
      month: string;
      label: string;
      count: number;
      amount: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(i18n.language, { month: "short" });
      months.push({ month: key, label, count: 0, amount: 0 });
    }

    requests.forEach((r) => {
      if (!r.date) return;
      const key = r.date.substring(0, 7);
      const entry = months.find((m) => m.month === key);
      if (entry) {
        entry.count++;
        entry.amount += r.totalAmount;
      }
    });

    return months;
  }, [requests, i18n.language]);

  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) =>
                v >= 10000
                  ? `${(v / 10000).toFixed(0)}${i18n.language === "ko" ? "\uB9CC" : "k"}`
                  : v.toLocaleString()
              }
            />
            <Tooltip
              formatter={(value: number | undefined, name?: string) => {
                const v = value ?? 0;
                if (name === "count")
                  return [
                    t("form.itemCount", { count: v }),
                    t("dashboard.requestCount"),
                  ];
                return [
                  `\u20A9${v.toLocaleString()}`,
                  t("dashboard.requestAmount"),
                ];
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="count"
              name="count"
              stroke="#3B82F6"
              fill="url(#colorCount)"
              strokeWidth={2}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="amount"
              name="amount"
              stroke="#10B981"
              fill="url(#colorAmount)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-0.5 bg-blue-500 rounded" />
          <span className="text-gray-600">{t("dashboard.requestCount")}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-0.5 bg-emerald-500 rounded" />
          <span className="text-gray-600">{t("dashboard.requestAmount")}</span>
        </div>
      </div>
    </>
  );
}
