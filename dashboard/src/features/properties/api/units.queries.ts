import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { UnitCreateNested } from "../types";

// Data access for units, which are always scoped to a property (mirrors the
// backend's nested /properties/{id}/units routes). Query keys are nested under
// the property id so a property's unit list can be invalidated on its own.
export const unitQueries = {
  all: ["units"] as const,

  listForProperty: (propertyId: string) =>
    queryOptions({
      queryKey: [...unitQueries.all, "property", propertyId],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/properties/{property_id}/units", {
            params: { path: { property_id: propertyId } },
          }),
        ),
    }),
};

export function usePropertyUnits(propertyId: string) {
  return useQuery(unitQueries.listForProperty(propertyId));
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
    // Refetch this property's units so the new one shows up.
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: unitQueries.listForProperty(propertyId).queryKey,
      });
    },
  });
}
