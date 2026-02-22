import { useState } from "react";
import { useTranslation } from "react-i18next";
import MonthlyTrendChart from "./MonthlyTrendChart";
import CommitteeBarChart from "./CommitteeBarChart";
import BudgetCodeBarChart from "./BudgetCodeBarChart";

type ChartTab = "monthly" | "committee" | "budgetCode";

export default function TabbedCharts({
  requests,
  byCommittee,
  byBudgetCode,
  budgetByCode,
  hasBudget,
}: {
  requests: { date: string; totalAmount: number }[];
  byCommittee: Record<
    string,
    { count: number; amount: number; approvedAmount: number }
  >;
  byBudgetCode: Record<
    number,
    { count: number; amount: number; approvedAmount: number }
  >;
  budgetByCode: Record<number, number>;
  hasBudget: boolean;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ChartTab>("monthly");

  const tabs: { key: ChartTab; label: string }[] = [
    { key: "monthly", label: t("dashboard.requestTrend") },
    { key: "committee", label: t("dashboard.byCommittee") },
    { key: "budgetCode", label: t("dashboard.byBudgetCode") },
  ];

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="border-b px-4 flex gap-1 overflow-x-auto">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === item.key
                ? "border-blue-600 text-blue-600 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "monthly" && <MonthlyTrendChart requests={requests} />}
        {tab === "committee" && (
          <CommitteeBarChart byCommittee={byCommittee} />
        )}
        {tab === "budgetCode" && (
          <BudgetCodeBarChart
            byBudgetCode={byBudgetCode}
            budgetByCode={budgetByCode}
            hasBudget={hasBudget}
          />
        )}
      </div>
    </div>
  );
}
