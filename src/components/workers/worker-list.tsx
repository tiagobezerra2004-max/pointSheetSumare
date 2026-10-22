"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useMockServiceWorkerStatus } from "@/components/providers/mock-service-worker-context";
import { Button } from "@/components/ui/button";
import { useFunctions, useWorkers } from "@/api/hooks";
import { WorkerFormSheet } from "@/components/workers/worker-form-sheet";
import { formatDateBR } from "@/lib/formatters";
import type {
  Funcao,
  StatusTrabalhador,
  Trabalhador,
  Vinculo,
} from "@/schemas/data";

const statusOptions: StatusTrabalhador[] = [
  "Ativo",
  "Afastado",
  "Desligado",
];

const EMPTY_FUNCTIONS: Funcao[] = [];
const EMPTY_WORKERS: Trabalhador[] = [];

const vinculoOptions: { value: Vinculo; label: string }[] = [
  { value: "CLT", label: "CLT" },
  { value: "Avulso", label: "Avulso" },
  { value: "Vigia", label: "Vigia" },
  { value: "JovemAprendiz", label: "Jovem aprendiz" },
  { value: "Estagiario", label: "Estagiário" },
];

const statusStyles: Record<StatusTrabalhador, string> = {
  Ativo:
    "border-emerald-700/20 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-950 dark:text-emerald-200",
  Afastado:
    "border-amber-700/20 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-950 dark:text-amber-200",
  Desligado:
    "border-rose-700/20 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-950 dark:text-rose-200",
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function WorkerStatus({ status }: { status: StatusTrabalhador }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

function LoadingState() {
  return (
    <div aria-label="Carregando trabalhadores" aria-busy="true">
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <div className="h-12 animate-pulse bg-muted" />
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-16 border-t bg-card"
          >
            <div className="mx-4 mt-5 h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border p-4"
          >
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando trabalhadores...</span>
    </div>
  );
}

function WorkerCard({
  worker,
  functionById,
  onEdit,
}: {
  worker: Trabalhador;
  functionById: Map<string, Funcao>;
  onEdit: (worker: Trabalhador) => void;
}) {
  const funcao = functionById.get(worker.funcaoId);

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 break-words text-base font-semibold">
          {worker.nome}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <WorkerStatus status={worker.status} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={`Editar cadastro de ${worker.nome}`}
            onClick={() => onEdit(worker)}
          >
            <Pencil aria-hidden="true" />
          </Button>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Função</dt>
          <dd className="mt-1 break-words font-medium">
            {funcao?.nome ?? "Função indisponível"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Vínculo</dt>
          <dd className="mt-1 font-medium">
            {vinculoOptions.find(({ value }) => value === worker.vinculo)?.label ??
              worker.vinculo}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Data de início</dt>
          <dd className="mt-1 font-medium">{formatDateBR(worker.dataInicio)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function WorkerList() {
  const mockServiceWorkerStatus = useMockServiceWorkerStatus();
  const apiReady =
    mockServiceWorkerStatus !== "starting" &&
    mockServiceWorkerStatus !== "error";
  const workersQuery = useWorkers(apiReady);
  const functionsQuery = useFunctions(apiReady);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vinculoFilter, setVinculoFilter] = useState("");
  const [functionFilter, setFunctionFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [selectedWorker, setSelectedWorker] = useState<Trabalhador | null>(null);

  const functions = functionsQuery.data ?? EMPTY_FUNCTIONS;
  const functionById = useMemo(
    () => new Map(functions.map((funcao) => [funcao.id, funcao])),
    [functions],
  );
  const workers = workersQuery.data ?? EMPTY_WORKERS;
  const filteredWorkers = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    return workers.filter((worker) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeSearch(worker.nome).includes(normalizedSearch);
      const matchesStatus = !statusFilter || worker.status === statusFilter;
      const matchesVinculo = !vinculoFilter || worker.vinculo === vinculoFilter;
      const matchesFunction =
        !functionFilter || worker.funcaoId === functionFilter;

      return (
        matchesSearch && matchesStatus && matchesVinculo && matchesFunction
      );
    });
  }, [workers, search, statusFilter, vinculoFilter, functionFilter]);

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "" ||
    vinculoFilter !== "" ||
    functionFilter !== "";
  const isLoading =
    mockServiceWorkerStatus === "starting" ||
    workersQuery.isLoading ||
    functionsQuery.isLoading;
  const requestError =
    mockServiceWorkerStatus === "error"
      ? new Error("O serviço de dados mock não iniciou corretamente.")
      : workersQuery.error || functionsQuery.error;

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setVinculoFilter("");
    setFunctionFilter("");
  }

  async function retryRequests() {
    if (mockServiceWorkerStatus === "error") {
      window.location.reload();
      return;
    }

    await Promise.all([workersQuery.refetch(), functionsQuery.refetch()]);
  }

  function openNewWorkerForm() {
    setSelectedWorker(null);
    setFormSession((session) => session + 1);
    setSheetOpen(true);
  }

  function openWorkerForm(worker: Trabalhador) {
    setSelectedWorker(worker);
    setFormSession((session) => session + 1);
    setSheetOpen(true);
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Trabalhadores"
          description="Consulte a equipe, encontre cadastros e filtre por situação, vínculo ou função."
        />
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          disabled={isLoading || Boolean(requestError)}
          onClick={openNewWorkerForm}
        >
          <Plus aria-hidden="true" />
          Novo trabalhador
        </Button>
      </div>

      <WorkerFormSheet
        key={formSession}
        open={sheetOpen}
        worker={selectedWorker}
        workers={workers}
        functions={functions}
        onClose={() => setSheetOpen(false)}
        onOpenWorker={openWorkerForm}
        onSaved={() => setSheetOpen(false)}
      />

      <div className="space-y-5">
        <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1.5fr)_repeat(3,minmax(10rem,1fr))]">
          <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-sm font-medium">Buscar por nome</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ex.: João Almeida"
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-base outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearch("")}
                  className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </span>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <option value="">Todos os status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">Vínculo</span>
            <select
              value={vinculoFilter}
              onChange={(event) => setVinculoFilter(event.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <option value="">Todos os vínculos</option>
              {vinculoOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">Função</span>
            <select
              value={functionFilter}
              onChange={(event) => setFunctionFilter(event.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <option value="">Todas as funções</option>
              {functions.map((funcao) => (
                <option key={funcao.id} value={funcao.id}>
                  {funcao.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {isLoading
              ? "Carregando equipe..."
              : `${filteredWorkers.length} ${
                  filteredWorkers.length === 1
                    ? "trabalhador encontrado"
                    : "trabalhadores encontrados"
                }`}
          </p>
          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={clearFilters}
            >
              <X aria-hidden="true" />
              Limpar filtros
            </Button>
          )}
        </div>

        {isLoading ? (
          <LoadingState />
        ) : requestError ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-destructive"
              />
              <div>
                <h2 className="font-semibold">Não foi possível carregar a equipe</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {requestError.message}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={workersQuery.isFetching || functionsQuery.isFetching}
              onClick={() => void retryRequests()}
            >
              {workersQuery.isFetching || functionsQuery.isFetching ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {mockServiceWorkerStatus === "error"
                ? "Recarregar página"
                : "Tentar novamente"}
            </Button>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-5 py-10 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              {hasFilters ? (
                <SlidersHorizontal
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
              ) : (
                <UsersRound
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
              )}
            </span>
            <h2 className="font-semibold">
              {hasFilters
                ? "Nenhum trabalhador corresponde aos filtros"
                : "Nenhum trabalhador cadastrado"}
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {hasFilters
                ? "Altere os filtros ou a busca para consultar outros trabalhadores."
                : "Quando houver trabalhadores cadastrados, eles aparecerão nesta lista."}
            </p>
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                className="mt-4 min-h-11"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredWorkers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  functionById={functionById}
                  onEdit={openWorkerForm}
                />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Lista de trabalhadores e respectivos status, funções, vínculos e datas de início
                  </caption>
                  <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Nome
                      </th>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Função
                      </th>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Vínculo
                      </th>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Início
                      </th>
                      <th scope="col" className="px-5 py-4 text-right font-semibold">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.id} className="transition-colors hover:bg-muted/40">
                        <th scope="row" className="px-5 py-4 font-medium">
                          {worker.nome}
                        </th>
                        <td className="px-5 py-4">
                          {functionById.get(worker.funcaoId)?.nome ??
                            "Função indisponível"}
                        </td>
                        <td className="px-5 py-4">
                          {vinculoOptions.find(
                            ({ value }) => value === worker.vinculo,
                          )?.label ?? worker.vinculo}
                        </td>
                        <td className="px-5 py-4">
                          <WorkerStatus status={worker.status} />
                        </td>
                        <td className="px-5 py-4 tabular-nums">
                          {formatDateBR(worker.dataInicio)}
                        </td>
                        <td className="px-5 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`Editar cadastro de ${worker.nome}`}
                            onClick={() => openWorkerForm(worker)}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
