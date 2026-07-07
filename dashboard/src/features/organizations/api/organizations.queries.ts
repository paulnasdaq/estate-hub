import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { OrganizationCreate } from "../types";

// Data access for the organizations feature (the client-side analog of the
// backend's services/organization_service.py). Centralizing queryOptions here
// keeps query keys consistent and lets routes prefetch with the same
// definition.
export const organizationQueries = {
  all: ["organizations"] as const,

  list: () =>
    queryOptions({
      queryKey: [...organizationQueries.all, "list"],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () => unwrap(api.GET("/api/v1/organizations")),
    }),
};

export function useOrganizations() {
  return useQuery(organizationQueries.list());
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationCreate) =>
      unwrap(api.POST("/api/v1/organizations", { body })),
    // Refetch the list so the new organization shows up (simple + correct;
    // optimistic insertion is a later optimization).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all });
    },
  });
}
