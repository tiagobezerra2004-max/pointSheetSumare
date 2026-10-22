"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HealthResponse {
  status: "ok";
  source: "mock";
}

async function checkMockApi(): Promise<HealthResponse> {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new Error("O endpoint de teste não respondeu corretamente.");
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("status" in payload) ||
    payload.status !== "ok" ||
    !("source" in payload) ||
    payload.source !== "mock"
  ) {
    throw new Error("O endpoint de teste retornou uma resposta inválida.");
  }

  return { status: payload.status, source: payload.source };
}

export function MockApiStatus() {
  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ["health"],
    queryFn: checkMockApi,
    retry: false,
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        Verificando endpoint mock...
      </p>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="flex items-center gap-2 text-destructive" role="alert">
          <CircleAlert aria-hidden="true" className="size-4" />
          {error.message}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 aria-hidden="true" className="size-4" />
      MSW ativo · {data?.source} · endpoint /api/health
    </p>
  );
}
