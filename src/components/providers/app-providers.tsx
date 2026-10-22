"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import {
  MockServiceWorkerStatusContext,
  type MockServiceWorkerStatus,
} from "./mock-service-worker-context";

const MockServiceWorkerProvider = dynamic(
  () =>
    import("./mock-service-worker-provider").then(
      (module) => module.MockServiceWorkerProvider,
    ),
  {
    ssr: false,
  },
);

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [mockServiceWorkerStatus, setMockServiceWorkerStatus] =
    useState<MockServiceWorkerStatus>(
      process.env.NODE_ENV === "development" ? "starting" : "inactive",
    );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <MockServiceWorkerStatusContext.Provider
          value={mockServiceWorkerStatus}
        >
          <MockServiceWorkerProvider
            onStatusChange={setMockServiceWorkerStatus}
          />
          {children}
          <Toaster richColors position="top-right" />
        </MockServiceWorkerStatusContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
