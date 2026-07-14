import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { PersonCreate } from "../types";

// Data access for the people feature (the client-side analog of the backend's
// services/user_service.py). The backend resource is "users"; centralizing
// queryOptions here keeps query keys consistent across the feature.
export const peopleQueries = {
  all: ["people"] as const,

  list: () =>
    queryOptions({
      queryKey: [...peopleQueries.all, "list"],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () => unwrap(api.GET("/api/v1/users")),
    }),
};

export function usePeople() {
  return useQuery(peopleQueries.list());
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PersonCreate) =>
      unwrap(api.POST("/api/v1/users", { body })),
    // Refetch the list so the new person shows up (simple + correct;
    // optimistic insertion is a later optimization).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: peopleQueries.all });
    },
  });
}
