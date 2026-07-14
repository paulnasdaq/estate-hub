import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { BillCreate } from "../types";

// How many bill rows a single list page holds.
export const BILLS_PAGE_SIZE = 10;

type BillListParams = { limit: number; offset: number };

// Data access for the bills feature (the client-side analog of the backend's
// services/bill_service.py). Centralizing queryOptions here keeps query keys
// consistent and lets routes prefetch with the same definition.
export const billQueries = {
  all: ["bills"] as const,

  list: (params: BillListParams) =>
    queryOptions({
      // Pagination is part of the key so each page caches separately.
      queryKey: [...billQueries.all, "list", params],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/bills", {
            params: {
              query: { limit: params.limit, offset: params.offset },
            },
          }),
        ),
    }),

  detail: (billId: string) =>
    queryOptions({
      queryKey: [...billQueries.all, "detail", billId],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/bills/{bill_id}", {
            params: { path: { bill_id: billId } },
          }),
        ),
    }),
};

export function useBills(params: { page: number }) {
  return useQuery({
    ...billQueries.list({
      limit: BILLS_PAGE_SIZE,
      offset: params.page * BILLS_PAGE_SIZE,
    }),
    // Keep the previous page's rows visible while a new page resolves, so the
    // table doesn't flash empty on every page change.
    placeholderData: keepPreviousData,
  });
}

export function useBill(billId: string) {
  return useQuery(billQueries.detail(billId));
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BillCreate) => unwrap(api.POST("/api/v1/bills", { body })),
    // Refetch the list so the new bill shows up (simple + correct; optimistic
    // insertion is a later optimization).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billQueries.all });
    },
  });
}
