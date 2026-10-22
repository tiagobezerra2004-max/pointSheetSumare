"use client";

import { useEffect, useState, type ReactNode } from "react";
import { worker } from "@/mocks/browser";

let workerStartPromise: ReturnType<typeof worker.start> | undefined;

function startMockServiceWorker(): ReturnType<typeof worker.start> {
  if (worker.readyState !== 0) {
    return Promise.resolve(undefined);
  }

  if (!workerStartPromise) {
    workerStartPromise = worker
      .start({ onUnhandledFrame: "bypass" })
      .catch((error: unknown) => {
        workerStartPromise = undefined;
        throw error;
      });
  }

  return workerStartPromise;
}

interface MockServiceWorkerProviderProps {
  children: ReactNode;
}

export function MockServiceWorkerProvider({
  children,
}: MockServiceWorkerProviderProps) {
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    process.env.NODE_ENV === "development" ? "starting" : "ready",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    void startMockServiceWorker()
      .then(() => setStatus("ready"))
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar o serviço de dados falso.",
        );
        setStatus("error");
      });
  }, []);

  if (status === "starting") {
    return (
      <div
        role="status"
        className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground"
      >
        Preparando ambiente de desenvolvimento...
      </div>
    );
  }

  return (
    <>
      {status === "error" ? (
        <div
          role="alert"
          className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Falha ao iniciar o MSW: {errorMessage}
        </div>
      ) : null}
      {children}
    </>
  );
}
