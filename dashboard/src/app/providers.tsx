import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "@/core/query-client";
import { config } from "@/core/config";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router";

// Composes the app's global providers (mirrors the wiring in backend main.py).
export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors />
      {config.isDev && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
