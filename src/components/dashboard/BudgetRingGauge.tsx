import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<"bar" | "chart">("bar");

  const remaining = Math.max(0, totalBudget - approvedAmount - pendingAmount);
  const usagePercent =
    totalBudget > 0 ? Math.round((approvedAmount / totalBudget) * 100) : 0;
  const pendingPercent =
    totalBudget > 0 ? Math.round((pendingAmount / totalBudget) * 100) : 0;
  const combinedPercent = Math.min(usagePercent + pendingPercent, 100);
  const overBudget = approvedAmount + pendingAmount > totalBudget;

  if (totalBudget === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          {t("dashboard.budgetOverview")}
        </h3>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-500">{t("dashboard.totalBudget")}</p>
            <p className="text-lg font-bold text-gray-400">{t("dashboard.notSet")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("dashboard.used")}</p>
            <p className="text-lg font-bold text-blue-600">{"\u20A9"}{approvedAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("dashboard.pendingAmount")}</p>
            <p className="text-lg font-bold text-yellow-600">{"\u20A9"}{pendingAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  const breakdown = (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${overBudget ? "bg-red-500" : "bg-blue-500"}`} />
        <div>
          <p className="text-xs text-gray-500">{t("dashboard.used")}</p>
          <p className={`text-sm font-bold ${overBudget ? "text-red-600" : "text-blue-600"}`}>
            {"\u20A9"}{approvedAmount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">{usagePercent}%</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
        <div>
          <p className="text-xs text-gray-500">{t("dashboard.pendingAmount")}</p>
          <p className="text-sm font-bold text-yellow-600">
            {"\u20A9"}{pendingAmount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">{pendingPercent}%</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-gray-200 shrink-0" />
        <div>
          <p className="text-xs text-gray-500">{t("dashboard.remaining")}</p>
          <p className={`text-sm font-bold ${remaining <= 0 ? "text-red-600" : "text-green-600"}`}>
            {"\u20A9"}{(totalBudget - approvedAmount).toLocaleString()}
          </p>
          {remaining > 0 && (
            <p className="text-xs text-gray-400">{100 - usagePercent - pendingPercent}%</p>
          )}
        </div>
      </div>
    </div>
  );

  const formatAxis = (v: number) =>
    v >= 10000
      ? `${(v / 10000).toFixed(0)}${i18n.language === "ko" ? "\uB9CC" : "k"}`
      : v.toLocaleString();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-gray-700">
          {t("dashboard.budgetOverview")}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {t("dashboard.totalBudget")}{" "}
            <span className="font-bold text-gray-900">{"\u20A9"}{totalBudget.toLocaleString()}</span>
          </span>
          <div className="flex border border-gray-200 rounded overflow-hidden">
            <button
              onClick={() => setView("bar")}
              className={`px-2 py-1 ${view === "bar" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="8" width="4" height="7" rx="0.5" />
                <rect x="6" y="4" width="4" height="11" rx="0.5" />
                <rect x="11" y="1" width="4" height="14" rx="0.5" />
              </svg>
            </button>
            <button
              onClick={() => setView("chart")}
              className={`px-2 py-1 ${view === "chart" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 12L5 6L9 8L14 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {view === "bar" ? (
        <>
          <div className="mb-4">
            <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden flex">
              {usagePercent > 0 && (
                <div
                  className={`h-full transition-all ${overBudget ? "bg-red-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              )}
              {pendingPercent > 0 && (
                <div
                  className="h-full bg-yellow-400 transition-all"
                  style={{ width: `${Math.min(pendingPercent, 100 - Math.min(usagePercent, 100))}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1">
              <span className={`text-xs font-medium ${overBudget ? "text-red-600" : "text-blue-600"}`}>
                {combinedPercent}%
              </span>
              <span className="text-xs text-gray-400">100%</span>
            </div>
          </div>
          {breakdown}
        </>
      ) : (
        <>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { x: "", total: totalBudget, combined: approvedAmount + pendingAmount, used: approvedAmount },
                  { x: " ", total: totalBudget, combined: approvedAmount + pendingAmount, used: approvedAmount },
                ]}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="budgetUsed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="budgetPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="x" tick={false} axisLine={false} />
                <YAxis
                  domain={[0, Math.ceil(totalBudget * 1.1)]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatAxis}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number | undefined) => `\u20A9${(v ?? 0).toLocaleString()}`}
                />
                <Area
                  type="monotone"
                  dataKey="combined"
                  name={t("dashboard.used") + " + " + t("dashboard.pendingAmount")}
                  stroke="#EAB308"
                  strokeWidth={2}
                  fill="url(#budgetPending)"
                />
                <Area
                  type="monotone"
                  dataKey="used"
                  name={t("dashboard.used")}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#budgetUsed)"
                />
                <ReferenceLine
                  y={totalBudget}
                  stroke="#9CA3AF"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{
                    value: `${t("dashboard.totalBudget")} \u20A9${totalBudget.toLocaleString()}`,
                    position: "insideTopLeft",
                    fontSize: 11,
                    fill: "#6B7280",
                    offset: 8,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3">
            {breakdown}
          </div>
        </>
      )}
    </div>
  );
}
