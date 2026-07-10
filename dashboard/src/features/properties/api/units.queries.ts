import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { UnitCreateNested, UnitUpdate } from "../types";

// How many unit rows a single list page holds.
export const UNITS_PAGE_SIZE = 10;

type UnitListParams = { search?: string; limit: number; offset: number };

// Data access for units, which are always scoped to a property (mirrors the
// backend's nested /properties/{id}/units routes). Query keys are nested under
// the property id so a property's unit list can be invalidated on its own.
export const unitQueries = {
  all: ["units"] as const,

  listForProperty: (propertyId: string, params: UnitListParams) =>
    queryOptions({
      // Search + pagination are part of the key so each term/page caches
      // separately (the property id keeps a property's pages grouped).
      queryKey: [...unitQueries.all, "property", propertyId, params],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/properties/{property_id}/units", {
            params: {
              path: { property_id: propertyId },
              query: {
                ...(params.search ? { search: params.search } : {}),
                limit: params.limit,
                offset: params.offset,
              },
            },
          }),
        ),
    }),

  detail: (unitId: string) =>
    queryOptions({
      queryKey: [...unitQueries.all, "detail", unitId],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/units/{unit_id}", {
            params: { path: { unit_id: unitId } },
          }),
        ),
    }),
};

export function usePropertyUnits(
  propertyId: string,
  params: { search?: string; page: number },
) {
  return useQuery({
    ...unitQueries.listForProperty(propertyId, {
      search: params.search,
      limit: UNITS_PAGE_SIZE,
      offset: params.page * UNITS_PAGE_SIZE,
    }),
    // Keep the previous page's rows visible while a new search/page resolves,
    // so the list doesn't flash empty on every keystroke or page change.
    placeholderData: keepPreviousData,
  });
}

export function useUnit(unitId: string) {
  return useQuery(unitQueries.detail(unitId));
}

export function useCreateUnit(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UnitCreateNested) =>
      unwrap(
        api.POST("/api/v1/properties/{property_id}/units", {
          params: { path: { property_id: propertyId } },
          body,
        }),
      ),
    // Refetch unit lists so the new one shows up. `all` is the prefix for every
    // page/search of a property's units, so one invalidation covers them all.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: unitQueries.all });
    },
  });
}

export function useUpdateUnit(unitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UnitUpdate) =>
      unwrap(
        api.PATCH("/api/v1/units/{unit_id}", {
          params: { path: { unit_id: unitId } },
          body,
        }),
      ),
    // `all` is the prefix for both a property's unit list and this unit's
    // detail, so a single invalidation refetches every affected query.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: unitQueries.all });
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    // DELETE returns 204 with no body, so `unwrap` (which requires data) can't
    // be used; surface any API error and resolve to void otherwise.
    mutationFn: async (unitId: string) => {
      const { error } = await api.DELETE("/api/v1/units/{unit_id}", {
        params: { path: { unit_id: unitId } },
      });
      if (error !== undefined) throw error;
    },
    onSuccess: (_data, unitId) => {
      // Drop the now-gone unit's detail cache, then refetch the lists.
      queryClient.removeQueries({
        queryKey: unitQueries.detail(unitId).queryKey,
      });
      void queryClient.invalidateQueries({ queryKey: unitQueries.all });
    },
  });
}
