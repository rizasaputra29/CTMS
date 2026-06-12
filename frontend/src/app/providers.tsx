"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prevent refetching immediately on client after SSR
            staleTime: 60 * 1000, // 1 minute
            // Don't refetch on window focus (dashboard data doesn't need to be real-time)
            refetchOnWindowFocus: false,
            // Retry failed requests 3 times (default)
            retry: 3,
            // Garbage collect unused data after 5 minutes
            gcTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
