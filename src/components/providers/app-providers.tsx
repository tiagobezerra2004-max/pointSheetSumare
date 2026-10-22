"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

const MockServiceWorkerProvider = dynamic(
  () =>
    import("./mock-service-worker-provider").then(
      (module) => module.MockServiceWorkerProvider,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground"
      >
        Preparando ambiente de desenvolvimento...
      </div>
    ),
  },
);

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <MockServiceWorkerProvider>{children}</MockServiceWorkerProvider>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
