import { queryOptions, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";

export const organizationQueries = {
  all: ["organizations"] as const,

  list: () =>
    queryOptions({
      queryKey: [...organizationQueries.all, "list"],
      queryFn: () => unwrap(api.GET("/api/v1/organizations")),
    }),
};

export function useOrganizations() {
  return useQuery(organizationQueries.list());
}
