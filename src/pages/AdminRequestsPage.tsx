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
import Tooltip from "../components/Tooltip";
import { useTranslation } from "react-i18next";
import Select from "../components/Select";
import {
  canReviewCommittee,
  canFinalApproveCommittee,
  canFinalApproveRequest,
  canSeeCommitteeRequests,
  DEFAULT_APPROVAL_THRESHOLD,
} from "../lib/roles";

import {
  useInfiniteRequests,
  useReviewRequest,
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
  if (sortKey !== columnKey) return null;
  return (
    <svg
      className="inline-block w-3 h-3 ml-1 text-blue-600"
      viewBox="0 0 12 12"
      fill="currentColor"
    >
      {sortDir === "asc" ? (
        <path d="M6 3l4 6H2l4-6z" />
      ) : (
        <path d="M6 9L2 3h8l-4 6z" />
      )}
    </svg>
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

  const isReviewer = canReviewCommittee(role, "operations") || canReviewCommittee(role, "preparation");
  const isFinalApprover = canFinalApproveCommittee(role, "operations") || canFinalApproveCommittee(role, "preparation");

  const firestoreStatus = filter === "all" ? undefined : filter;
  const sortParam = useMemo(
    () => ({ field: sortKey, dir: sortDir }),
    [sortKey, sortDir],
  );

  const {
    data,
    isLoading,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteRequests(currentProject?.id, firestoreStatus, sortParam);

  const reviewMutation = useReviewRequest();
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const [signModalRequestId, setSignModalRequestId] = useState<string | null>(null);
  const [rejectModalRequestId, setRejectModalRequestId] = useState<string | null>(null);

  const allRequests = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const signModalRequest = allRequests.find((r) => r.id === signModalRequestId);
  const { data: requester } = useUser(signModalRequest?.requestedBy.uid);

  const threshold =
    currentProject?.directorApprovalThreshold ?? DEFAULT_APPROVAL_THRESHOLD;

  // Review handler (pending → reviewed)
  const handleReview = (requestId: string) => {
    const req = allRequests.find((r) => r.id === requestId);
    if (!req) return;
    if (req.requestedBy.uid === user?.uid) {
      alert(t("approval.selfApproveError"));
      return;
    }
    if (!canReviewCommittee(role, req.committee)) return;
    if (!user || !appUser) return;
    const reviewerName = appUser.displayName || appUser.name;
    reviewMutation.mutate({
      requestId,
      projectId: currentProject!.id,
      reviewer: { uid: user.uid, name: reviewerName, email: appUser.email },
    });
  };

  // Final approve handler (reviewed → approved)
  const handleApproveWithSign = (requestId: string) => {
    const req = allRequests.find((r) => r.id === requestId);
    if (!req) return;
    if (req.requestedBy.uid === user?.uid) {
      alert(t("approval.selfApproveError"));
      return;
    }
    if (!canFinalApproveRequest(role, req.committee, req.totalAmount, threshold)) {
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
      { onSuccess: () => setSignModalRequestId(null) },
    );
  };

  const handleRejectOpen = (requestId: string) => {
    const req = allRequests.find((r) => r.id === requestId);
    if (!req) return;
    if (req.requestedBy.uid === user?.uid) {
      alert(t("approval.selfRejectError"));
      return;
    }
    // Reviewer can reject pending, final approver can reject reviewed
    if (req.status === "pending" && !canReviewCommittee(role, req.committee)) return;
    if (req.status === "reviewed" && !canFinalApproveCommittee(role, req.committee)) return;
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
      { onSuccess: () => setRejectModalRequestId(null) },
    );
  };

  const budgetUsage = useBudgetUsage();

  const accessible = useMemo(() => {
    return filter === "all"
      ? allRequests.filter(
          (r) =>
            canSeeCommitteeRequests(role, r.committee) && r.status !== "cancelled",
        )
      : allRequests.filter((r) => canSeeCommitteeRequests(role, r.committee));
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

  const filterTabs = ["all", "pending", "reviewed", "approved", "settled", "rejected", "force_rejected"] as const;

  // Determine what action buttons to show for a request
  const renderActions = (req: typeof allRequests[0]) => {
    // pending → reviewer can "검토완료" / "반려"
    if (req.status === "pending" && isReviewer && canReviewCommittee(role, req.committee)) {
      return (
        <div className="flex gap-1 justify-center">
          <button
            onClick={() => handleReview(req.id)}
            disabled={reviewMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
          >
            {t("approval.review")}
          </button>
          <button
            onClick={() => handleRejectOpen(req.id)}
            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            {t("approval.reject")}
          </button>
        </div>
      );
    }
    // reviewed → final approver can "승인" / "반려"
    if (req.status === "reviewed" && isFinalApprover && canFinalApproveRequest(role, req.committee, req.totalAmount, threshold)) {
      return (
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
      );
    }
    return null;
  };

  // Remarks column content
  const renderRemarks = (req: typeof allRequests[0]) => {
    const parts: React.ReactNode[] = [];

    // Resubmission badge
    if (req.originalRequestId) {
      parts.push(
        <Link key="resub" to={`/request/${req.originalRequestId}`}
          className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium hover:bg-amber-200"
          onClick={(e) => e.stopPropagation()}>
          {t("approval.resubmitted")}
        </Link>
      );
    }

    if (req.reviewedBy && (req.status === "reviewed" || req.status === "approved" || req.status === "settled")) {
      parts.push(
        <Tooltip key="reviewed" text={`${t("approval.reviewedBy")}: ${req.reviewedBy.name}`} maxWidth="160px" />
      );
    }
    if (req.approvedBy && (req.status === "approved" || req.status === "rejected" || req.status === "settled")) {
      parts.push(
        <Tooltip key="approved" text={
          req.status === "rejected" && req.rejectionReason
            ? `${req.approvedBy.name}: ${req.rejectionReason}`
            : req.approvedBy.name
        } maxWidth="160px" />
      );
    }
    if (req.status === "force_rejected" && req.rejectionReason) {
      parts.push(
        <Tooltip key="force" text={req.rejectionReason} maxWidth="160px" className="text-orange-600" />
      );
    }
    if ((req.status === "reviewed" || req.status === "pending") && req.totalAmount > threshold) {
      parts.push(
        <Tooltip key="director" text={t("approval.directorRequired")} maxWidth="160px" className="text-orange-600" />
      );
    }

    return parts.length > 0 ? <div className="flex flex-wrap items-center gap-1">{parts}</div> : null;
  };

  return (
    <Layout>
      <PageHeader title={t("nav.adminRequests")} />

      <div className="flex flex-wrap gap-2 mb-6">
        {filterTabs.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {t(`status.${f}`, f)}
          </button>
        ))}
      </div>

      {isLoading ? (
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
                      {([
                        { key: "date" as SortKey, label: t("field.date"), align: "text-left" },
                        { key: "payee" as SortKey, label: t("field.payee"), align: "text-left" },
                        { key: null, label: t("field.committee"), align: "text-left" },
                        { key: "totalAmount" as SortKey, label: t("field.totalAmount"), align: "text-right" },
                        { key: "status" as SortKey, label: t("status.label"), align: "text-center" },
                        { key: null, label: t("field.remarks"), align: "text-left" },
                        { key: null, label: "", align: "text-center" },
                      ] as const).map((col, i) => (
                        <th
                          key={i}
                          className={`${col.align} px-4 py-3 font-medium select-none ${
                            col.key
                              ? `cursor-pointer hover:text-gray-900 ${sortKey === col.key ? "text-blue-600" : "text-gray-600"}`
                              : "text-gray-600"
                          }`}
                          onClick={col.key ? () => handleSort(col.key!) : undefined}
                        >
                          {col.label}
                          {col.key && (
                            <SortIcon columnKey={col.key} sortKey={sortKey} sortDir={sortDir} />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y transition-opacity ${isFetching && !isFetchingNextPage ? "opacity-40" : ""}`}>
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
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {renderRemarks(req)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderActions(req)}
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
              <Select
                value={`${sortKey}-${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split("-") as [SortKey, SortDir];
                  setSortKey(k);
                  setSortDir(d);
                }}
                selectClassName="text-xs text-gray-600"
              >
                <option value="date-desc">{t("field.date")} ↓</option>
                <option value="date-asc">{t("field.date")} ↑</option>
                <option value="payee-asc">{t("field.payee")} ↑</option>
                <option value="payee-desc">{t("field.payee")} ↓</option>
                <option value="totalAmount-desc">{t("field.totalAmount")} ↓</option>
                <option value="totalAmount-asc">{t("field.totalAmount")} ↑</option>
                <option value="status-asc">{t("status.label")} ↑</option>
                <option value="status-desc">{t("status.label")} ↓</option>
              </Select>
            </div>

            <div className={`space-y-3 transition-opacity ${isFetching && !isFetchingNextPage ? "opacity-40" : ""}`}>
              {accessible.map((req) => (
                <Link
                  key={req.id}
                  to={`/request/${req.id}`}
                  className="block bg-white rounded-lg shadow p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{req.payee}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                    <span>{req.date}</span>
                    <span>{t(`committee.${req.committee}Short`)}</span>
                  </div>
                  <div className="text-right font-semibold text-gray-900 mb-3">
                    ₩{req.totalAmount.toLocaleString()}
                  </div>
                  {/* Mobile action buttons */}
                  {req.status === "pending" && isReviewer && canReviewCommittee(role, req.committee) && (
                    <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                      <button
                        onClick={() => handleReview(req.id)}
                        disabled={reviewMutation.isPending}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {t("approval.review")}
                      </button>
                      <button
                        onClick={() => handleRejectOpen(req.id)}
                        className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        {t("approval.reject")}
                      </button>
                    </div>
                  )}
                  {req.status === "reviewed" && isFinalApprover && canFinalApproveRequest(role, req.committee, req.totalAmount, threshold) && (
                    <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
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
                  {req.status === "reviewed" &&
                    !canFinalApproveRequest(role, req.committee, req.totalAmount, threshold) &&
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
