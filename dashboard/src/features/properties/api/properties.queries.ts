import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { PropertyCreate, PropertyUpdate } from "../types";

// Data access for the properties feature (the client-side analog of the
// backend's services/property_service.py). Centralizing queryOptions here keeps
// query keys consistent and lets routes prefetch with the same definition.
export const propertyQueries = {
  all: ["properties"] as const,

  list: (params: { search?: string } = {}) =>
    queryOptions({
      // Search is part of the key so each term caches separately.
      queryKey: [...propertyQueries.all, "list", params],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/properties", {
            params: {
              query: params.search ? { search: params.search } : {},
            },
          }),
        ),
    }),

  detail: (propertyId: string) =>
    queryOptions({
      queryKey: [...propertyQueries.all, "detail", propertyId],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/properties/{property_id}", {
            params: { path: { property_id: propertyId } },
          }),
        ),
    }),
};

export function useProperties(params: { search?: string } = {}) {
  return useQuery({
    ...propertyQueries.list(params),
    // Keep the previous page's rows visible while a new search resolves, so the
    // table doesn't flash empty on every keystroke.
    placeholderData: (previous) => previous,
  });
}

export function useProperty(propertyId: string) {
  return useQuery(propertyQueries.detail(propertyId));
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PropertyCreate) =>
      unwrap(api.POST("/api/v1/properties", { body })),
    // Refetch the list so the new property shows up (simple + correct;
    // optimistic insertion is a later optimization).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: propertyQueries.all });
    },
  });
}

export function useUpdateProperty(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PropertyUpdate) =>
      unwrap(
        api.PATCH("/api/v1/properties/{property_id}", {
          params: { path: { property_id: propertyId } },
          body,
        }),
      ),
    // `all` is the prefix for both the list and this property's detail, so a
    // single invalidation refetches every affected query.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: propertyQueries.all });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    // DELETE returns 204 with no body, so `unwrap` (which requires data) can't
    // be used; surface any API error and resolve to void otherwise.
    mutationFn: async (propertyId: string) => {
      const { error } = await api.DELETE("/api/v1/properties/{property_id}", {
        params: { path: { property_id: propertyId } },
      });
      if (error !== undefined) throw error;
    },
    onSuccess: (_data, propertyId) => {
      // Drop the now-gone property's detail cache, then refetch the list.
      queryClient.removeQueries({
        queryKey: propertyQueries.detail(propertyId).queryKey,
      });
      void queryClient.invalidateQueries({ queryKey: propertyQueries.all });
    },
  });
}
