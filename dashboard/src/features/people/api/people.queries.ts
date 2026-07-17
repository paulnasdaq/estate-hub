import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { PersonCreate } from "../types";

// How many people rows a single list page holds.
export const PEOPLE_PAGE_SIZE = 10;

type PeopleListParams = { search?: string; limit: number; offset: number };

// Data access for the people feature (the client-side analog of the backend's
// services/user_service.py). The backend resource is "users"; centralizing
// queryOptions here keeps query keys consistent across the feature.
export const peopleQueries = {
  all: ["people"] as const,

  list: (params: PeopleListParams) =>
    queryOptions({
      // Search + pagination are part of the key so each term/page caches
      // separately.
      queryKey: [...peopleQueries.all, "list", params],
      // The list endpoint is paginated: { items, total, limit, offset }.
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/users", {
            params: {
              query: {
                ...(params.search ? { search: params.search } : {}),
                limit: params.limit,
                offset: params.offset,
              },
            },
          }),
        ),
    }),

  detail: (userId: string) =>
    queryOptions({
      queryKey: [...peopleQueries.all, "detail", userId],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/users/{user_id}", {
            params: { path: { user_id: userId } },
          }),
        ),
    }),
};

export function usePeople(params: { search?: string; page: number }) {
  return useQuery({
    ...peopleQueries.list({
      search: params.search,
      limit: PEOPLE_PAGE_SIZE,
      offset: params.page * PEOPLE_PAGE_SIZE,
    }),
    // Keep the previous page's rows visible while a new search/page resolves,
    // so the table doesn't flash empty on every keystroke or page change.
    placeholderData: keepPreviousData,
  });
}

// A single unpaginated page of people, sized for populating a picker (e.g. the
// lease form's account select) rather than a browsable table.
export const PEOPLE_PICKER_LIMIT = 100;

export function usePeopleOptions() {
  return useQuery(
    peopleQueries.list({ limit: PEOPLE_PICKER_LIMIT, offset: 0 }),
  );
}

export function usePerson(userId: string) {
  return useQuery(peopleQueries.detail(userId));
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
