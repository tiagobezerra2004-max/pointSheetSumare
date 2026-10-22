"use client";

import { useEffect, useState } from "react";
import { startMockServiceWorker } from "@/mocks/start-worker";
import type { MockServiceWorkerStatus } from "./mock-service-worker-context";

interface MockServiceWorkerProviderProps {
  onStatusChange: (status: MockServiceWorkerStatus) => void;
}

export function MockServiceWorkerProvider({
  onStatusChange,
}: MockServiceWorkerProviderProps) {
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      onStatusChange("inactive");
      return;
    }

    void startMockServiceWorker()
      .then(() => onStatusChange("ready"))
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar o serviço de dados falso.",
        );
        onStatusChange("error");
      });
  }, [onStatusChange]);

  if (!errorMessage) {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      Falha ao iniciar o MSW: {errorMessage}
    </div>
  );
}
