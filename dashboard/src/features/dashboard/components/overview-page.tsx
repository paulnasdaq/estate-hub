import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";

// Landing/overview page. Demonstrates the full data path:
// TanStack Query -> typed openapi-fetch client -> FastAPI.
export function OverviewPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => unwrap(api.GET("/health")),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to the dashboard
        </h1>
        <p className="text-muted-foreground">
          React + TypeScript + Vite, wired to your FastAPI backend.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-medium">Backend health</h2>
        {health.isPending && (
          <p className="text-sm text-muted-foreground">Checking…</p>
        )}
        {health.isError && (
          <p className="text-sm text-destructive">
            {getErrorMessage(health.error)}
          </p>
        )}
        {health.data && (
          <pre className="overflow-x-auto rounded bg-muted p-3 text-sm">
            {JSON.stringify(health.data, null, 2)}
          </pre>
        )}
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => health.refetch()}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
