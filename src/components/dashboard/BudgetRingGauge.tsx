import { useState } from "react";
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
  const [view, setView] = useState<"bar" | "gauge">("bar");

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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-gray-700">
          {t("dashboard.budgetOverview")}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{t("dashboard.totalBudget")} <span className="font-bold text-gray-900">{"\u20A9"}{totalBudget.toLocaleString()}</span></span>
          <div className="flex border border-gray-200 rounded overflow-hidden">
            <button
              onClick={() => setView("bar")}
              className={`px-2 py-1 text-xs ${view === "bar" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Bar"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="8" width="4" height="7" rx="0.5" />
                <rect x="6" y="4" width="4" height="11" rx="0.5" />
                <rect x="11" y="1" width="4" height="14" rx="0.5" />
              </svg>
            </button>
            <button
              onClick={() => setView("gauge")}
              className={`px-2 py-1 text-xs ${view === "gauge" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Gauge"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 12L5 6L9 8L14 2" />
                <path d="M2 12L5 6L9 8L14 2" strokeOpacity="0.2" fill="currentColor" />
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
        <GaugeView
          totalBudget={totalBudget}
          approvedAmount={approvedAmount}
          pendingAmount={pendingAmount}
          breakdown={breakdown}
        />
      )}
    </div>
  );
}

function GaugeView({
  totalBudget,
  approvedAmount,
  pendingAmount,
  breakdown,
}: {
  totalBudget: number;
  approvedAmount: number;
  pendingAmount: number;
  breakdown: React.ReactNode;
}) {
  const { t } = useTranslation();
  const h = 180;
  const usedH = totalBudget > 0 ? (approvedAmount / totalBudget) * h : 0;
  const pendH = totalBudget > 0 ? (pendingAmount / totalBudget) * h : 0;
  const usedY = h - usedH;
  const pendY = h - usedH - pendH;

  const fmt = (v: number) => `\u20A9${v.toLocaleString()}`;

  return (
    <div className="flex gap-6 items-center">
      <div className="shrink-0">
        <svg width="200" height={h + 20} viewBox={`0 0 200 ${h + 20}`}>
          {/* Background */}
          <rect x="60" y="10" width="40" height={h} rx="4" fill="#F3F4F6" />

          {/* Pending area */}
          {pendH > 0 && (
            <rect x="60" y={pendY + 10} width="40" height={pendH} fill="#FDE68A" />
          )}

          {/* Used area */}
          {usedH > 0 && (
            <rect x="60" y={usedY + 10} width="40" height={usedH} rx={usedY + usedH >= h ? 4 : 0} fill="#3B82F6" />
          )}

          {/* Top round corners */}
          <rect x="60" y="10" width="40" height="8" rx="4" fill="#F3F4F6" />
          {pendH > 0 && pendY + 10 <= 14 && (
            <rect x="60" y="10" width="40" height="8" rx="4" fill="#FDE68A" />
          )}

          {/* Total budget line */}
          <line x1="50" y1="10" x2="108" y2="10" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="3 2" />
          <text x="112" y="14" fontSize="10" fill="#6B7280">{fmt(totalBudget)}</text>

          {/* Used line */}
          {usedH > 0 && usedY > 4 && (
            <>
              <line x1="50" y1={usedY + 10} x2="108" y2={usedY + 10} stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 2" />
              <text x="112" y={usedY + 14} fontSize="10" fill="#3B82F6">
                {t("dashboard.used")}
              </text>
            </>
          )}

          {/* Pending line */}
          {pendH > 0 && pendY > 4 && Math.abs(pendY - usedY) > 16 && (
            <>
              <line x1="50" y1={pendY + 10} x2="108" y2={pendY + 10} stroke="#EAB308" strokeWidth="1" strokeDasharray="3 2" />
              <text x="112" y={pendY + 14} fontSize="10" fill="#EAB308">
                {t("dashboard.pendingAmount")}
              </text>
            </>
          )}

          {/* Zero line */}
          <line x1="50" y1={h + 10} x2="108" y2={h + 10} stroke="#D1D5DB" strokeWidth="1" />
          <text x="112" y={h + 14} fontSize="10" fill="#9CA3AF">0</text>

          {/* Left labels */}
          <text x="46" y={h + 14} fontSize="10" fill="#9CA3AF" textAnchor="end">0%</text>
          <text x="46" y="14" fontSize="10" fill="#9CA3AF" textAnchor="end">100%</text>
        </svg>
      </div>
      <div className="flex-1">
        {breakdown}
      </div>
    </div>
  );
}
