import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { queryKeys } from "./queryKeys";
import type { PaymentRequest, RequestStatus } from "../../types";

const PAGE_SIZE = 20;

export function useRequests(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requests.all(projectId!),
    queryFn: async () => {
      const q = query(
        collection(db, "requests"),
        where("projectId", "==", projectId),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      return snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as PaymentRequest,
      );
    },
    enabled: !!projectId,
  });
}

export function useMyRequests(
  projectId: string | undefined,
  uid: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.requests.byUser(projectId!, uid!),
    queryFn: async () => {
      const q = query(
        collection(db, "requests"),
        where("projectId", "==", projectId),
        where("requestedBy.uid", "==", uid),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      return snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as PaymentRequest,
      );
    },
    enabled: !!projectId && !!uid,
  });
}

export function useApprovedRequests(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requests.approved(projectId!),
    queryFn: async () => {
      const q = query(
        collection(db, "requests"),
        where("projectId", "==", projectId),
        where("status", "==", "approved"),
      );
      const snap = await getDocs(q);
      return snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as PaymentRequest,
      );
    },
    enabled: !!projectId,
  });
}

export function useInfiniteRequests(
  projectId: string | undefined,
  status?: RequestStatus | RequestStatus[],
  sort?: { field: string; dir: "asc" | "desc" },
) {
  const sortField = sort?.field ?? "createdAt";
  const sortDir = sort?.dir ?? "desc";
  const sortKey = `${sortField}-${sortDir}`;

  const statusKey = Array.isArray(status) ? status.join(",") : status;
  const queryKey = statusKey
    ? queryKeys.requests.infiniteByStatus(projectId!, statusKey, sortKey)
    : queryKeys.requests.infinite(projectId!, sortKey);

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const statusConstraint = status
        ? Array.isArray(status)
          ? [where("status", "in", status)]
          : [where("status", "==", status)]
        : [];
      const constraints: QueryConstraint[] = [
        where("projectId", "==", projectId),
        ...statusConstraint,
        orderBy(sortField, sortDir),
      ];
      if (pageParam) constraints.push(startAfter(pageParam));
      constraints.push(limit(PAGE_SIZE));

      const q = query(collection(db, "requests"), ...constraints);
      const snap = await getDocs(q);
      const items = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as PaymentRequest,
      );
      return { items, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
    },
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    getNextPageParam: (lastPage) =>
      lastPage.items.length < PAGE_SIZE ? undefined : lastPage.lastDoc,
    placeholderData: keepPreviousData,
    enabled: !!projectId,
  });
}

export function useInfiniteMyRequests(
  projectId: string | undefined,
  uid: string | undefined,
  status?: RequestStatus | RequestStatus[],
) {
  const statusKey = Array.isArray(status) ? status.join(",") : status;
  return useInfiniteQuery({
    queryKey: [...queryKeys.requests.infiniteByUser(projectId!, uid!), statusKey],
    queryFn: async ({ pageParam }) => {
      const statusConstraint = status
        ? Array.isArray(status)
          ? [where("status", "in", status)]
          : [where("status", "==", status)]
        : [];
      const constraints: QueryConstraint[] = [
        where("projectId", "==", projectId),
        where("requestedBy.uid", "==", uid),
        ...statusConstraint,
        orderBy("createdAt", "desc"),
      ];
      if (pageParam) constraints.push(startAfter(pageParam));
      constraints.push(limit(PAGE_SIZE));

      const q = query(collection(db, "requests"), ...constraints);
      const snap = await getDocs(q);
      const items = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as PaymentRequest,
      );
      return { items, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
    },
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    getNextPageParam: (lastPage) =>
      lastPage.items.length < PAGE_SIZE ? undefined : lastPage.lastDoc,
    placeholderData: keepPreviousData,
    enabled: !!projectId && !!uid,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id!),
    queryFn: async () => {
      const snap = await getDoc(doc(db, "requests", id!));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as PaymentRequest;
    },
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<PaymentRequest, "id" | "createdAt"> & { createdAt?: unknown },
    ) => {
      const docData = { ...data, createdAt: serverTimestamp() };
      const ref = await addDoc(collection(db, "requests"), docData);
      return ref.id;
    },
    onSuccess: (id, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.all(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(id),
      });
    },
  });
}

/** Review a pending request (pending → reviewed) */
export function useReviewRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      projectId: string;
      reviewer: { uid: string; name: string; email: string };
    }) => {
      const ref = doc(db, "requests", params.requestId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists() || snap.data().status !== "pending") {
          throw new Error("already_processed");
        }
        tx.update(ref, {
          status: "reviewed",
          reviewedBy: params.reviewer,
          reviewedAt: serverTimestamp(),
        });
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.all(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(variables.requestId),
      });
    },
  });
}

/** Approve a reviewed request (reviewed → approved) */
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      projectId: string;
      approver: { uid: string; name: string; email: string };
      signature: string;
    }) => {
      const ref = doc(db, "requests", params.requestId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists() || snap.data().status !== "reviewed") {
          throw new Error("already_processed");
        }
        tx.update(ref, {
          status: "approved",
          approvedBy: params.approver,
          approvalSignature: params.signature,
          approvedAt: serverTimestamp(),
        });
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.all(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(variables.requestId),
      });
    },
  });
}

/** Reject a pending or reviewed request → rejected */
export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      projectId: string;
      approver: { uid: string; name: string; email: string };
      rejectionReason: string;
    }) => {
      const ref = doc(db, "requests", params.requestId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("not_found");
        const status = snap.data().status;
        if (status !== "pending" && status !== "reviewed") {
          throw new Error("already_processed");
        }
        tx.update(ref, {
          status: "rejected",
          approvedBy: params.approver,
          approvalSignature: null,
          approvedAt: serverTimestamp(),
          rejectionReason: params.rejectionReason,
        });
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.all(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(variables.requestId),
      });
    },
  });
}

/** Force-reject an approved request (approved → force_rejected) */
export function useForceRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      projectId: string;
      approver: { uid: string; name: string; email: string };
      rejectionReason: string;
    }) => {
      const ref = doc(db, "requests", params.requestId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists() || snap.data().status !== "approved") {
          throw new Error("already_processed");
        }
        tx.update(ref, {
          status: "force_rejected",
          rejectionReason: params.rejectionReason,
        });
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.all(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(variables.requestId),
      });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { requestId: string; projectId: string }) => {
      const ref = doc(db, "requests", params.requestId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists() || snap.data().status !== "pending") {
          throw new Error("already_processed");
        }
        tx.update(ref, { status: "cancelled" });
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.all(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(variables.requestId),
      });
    },
  });
}
