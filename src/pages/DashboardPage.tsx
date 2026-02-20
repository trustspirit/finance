import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useProject } from "../contexts/ProjectContext";
import { UNIQUE_BUDGET_CODES } from "../constants/budgetCodes";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import BudgetWarningBanner from "../components/BudgetWarningBanner";
import { DocumentIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from "../components/Icons";
import BudgetRingGauge from "../components/dashboard/BudgetRingGauge";
import MonthlyTrendChart from "../components/dashboard/MonthlyTrendChart";
import CommitteeBarChart from "../components/dashboard/CommitteeBarChart";
import BudgetCodeBarChart from "../components/dashboard/BudgetCodeBarChart";
import { useRequests } from "../hooks/queries/useRequests";
import { useBudgetUsage } from "../hooks/useBudgetUsage";
import { useUpdateProject } from "../hooks/queries/useProjects";

interface BudgetConfig {
  totalBudget: number;
  byCode: Record<number, number>;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  approvedOnly: number;
  settled: number;
  rejected: number;
  totalAmount: number;
  approvedAmount: number;
  approvedOnlyAmount: number;
  settledAmount: number;
  pendingAmount: number;
  byCommittee: Record<
    string,
    { count: number; amount: number; approvedAmount: number }
  >;
  byBudgetCode: Record<
    number,
    { count: number; amount: number; approvedAmount: number }
  >;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { appUser } = useAuth();
  const { currentProject } = useProject();
  const [budget, setBudget] = useState<BudgetConfig>({
    totalBudget: 0,
    byCode: {},
  });
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState<BudgetConfig>({
    totalBudget: 0,
    byCode: {},
  });
  const [savingBudget, setSavingBudget] = useState(false);
  const [documentNo, setDocumentNo] = useState("");
  const [editingDocNo, setEditingDocNo] = useState(false);
  const [tempDocNo, setTempDocNo] = useState("");
  const [savingDocNo, setSavingDocNo] = useState(false);

  const {
    data: requests = [],
    isLoading: loading,
    error,
  } = useRequests(currentProject?.id);
  const updateProject = useUpdateProject();
  const budgetUsage = useBudgetUsage();

  const stats = useMemo(() => {
    if (requests.length === 0) return null;

    const total = requests.length;
    const pending = requests.filter((r) => r.status === "pending").length;
    const approvedOnly = requests.filter((r) => r.status === "approved").length;
    const settled = requests.filter((r) => r.status === "settled").length;
    const approved = approvedOnly + settled;
    const rejected = requests.filter((r) => r.status === "rejected").length;
    const totalAmount = requests.reduce((sum, r) => sum + r.totalAmount, 0);
    const approvedOnlyAmount = requests
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const settledAmount = requests
      .filter((r) => r.status === "settled")
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const approvedAmount = approvedOnlyAmount + settledAmount;
    const pendingAmount = requests
      .filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const byCommittee: Stats["byCommittee"] = {};
    const byBudgetCode: Stats["byBudgetCode"] = {};

    requests.forEach((r) => {
      const committee = r.committee || "operations";
      if (!byCommittee[committee])
        byCommittee[committee] = { count: 0, amount: 0, approvedAmount: 0 };
      byCommittee[committee].count++;
      byCommittee[committee].amount += r.totalAmount;
      if (r.status === "approved" || r.status === "settled")
        byCommittee[committee].approvedAmount += r.totalAmount;

      r.items.forEach((item) => {
        if (!byBudgetCode[item.budgetCode])
          byBudgetCode[item.budgetCode] = {
            count: 0,
            amount: 0,
            approvedAmount: 0,
          };
        byBudgetCode[item.budgetCode].count++;
        byBudgetCode[item.budgetCode].amount += item.amount;
        if (r.status === "approved" || r.status === "settled")
          byBudgetCode[item.budgetCode].approvedAmount += item.amount;
      });
    });

    return {
      total,
      pending,
      approved,
      approvedOnly,
      settled,
      rejected,
      totalAmount,
      approvedAmount,
      approvedOnlyAmount,
      settledAmount,
      pendingAmount,
      byCommittee,
      byBudgetCode,
    };
  }, [requests]);

  // Initialize budget and documentNo from currentProject
  useEffect(() => {
    if (currentProject?.budgetConfig) {
      setBudget(currentProject.budgetConfig);
      setTempBudget(currentProject.budgetConfig);
    }
    if (currentProject?.documentNo) {
      setDocumentNo(currentProject.documentNo);
      setTempDocNo(currentProject.documentNo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  const canEditBudget =
    appUser?.role === "admin" || appUser?.role === "finance";

  const handleSaveBudget = () => {
    if (!currentProject?.id) return;
    setSavingBudget(true);
    updateProject.mutate(
      {
        projectId: currentProject!.id,
        data: { budgetConfig: tempBudget },
      },
      {
        onSuccess: () => {
          setBudget(tempBudget);
          setEditingBudget(false);
          setSavingBudget(false);
        },
        onError: () => {
          setSavingBudget(false);
        },
      },
    );
  };

  const handleSaveDocNo = () => {
    if (!currentProject?.id) return;
    setSavingDocNo(true);
    updateProject.mutate(
      {
        projectId: currentProject!.id,
        data: { documentNo: tempDocNo },
      },
      {
        onSuccess: () => {
          setDocumentNo(tempDocNo);
          setEditingDocNo(false);
          setSavingDocNo(false);
        },
        onError: () => {
          setSavingDocNo(false);
        },
      },
    );
  };

  if (loading)
    return (
      <Layout>
        <Spinner />
      </Layout>
    );
  if (error)
    return (
      <Layout>
        <div className="text-center py-16 text-red-500">
          {t("common.loadError")}
        </div>
      </Layout>
    );
  if (!stats)
    return (
      <Layout>
        <div className="text-center py-16 text-gray-500">
          {t("common.noData")}
        </div>
      </Layout>
    );

  return (
    <Layout>
      <h2 className="text-xl font-bold mb-6">{t("dashboard.title")}</h2>

      <BudgetWarningBanner budgetUsage={budgetUsage} className="mb-6" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t("dashboard.totalRequests")}
          value={t("form.itemCount", { count: stats.total })}
          icon={<DocumentIcon className="w-4 h-4 text-gray-400" />}
        />
        <StatCard
          label={t("dashboard.pendingRequests")}
          value={`${t("form.itemCount", { count: stats.pending })} (\u20A9${stats.pendingAmount.toLocaleString()})`}
          color="yellow"
          icon={<ClockIcon className="w-4 h-4 text-yellow-500" />}
        />
        <div className="rounded-lg shadow border p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500">
              {t("dashboard.approvedRequests")}
            </p>
          </div>
          <p className="text-lg font-bold">
            {t("form.itemCount", { count: stats.approved })} ({"\u20A9"}
            {stats.approvedAmount.toLocaleString()})
          </p>
          <div className="mt-2 pt-2 border-t border-green-200 space-y-0.5">
            <p className="text-xs text-gray-500">
              {t("dashboard.settledCount", { count: stats.settled })} {"\u20A9"}
              {stats.settledAmount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">
              {t("dashboard.unsettledCount", { count: stats.approvedOnly })}{" "}
              {"\u20A9"}
              {stats.approvedOnlyAmount.toLocaleString()}
            </p>
          </div>
        </div>
        <StatCard
          label={t("dashboard.rejectedRequests")}
          value={t("form.itemCount", { count: stats.rejected })}
          color="red"
          icon={<XCircleIcon className="w-4 h-4 text-red-500" />}
        />
      </div>

      {/* Budget Ring Gauge */}
      <div className="mb-6">
        <BudgetRingGauge
          totalBudget={budget.totalBudget}
          approvedAmount={stats.approvedAmount}
          pendingAmount={stats.pendingAmount}
        />
      </div>

      {/* Tabbed Charts */}
      <TabbedCharts
        requests={requests}
        byCommittee={stats.byCommittee}
        byBudgetCode={stats.byBudgetCode}
        budgetByCode={budget.byCode}
        hasBudget={budget.totalBudget > 0}
      />

      {/* Budget Settings */}
      {canEditBudget && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">
              {t("dashboard.budgetSettings")}
            </h3>
            {!editingBudget ? (
              <button
                onClick={() => {
                  setTempBudget(budget);
                  setEditingBudget(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {t("common.edit")}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingBudget(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSaveBudget}
                  disabled={savingBudget}
                  className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {savingBudget ? t("common.saving") : t("common.save")}
                </button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">
              {t("dashboard.totalBudget")}
            </label>
            {editingBudget ? (
              <input
                type="number"
                value={tempBudget.totalBudget || ""}
                onChange={(e) =>
                  setTempBudget({
                    ...tempBudget,
                    totalBudget: parseInt(e.target.value) || 0,
                  })
                }
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-48"
                placeholder="0"
              />
            ) : (
              <p className="text-sm font-medium">
                {"\u20A9"}
                {budget.totalBudget.toLocaleString()}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Code</th>
                  <th className="text-left py-2">{t("field.comments")}</th>
                  <th className="text-right py-2">
                    {t("dashboard.allocatedBudget")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {UNIQUE_BUDGET_CODES.map((code) => (
                  <tr key={code}>
                    <td className="py-2 font-mono">{code}</td>
                    <td className="py-2 text-gray-500">
                      {t(`budgetCode.${code}`)}
                    </td>
                    <td className="py-2 text-right">
                      {editingBudget ? (
                        <input
                          type="number"
                          value={tempBudget.byCode[code] || ""}
                          onChange={(e) =>
                            setTempBudget({
                              ...tempBudget,
                              byCode: {
                                ...tempBudget.byCode,
                                [code]: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-full sm:w-36 text-right"
                          placeholder="0"
                        />
                      ) : (
                        <span>
                          {budget.byCode[code]
                            ? `\u20A9${budget.byCode[code].toLocaleString()}`
                            : "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {(() => {
                const currentBudget = editingBudget ? tempBudget : budget;
                const codeTotal = Object.values(currentBudget.byCode).reduce(
                  (sum, v) => sum + (v || 0),
                  0,
                );
                const diff = codeTotal - currentBudget.totalBudget;
                const hasTotal = currentBudget.totalBudget > 0;
                return (
                  <tfoot className="border-t">
                    <tr>
                      <td colSpan={2} className="py-2 text-right font-medium">
                        {t("dashboard.codeTotal")}
                      </td>
                      <td className="py-2 text-right font-bold">
                        {"\u20A9"}
                        {codeTotal.toLocaleString()}
                      </td>
                    </tr>
                    {hasTotal && diff !== 0 && (
                      <tr>
                        <td colSpan={2} className="py-2 text-right font-medium">
                          {t("dashboard.difference")}
                        </td>
                        <td
                          className={`py-2 text-right font-bold ${diff > 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {diff > 0 ? "+" : ""}
                          {`\u20A9${diff.toLocaleString()}`}
                        </td>
                      </tr>
                    )}
                    {hasTotal && diff === 0 && (
                      <tr>
                        <td colSpan={2} className="py-2 text-right font-medium">
                          {t("dashboard.difference")}
                        </td>
                        <td className="py-2 text-right font-bold text-green-600">
                          {"\u20A9"}0
                        </td>
                      </tr>
                    )}
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      )}
      {/* Document No. Settings */}
      {canEditBudget && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">
              {t("dashboard.documentNoSettings")}
            </h3>
            {!editingDocNo ? (
              <button
                onClick={() => {
                  setTempDocNo(documentNo);
                  setEditingDocNo(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {t("common.edit")}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingDocNo(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSaveDocNo}
                  disabled={savingDocNo}
                  className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {savingDocNo ? t("common.saving") : t("common.save")}
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {t("dashboard.documentNo")}
            </label>
            {editingDocNo ? (
              <input
                type="text"
                value={tempDocNo}
                onChange={(e) => setTempDocNo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full font-mono"
                placeholder="KOR01-6762808-5xxx-KYSA2025KOR"
              />
            ) : (
              <p className="text-sm font-mono font-medium">
                {documentNo || t("dashboard.notSet")}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {t("dashboard.documentNoHint")}
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}

type ChartTab = "monthly" | "committee" | "budgetCode";

function TabbedCharts({
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
    { key: "monthly", label: t("dashboard.monthlyTrend") },
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

function StatCard({
  label,
  value,
  color = "gray",
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    gray: "bg-white",
    yellow: "bg-yellow-50 border-yellow-200",
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    red: "bg-red-50 border-red-200",
  };
  return (
    <div className={`rounded-lg shadow border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
