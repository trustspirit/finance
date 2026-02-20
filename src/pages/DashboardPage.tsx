import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useProject } from "../contexts/ProjectContext";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import StatCard from "../components/StatCard";
import BudgetWarningBanner from "../components/BudgetWarningBanner";
import {
  DocumentIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "../components/Icons";
import BudgetRingGauge from "../components/dashboard/BudgetRingGauge";
import TabbedCharts from "../components/dashboard/TabbedCharts";
import BudgetSettingsSection from "../components/dashboard/BudgetSettingsSection";
import { useRequests } from "../hooks/queries/useRequests";
import { useBudgetUsage } from "../hooks/useBudgetUsage";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { appUser } = useAuth();
  const { currentProject } = useProject();
  const budget = currentProject?.budgetConfig ?? { totalBudget: 0, byCode: {} };

  const {
    data: requests = [],
    isLoading: loading,
    error,
  } = useRequests(currentProject?.id);
  const budgetUsage = useBudgetUsage();

  const stats = useMemo(() => {
    if (requests.length === 0) return null;

    const total = requests.length;
    const pending = requests.filter((r) => r.status === "pending").length;
    const approvedOnly = requests.filter(
      (r) => r.status === "approved",
    ).length;
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
    const byCommittee: Record<
      string,
      { count: number; amount: number; approvedAmount: number }
    > = {};
    const byBudgetCode: Record<
      number,
      { count: number; amount: number; approvedAmount: number }
    > = {};

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

  const canEditBudget =
    appUser?.role === "admin" || appUser?.role === "finance";

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

      {canEditBudget && currentProject && (
        <BudgetSettingsSection
          key={currentProject.id}
          project={currentProject}
        />
      )}
    </Layout>
  );
}
