import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";

// How many payment rows a single list page holds.
export const PAYMENTS_PAGE_SIZE = 10;

type PaymentListParams = { limit: number; offset: number };

// Data access for the payments feature (the client-side analog of the backend's
// services/payment_service.py). Centralizing queryOptions here keeps query keys
// consistent and lets routes prefetch with the same definition.
export const paymentQueries = {
  all: ["payments"] as const,

  list: (params: PaymentListParams) =>
    queryOptions({
      // Pagination is part of the key so each page caches separately.
      queryKey: [...paymentQueries.all, "list", params],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/payments", {
            params: {
              query: { limit: params.limit, offset: params.offset },
            },
          }),
        ),
    }),
};

export function usePayments(params: { page: number }) {
  return useQuery({
    ...paymentQueries.list({
      limit: PAYMENTS_PAGE_SIZE,
      offset: params.page * PAYMENTS_PAGE_SIZE,
    }),
    // Keep the previous page's rows visible while a new page resolves, so the
    // table doesn't flash empty on every page change.
    placeholderData: keepPreviousData,
  });
}
