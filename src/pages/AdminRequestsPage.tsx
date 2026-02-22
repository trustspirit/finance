import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useProject } from "../contexts/ProjectContext";
import { RequestStatus } from "../types";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import Spinner from "../components/Spinner";
import PageHeader from "../components/PageHeader";
import InfiniteScrollSentinel from "../components/InfiniteScrollSentinel";
import Tooltip from "../components/Tooltip";
import { useTranslation } from "react-i18next";
import Select from "../components/Select";
import {
  canSeeCommitteeRequests,
  DEFAULT_APPROVAL_THRESHOLD,
} from "../lib/roles";

import {
  useInfiniteRequests,
} from "../hooks/queries/useRequests";

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
  const { appUser } = useAuth();
  const { currentProject } = useProject();
  const role = appUser?.role || "user";
  const [filter, setFilter] = useState<RequestStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const firestoreStatus: RequestStatus | RequestStatus[] | undefined =
    filter === "all" ? undefined
    : filter === "rejected" ? ["rejected", "force_rejected"]
    : filter;
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

  const allRequests = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const threshold =
    currentProject?.directorApprovalThreshold ?? DEFAULT_APPROVAL_THRESHOLD;

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

  const filterTabs = ["all", "pending", "reviewed", "approved", "settled", "rejected"] as const;

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

    if (req.reviewedBy && (req.status === "reviewed" || req.status === "approved" || req.status === "settled")
      && !(req.approvedBy && req.reviewedBy.uid === req.approvedBy.uid)) {
      parts.push(
        <Tooltip key="reviewed" text={`${t("approval.reviewedBy")}: ${req.reviewedBy.name}`} maxWidth="160px" />
      );
    }
    if (req.approvedBy && (req.status === "approved" || req.status === "settled")) {
      parts.push(
        <Tooltip key="approved" text={`${t("field.approvedBy")}: ${req.approvedBy.name}`} maxWidth="160px" />
      );
    }
    if (req.approvedBy && req.status === "rejected" && req.rejectionReason) {
      parts.push(
        <Tooltip key="rejected" text={`${req.approvedBy.name}: ${req.rejectionReason}`} maxWidth="160px" className="text-red-500" />
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
                            state={{ from: "/admin/requests" }}
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
                  state={{ from: "/admin/requests" }}
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
                  <div className="text-right font-semibold text-gray-900">
                    ₩{req.totalAmount.toLocaleString()}
                  </div>
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

    </Layout>
  );
}
