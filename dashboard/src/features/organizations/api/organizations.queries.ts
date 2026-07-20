import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { OrganizationCreate, OrganizationUpdate } from "../types";
import { removeOrganizationLogo, uploadOrganizationLogo } from "./logo";

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

  detail: (orgId: string) =>
    queryOptions({
      queryKey: [...organizationQueries.all, "detail", orgId],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/organizations/{org_id}", {
            params: { path: { org_id: orgId } },
          }),
        ),
    }),
};

export function useOrganizations() {
  return useQuery(organizationQueries.list());
}

export function useOrganization(orgId: string) {
  return useQuery(organizationQueries.detail(orgId));
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

export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationUpdate) =>
      unwrap(
        api.PATCH("/api/v1/organizations/{org_id}", {
          params: { path: { org_id: orgId } },
          body,
        }),
      ),
    // `all` is the prefix for both the list and this org's detail, so a single
    // invalidation refetches every affected query.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all });
    },
  });
}

// The org id travels in the mutation args (not bound at hook-call time) so the
// same hook works in the create flow, where the id only exists after the
// organization is saved.
export function useUploadOrganizationLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, file }: { orgId: string; file: File }) =>
      uploadOrganizationLogo(orgId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all });
    },
  });
}

export function useRemoveOrganizationLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => removeOrganizationLogo(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    // DELETE returns 204 with no body, so `unwrap` (which requires data) can't
    // be used; surface any API error and resolve to void otherwise.
    mutationFn: async (orgId: string) => {
      const { error } = await api.DELETE("/api/v1/organizations/{org_id}", {
        params: { path: { org_id: orgId } },
      });
      if (error !== undefined) throw error;
    },
    onSuccess: (_data, orgId) => {
      // Drop the now-gone org's detail cache, then refetch the list.
      queryClient.removeQueries({
        queryKey: organizationQueries.detail(orgId).queryKey,
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all });
    },
  });
}
