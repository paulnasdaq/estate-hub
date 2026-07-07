import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { PropertyCreate } from "../types";

// Data access for the properties feature (the client-side analog of the
// backend's services/property_service.py). Centralizing queryOptions here keeps
// query keys consistent and lets routes prefetch with the same definition.
export const propertyQueries = {
  all: ["properties"] as const,

  list: () =>
    queryOptions({
      queryKey: [...propertyQueries.all, "list"],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () => unwrap(api.GET("/api/v1/properties")),
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

export function useProperties() {
  return useQuery(propertyQueries.list());
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
