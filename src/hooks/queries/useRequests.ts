import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
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
  status?: RequestStatus,
  sort?: { field: string; dir: "asc" | "desc" },
) {
  const sortField = sort?.field ?? "createdAt";
  const sortDir = sort?.dir ?? "desc";
  const sortKey = `${sortField}-${sortDir}`;

  const queryKey = status
    ? queryKeys.requests.infiniteByStatus(projectId!, status, sortKey)
    : queryKeys.requests.infinite(projectId!, sortKey);

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const constraints: QueryConstraint[] = [
        where("projectId", "==", projectId),
        ...(status ? [where("status", "==", status)] : []),
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

    enabled: !!projectId,
  });
}

export function useInfiniteMyRequests(
  projectId: string | undefined,
  uid: string | undefined,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.requests.infiniteByUser(projectId!, uid!),
    queryFn: async ({ pageParam }) => {
      const constraints: QueryConstraint[] = [
        where("projectId", "==", projectId),
        where("requestedBy.uid", "==", uid),
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
        if (!snap.exists() || snap.data().status !== "pending") {
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
        if (!snap.exists() || snap.data().status !== "pending") {
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

export function useCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { requestId: string; projectId: string }) => {
      await updateDoc(doc(db, "requests", params.requestId), {
        status: "cancelled",
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
