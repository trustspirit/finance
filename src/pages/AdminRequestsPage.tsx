import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useProject } from "../contexts/ProjectContext";
import { RequestStatus } from "../types";
import { useBudgetUsage } from "../hooks/useBudgetUsage";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import Spinner from "../components/Spinner";
import PageHeader from "../components/PageHeader";
import InfiniteScrollSentinel from "../components/InfiniteScrollSentinel";
import {
  ApprovalModal,
  RejectionModal,
} from "../components/AdminRequestModals";
import { useTranslation } from "react-i18next";
import {
  canApproveCommittee,
  canApproveRequest,
  DEFAULT_APPROVAL_THRESHOLD,
} from "../lib/roles";

import {
  useInfiniteRequests,
  useApproveRequest,
  useRejectRequest,
} from "../hooks/queries/useRequests";
import { useUser } from "../hooks/queries/useUsers";

type SortKey = "date" | "payee" | "totalAmount" | "status";
type SortDir = "asc" | "desc";

function SortIcon({
  columnKey,
  sortKey,
  sortDir,
}: {
  columnKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (sortKey !== columnKey)
    return <span className="text-gray-300 ml-1">&#8597;</span>;
  return (
    <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
  );
}

export default function AdminRequestsPage() {
  const { t } = useTranslation();
  const { user, appUser } = useAuth();
  const { currentProject } = useProject();
  const role = appUser?.role || "user";
  const [filter, setFilter] = useState<RequestStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const firestoreStatus = filter === "all" ? undefined : filter;
  const sortParam = useMemo(
    () => ({ field: sortKey, dir: sortDir }),
    [sortKey, sortDir],
  );

  const {
    data,
    isLoading: loading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteRequests(currentProject?.id, firestoreStatus, sortParam);

  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const [signModalRequestId, setSignModalRequestId] = useState<string | null>(
    null,
  );
  const [rejectModalRequestId, setRejectModalRequestId] = useState<
    string | null
  >(null);

  const allRequests = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  // Fetch the requester's user data for bank book preview in approval modal
  const signModalRequest = allRequests.find((r) => r.id === signModalRequestId);
  const { data: requester } = useUser(signModalRequest?.requestedBy.uid);

  const threshold =
    currentProject?.directorApprovalThreshold ?? DEFAULT_APPROVAL_THRESHOLD;

  const handleApproveWithSign = (requestId: string) => {
    const req = allRequests.find((r) => r.id === requestId);
    if (!req) return;
    if (req.requestedBy.uid === user?.uid) {
      alert(t("approval.selfApproveError"));
      return;
    }
    if (!canApproveRequest(role, req.committee, req.totalAmount, threshold)) {
      if (req.totalAmount > threshold) {
        alert(t("approval.directorRequired"));
      }
      return;
    }
    setSignModalRequestId(requestId);
  };

  const handleApproveConfirm = (signatureData: string) => {
    if (!user || !appUser || !signModalRequestId) return;

    const approverName = appUser.displayName || appUser.name;

    approveMutation.mutate(
      {
        requestId: signModalRequestId,
        projectId: currentProject!.id,
        approver: { uid: user.uid, name: approverName, email: appUser.email },
        signature: signatureData,
      },
      {
        onSuccess: () => setSignModalRequestId(null),
      },
    );
  };

  const handleRejectOpen = (requestId: string) => {
    const req = allRequests.find((r) => r.id === requestId);
    if (!req) return;
    if (req.requestedBy.uid === user?.uid) {
      alert(t("approval.selfRejectError"));
      return;
    }
    if (!canApproveRequest(role, req.committee, req.totalAmount, threshold)) {
      if (req.totalAmount > threshold) {
        alert(t("approval.directorRequired"));
      }
      return;
    }
    setRejectModalRequestId(requestId);
  };

  const handleRejectConfirm = (reason: string) => {
    if (!user || !appUser || !rejectModalRequestId) return;

    const approverName = appUser.displayName || appUser.name;

    rejectMutation.mutate(
      {
        requestId: rejectModalRequestId,
        projectId: currentProject!.id,
        approver: { uid: user.uid, name: approverName, email: appUser.email },
        rejectionReason: reason,
      },
      {
        onSuccess: () => setRejectModalRequestId(null),
      },
    );
  };

  const budgetUsage = useBudgetUsage();

  // Filter by committee access, exclude cancelled (for 'all' tab)
  const accessible = useMemo(() => {
    return filter === "all"
      ? allRequests.filter(
          (r) =>
            canApproveCommittee(role, r.committee) && r.status !== "cancelled",
        )
      : allRequests.filter((r) => canApproveCommittee(role, r.committee));
  }, [allRequests, filter, role]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const bankBookUrl = requester?.bankBookUrl || requester?.bankBookDriveUrl;

  return (
    <Layout>
      <PageHeader title={t("nav.adminRequests")} />

      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "pending", "approved", "settled", "rejected"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {t(`status.${f}`, f)}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th
                        className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                        onClick={() => handleSort("date")}
                      >
                        {t("field.date")}
                        <SortIcon
                          columnKey="date"
                          sortKey={sortKey}
                          sortDir={sortDir}
                        />
                      </th>
                      <th
                        className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                        onClick={() => handleSort("payee")}
                      >
                        {t("field.payee")}
                        <SortIcon
                          columnKey="payee"
                          sortKey={sortKey}
                          sortDir={sortDir}
                        />
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">
                        {t("field.committee")}
                      </th>
                      <th
                        className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                        onClick={() => handleSort("totalAmount")}
                      >
                        {t("field.totalAmount")}
                        <SortIcon
                          columnKey="totalAmount"
                          sortKey={sortKey}
                          sortDir={sortDir}
                        />
                      </th>
                      <th
                        className="text-center px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                        onClick={() => handleSort("status")}
                      >
                        {t("status.label")}
                        <SortIcon
                          columnKey="status"
                          sortKey={sortKey}
                          sortDir={sortDir}
                        />
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {accessible.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link
                            to={`/request/${req.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {req.date}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{req.payee}</td>
                        <td className="px-4 py-3">
                          {t(`committee.${req.committee}Short`)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          ₩{req.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={req.status} />
                          {req.approvedBy &&
                            (req.status === "approved" ||
                              req.status === "rejected") && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {req.approvedBy.name}
                              </p>
                            )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {req.status === "pending" &&
                            canApproveRequest(
                              role,
                              req.committee,
                              req.totalAmount,
                              threshold,
                            ) && (
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => handleApproveWithSign(req.id)}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                >
                                  {t("approval.approve")}
                                </button>
                                <button
                                  onClick={() => handleRejectOpen(req.id)}
                                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                                >
                                  {t("approval.reject")}
                                </button>
                              </div>
                            )}
                          {req.status === "pending" &&
                            !canApproveRequest(
                              role,
                              req.committee,
                              req.totalAmount,
                              threshold,
                            ) &&
                            req.totalAmount > threshold && (
                              <span className="text-xs text-orange-600">
                                {t("approval.directorRequired")}
                              </span>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile: sort selector + card view */}
          <div className="sm:hidden">
            <div className="flex items-center gap-2 mb-3">
              <select
                value={`${sortKey}-${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split("-") as [
                    SortKey,
                    SortDir,
                  ];
                  setSortKey(k);
                  setSortDir(d);
                }}
                className="border border-gray-300 rounded pl-2 pr-8 py-1.5 text-xs text-gray-600"
              >
                <option value="date-desc">{t("field.date")} ↓</option>
                <option value="date-asc">{t("field.date")} ↑</option>
                <option value="payee-asc">{t("field.payee")} ↑</option>
                <option value="payee-desc">{t("field.payee")} ↓</option>
                <option value="totalAmount-desc">
                  {t("field.totalAmount")} ↓
                </option>
                <option value="totalAmount-asc">
                  {t("field.totalAmount")} ↑
                </option>
                <option value="status-asc">{t("status.label")} ↑</option>
                <option value="status-desc">{t("status.label")} ↓</option>
              </select>
            </div>

            <div className="space-y-3">
              {accessible.map((req) => (
                <Link
                  key={req.id}
                  to={`/request/${req.id}`}
                  className="block bg-white rounded-lg shadow p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {req.payee}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                    <span>{req.date}</span>
                    <span>{t(`committee.${req.committee}Short`)}</span>
                  </div>
                  <div className="text-right font-semibold text-gray-900 mb-3">
                    ₩{req.totalAmount.toLocaleString()}
                  </div>
                  {req.status === "pending" &&
                    canApproveRequest(
                      role,
                      req.committee,
                      req.totalAmount,
                      threshold,
                    ) && (
                      <div
                        className="flex gap-2"
                        onClick={(e) => e.preventDefault()}
                      >
                        <button
                          onClick={() => handleApproveWithSign(req.id)}
                          className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          {t("approval.approve")}
                        </button>
                        <button
                          onClick={() => handleRejectOpen(req.id)}
                          className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          {t("approval.reject")}
                        </button>
                      </div>
                    )}
                  {req.status === "pending" &&
                    !canApproveRequest(
                      role,
                      req.committee,
                      req.totalAmount,
                      threshold,
                    ) &&
                    req.totalAmount > threshold && (
                      <p className="text-xs text-orange-600 mt-1">
                        {t("approval.directorRequired")}
                      </p>
                    )}
                </Link>
              ))}
            </div>
          </div>

          <InfiniteScrollSentinel
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </>
      )}

      <ApprovalModal
        key={signModalRequestId ?? ""}
        open={!!signModalRequestId}
        onClose={() => setSignModalRequestId(null)}
        request={signModalRequest ?? null}
        bankBookUrl={bankBookUrl}
        budgetUsage={budgetUsage}
        savedSignature={appUser?.signature}
        onConfirm={handleApproveConfirm}
        isPending={approveMutation.isPending}
      />

      <RejectionModal
        key={rejectModalRequestId ?? ""}
        open={!!rejectModalRequestId}
        onClose={() => setRejectModalRequestId(null)}
        onConfirm={handleRejectConfirm}
        isPending={rejectMutation.isPending}
      />
    </Layout>
  );
}
