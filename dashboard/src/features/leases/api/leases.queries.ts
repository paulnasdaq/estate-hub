import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { LeaseCreate } from "../types";

// How many lease rows a single list page holds.
export const LEASES_PAGE_SIZE = 10;

type LeaseListParams = { limit: number; offset: number };

// Data access for the leases feature (the client-side analog of the backend's
// services/lease_service.py). Centralizing queryOptions here keeps query keys
// consistent and lets routes prefetch with the same definition.
export const leaseQueries = {
  all: ["leases"] as const,

  list: (params: LeaseListParams) =>
    queryOptions({
      // Pagination is part of the key so each page caches separately.
      queryKey: [...leaseQueries.all, "list", params],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/leases", {
            params: {
              query: { limit: params.limit, offset: params.offset },
            },
          }),
        ),
    }),

  detail: (leaseId: string) =>
    queryOptions({
      queryKey: [...leaseQueries.all, "detail", leaseId],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/leases/{lease_id}", {
            params: { path: { lease_id: leaseId } },
          }),
        ),
    }),
};

export function useLeases(params: { page: number }) {
  return useQuery({
    ...leaseQueries.list({
      limit: LEASES_PAGE_SIZE,
      offset: params.page * LEASES_PAGE_SIZE,
    }),
    // Keep the previous page's rows visible while a new page resolves, so the
    // table doesn't flash empty on every page change.
    placeholderData: keepPreviousData,
  });
}

export function useLease(leaseId: string) {
  return useQuery(leaseQueries.detail(leaseId));
}

export function useCreateLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LeaseCreate) =>
      unwrap(api.POST("/api/v1/leases", { body })),
    // Refetch the list so the new lease shows up (simple + correct; optimistic
    // insertion is a later optimization).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leaseQueries.all });
    },
  });
}
