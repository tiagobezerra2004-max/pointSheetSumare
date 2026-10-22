"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Save,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAttendances,
  useFunctions,
  useSaveAttendances,
  useWorkers,
} from "@/api/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { useMockServiceWorkerStatus } from "@/components/providers/mock-service-worker-context";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/formatters";
import { presencaLabels } from "@/lib/presencaLabels";
import type {
  CodigoPresenca,
  Funcao,
  Presenca,
  PresencaInput,
  Trabalhador,
} from "@/schemas/data";

type ViewMode = "day" | "week" | "month";
type AttendanceDraft = Pick<PresencaInput, "codigo" | "observacao">;

const codes: CodigoPresenca[] = ["P", "F", "A", "FC"];
const EMPTY_WORKERS: Trabalhador[] = [];
const EMPTY_ATTENDANCES: Presenca[] = [];
const EMPTY_FUNCTIONS: Funcao[] = [];

function localDateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function shiftDate(value: string, mode: ViewMode, direction: number): string {
  if (mode === "day") return addDays(value, direction);
  if (mode === "week") return addDays(value, direction * 7);

  const date = parseLocalDate(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + direction);
  return localDateString(date);
}

function getVisibleDates(value: string, mode: Exclude<ViewMode, "day">): string[] {
  if (mode === "week") {
    const selected = parseLocalDate(value);
    const mondayOffset = (selected.getDay() + 6) % 7;
    const monday = addDays(value, -mondayOffset);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }

  const date = parseLocalDate(value);
  const year = date.getFullYear();
  const month = date.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: dayCount }, (_, index) =>
    localDateString(new Date(year, month, index + 1, 12)),
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function isWorkerEligibleOnDate(worker: Trabalhador, date: string): boolean {
  if (worker.status === "Afastado" || worker.dataInicio > date) return false;
  return !(
    worker.status === "Desligado" &&
    worker.dataDesligamento &&
    worker.dataDesligamento <= date
  );
}

function hasSameValue(
  left: AttendanceDraft | undefined,
  right: AttendanceDraft | undefined,
): boolean {
  return left?.codigo === right?.codigo &&
    (left?.observacao ?? "") === (right?.observacao ?? "");
}

function getAttendanceMap(
  attendances: Presenca[],
): Map<string, AttendanceDraft> {
  return new Map(
    attendances.map(({ trabalhadorId, codigo, observacao }) => [
      trabalhadorId,
      { codigo, observacao },
    ]),
  );
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(parseLocalDate(value));
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Carregando frequência">
      <div className="mb-4 h-24 animate-pulse rounded-xl bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <span className="sr-only">Carregando frequência...</span>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  disabled,
}: {
  message: string;
  onRetry: () => void;
  disabled: boolean;
}) {
  return (
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
          <h2 className="font-semibold">Não foi possível carregar a frequência</h2>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={disabled}
        onClick={onRetry}
      >
        {disabled && (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        )}
        Tentar novamente
      </Button>
    </div>
  );
}

export function AttendancePage() {
  const mockStatus = useMockServiceWorkerStatus();
  const apiReady = mockStatus !== "starting" && mockStatus !== "error";
  const [mode, setMode] = useState<ViewMode>("day");
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [search, setSearch] = useState("");
  const [functionFilter, setFunctionFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [confirmMarkAllOpen, setConfirmMarkAllOpen] = useState(false);
  const workersQuery = useWorkers(apiReady);
  const functionsQuery = useFunctions(apiReady);
  const attendanceQuery = useAttendances(mode === "day" ? date : undefined);
  const saveMutation = useSaveAttendances();
  const workers = workersQuery.data ?? EMPTY_WORKERS;
  const attendances = attendanceQuery.data ?? EMPTY_ATTENDANCES;
  const functions = functionsQuery.data ?? EMPTY_FUNCTIONS;
  const functionNameById = useMemo(
    () => new Map(functions.map((funcao) => [funcao.id, funcao.nome])),
    [functions],
  );
  const attendanceByWorker = useMemo(
    () => getAttendanceMap(attendances),
    [attendances],
  );

  const eligibleWorkers = useMemo(
    () =>
      workers
        .filter((worker) => isWorkerEligibleOnDate(worker, date))
        .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
    [workers, date],
  );
  const filteredWorkers = useMemo(() => {
    const query = normalizeSearch(search);
    return eligibleWorkers.filter((worker) => {
      const matchesName =
        !query || normalizeSearch(worker.nome).includes(query);
      const matchesFunction =
        !functionFilter || worker.funcaoId === functionFilter;
      return matchesName && matchesFunction;
    });
  }, [eligibleWorkers, search, functionFilter]);

  const currentValue = useCallback(
    (workerId: string) =>
      drafts[workerId] ?? attendanceByWorker.get(workerId),
    [attendanceByWorker, drafts],
  );
  const isDirty = useMemo(
    () =>
      Object.entries(drafts).some(([workerId, draft]) =>
        !hasSameValue(draft, attendanceByWorker.get(workerId)),
      ),
    [attendanceByWorker, drafts],
  );

  const visibleDates = useMemo(
    () => (mode === "day" ? [] : getVisibleDates(date, mode)),
    [date, mode],
  );
  const periodAttendance = attendanceQuery.data ?? EMPTY_ATTENDANCES;
  const periodAttendanceByKey = useMemo(
    () =>
      new Map(
        periodAttendance.map((attendance) => [
          `${attendance.trabalhadorId}:${attendance.data}`,
          attendance.codigo,
        ]),
      ),
    [periodAttendance],
  );
  const periodWorkers = useMemo(
    () =>
      workers
        .filter((worker) =>
          visibleDates.some((visibleDate) =>
            isWorkerEligibleOnDate(worker, visibleDate),
          ),
        )
        .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
    [workers, visibleDates],
  );

  const counts = useMemo(() => {
    const current = eligibleWorkers.map(
      (worker) =>
        drafts[worker.id] ?? attendanceByWorker.get(worker.id),
    );
    return {
      present: current.filter((entry) => entry?.codigo === "P").length,
      absent: current.filter((entry) => entry?.codigo === "F").length,
      pending: current.filter((entry) => !entry?.codigo).length,
    };
  }, [eligibleWorkers, attendanceByWorker, drafts]);

  const requestError =
    mockStatus === "error"
      ? new Error("O serviço de dados mock não iniciou corretamente.")
      : workersQuery.error || functionsQuery.error || attendanceQuery.error;
  const isLoading =
    mockStatus === "starting" ||
    workersQuery.isLoading ||
    functionsQuery.isLoading ||
    attendanceQuery.isLoading;

  const warnBeforeLeave = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    },
    [isDirty],
  );

  const confirmUnsavedNavigation = useCallback(
    (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.origin !== window.location.origin) return;
      if (link.pathname === window.location.pathname) return;
      if (
        !window.confirm(
          "Há alterações de frequência não salvas. Deseja sair sem salvar?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [warnBeforeLeave]);

  useEffect(() => {
    if (!isDirty) return;
    document.addEventListener("click", confirmUnsavedNavigation, true);
    return () =>
      document.removeEventListener("click", confirmUnsavedNavigation, true);
  }, [isDirty, confirmUnsavedNavigation]);

  function changePeriod(nextDate: string) {
    if (isDirty && !window.confirm("Descartar as alterações de frequência não salvas?")) {
      return;
    }
    setDrafts({});
    setDate(nextDate);
  }

  function changeMode(nextMode: ViewMode) {
    if (nextMode === mode) return;
    if (isDirty && !window.confirm("Descartar as alterações de frequência não salvas?")) {
      return;
    }
    setDrafts({});
    setMode(nextMode);
  }

  function updateDraft(workerId: string, update: Partial<AttendanceDraft>) {
    const next = {
      ...(drafts[workerId] ?? attendanceByWorker.get(workerId) ?? {}),
      ...update,
    };
    const baseline = attendanceByWorker.get(workerId);
    setDrafts((current) => {
      const revised = { ...current };
      if (hasSameValue(next, baseline)) delete revised[workerId];
      else revised[workerId] = next;
      return revised;
    });
  }

  function confirmMarkAllPresent() {
    setDrafts((current) => {
      const revised = { ...current };
      for (const worker of eligibleWorkers) {
        const baseline = attendanceByWorker.get(worker.id);
        const currentValue = current[worker.id] ?? baseline;
        const next = {
          codigo: "P" as const,
          observacao: currentValue?.observacao,
        };
        if (hasSameValue(next, baseline)) delete revised[worker.id];
        else revised[worker.id] = next;
      }
      return revised;
    });
    setConfirmMarkAllOpen(false);
  }

  async function saveAttendances() {
    const payload: PresencaInput[] = eligibleWorkers.flatMap((worker) => {
      const value = currentValue(worker.id);
      if (!value?.codigo) return [];
      return [
        {
          trabalhadorId: worker.id,
          data: date,
          codigo: value.codigo,
          ...(value.observacao?.trim()
            ? { observacao: value.observacao.trim() }
            : {}),
        },
      ];
    });

    try {
      await saveMutation.mutateAsync(payload);
      setDrafts({});
      await attendanceQuery.refetch();
      toast.success("Frequência salva com sucesso.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a frequência. Tente novamente.",
      );
    }
  }

  const titleDate =
    mode === "month"
      ? new Intl.DateTimeFormat("pt-BR", {
          month: "long",
          year: "numeric",
        }).format(parseLocalDate(date))
      : mode === "week"
        ? `${dateLabel(visibleDates[0])} — ${dateLabel(visibleDates[6])}`
        : formatDateBR(date);

  function renderCodePicker(worker: Trabalhador) {
    const selected = currentValue(worker.id)?.codigo ?? "";
    return (
      <fieldset className="min-w-0">
        <legend className="sr-only">Presença de {worker.nome}</legend>
        <div
          role="radiogroup"
          aria-label={`Presença de ${worker.nome}`}
          className="grid grid-cols-4 gap-1.5"
        >
          {codes.map((code) => (
            <label key={code} className="relative">
              <input
                className="peer sr-only"
                type="radio"
                name={`presenca-${worker.id}`}
                value={code}
                checked={selected === code}
                disabled={saveMutation.isPending}
                aria-label={`${code} — ${presencaLabels[code]}`}
                onChange={() => updateDraft(worker.id, { codigo: code })}
              />
              <span
                className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-background text-sm font-bold transition hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring"
                title={presencaLabels[code]}
              >
                {code}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <section>
      <PageHeader
        title="Frequência"
        description="Registre a presença diária da equipe e consulte o histórico por semana ou mês."
      />

      <div className="space-y-5">
        <div className="flex flex-wrap gap-2" aria-label="Visualização da frequência">
          {([
            ["day", "Dia"],
            ["week", "Semana"],
            ["month", "Mês"],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? "default" : "outline"}
              className="min-h-11 min-w-20"
              disabled={saveMutation.isPending}
              aria-pressed={mode === value}
              onClick={() => changeMode(value)}
            >
              {label}
            </Button>
          ))}
          {mode !== "day" && (
            <p className="flex min-h-11 items-center text-sm text-muted-foreground">
              Consulta somente leitura
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={mode === "day" ? "Dia anterior" : "Período anterior"}
              disabled={saveMutation.isPending}
              onClick={() => changePeriod(shiftDate(date, mode, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <label className="min-w-0 flex-1 space-y-1.5">
              <span className="text-sm font-medium">
                {mode === "day" ? "Data" : "Data de referência"}
              </span>
              <span className="relative block">
                <CalendarDays
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="date"
                  value={date}
                  disabled={saveMutation.isPending}
                  onChange={(event) => {
                    if (event.currentTarget.value) {
                      changePeriod(event.currentTarget.value);
                    }
                  }}
                  className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                />
              </span>
            </label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={mode === "day" ? "Próximo dia" : "Próximo período"}
              disabled={saveMutation.isPending}
              onClick={() => changePeriod(shiftDate(date, mode, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <p className="pb-1 text-sm font-medium capitalize text-muted-foreground">
            {titleDate}
          </p>
        </div>

        {mode === "day" && (
          <>
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Legenda dos códigos</h2>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {codes.map((code) => (
                  <li key={code} className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-md border font-bold">
                      {code}
                    </span>
                    <span className="text-muted-foreground">
                      {presencaLabels[code]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border bg-card p-3 sm:p-4">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Presentes
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {counts.present}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-3 sm:p-4">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Faltas
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {counts.absent}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-3 sm:p-4">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Sem lançamento
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {counts.pending}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Buscar trabalhador</span>
                <span className="relative block">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nome do trabalhador"
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Limpar busca"
                      onClick={() => setSearch("")}
                      className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </span>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Função / equipe</span>
                <select
                  value={functionFilter}
                  onChange={(event) => setFunctionFilter(event.target.value)}
                  className="select-control h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
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
          </>
        )}

        {isLoading ? (
          <LoadingState />
        ) : requestError ? (
          <ErrorState
            message={requestError.message}
            disabled={
              workersQuery.isFetching ||
              functionsQuery.isFetching ||
              attendanceQuery.isFetching
            }
            onRetry={() => {
              if (mockStatus === "error") {
                window.location.reload();
                return;
              }
              void Promise.all([
                workersQuery.refetch(),
                functionsQuery.refetch(),
                attendanceQuery.refetch(),
              ]);
            }}
          />
        ) : mode === "day" ? (
          eligibleWorkers.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center">
              <h2 className="font-semibold">
                Nenhum trabalhador ativo nesta data
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifique a data selecionada ou o cadastro da equipe.
              </p>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="rounded-xl border border-dashed px-5 py-10 text-center">
              <h2 className="font-semibold">Nenhum resultado para a busca</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Altere a busca ou o filtro de função.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkers.map((worker) => {
                const value = currentValue(worker.id);
                const saved = attendanceByWorker.get(worker.id);
                return (
                  <article
                    key={worker.id}
                    className="rounded-xl border bg-card p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold">
                          {worker.nome}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {functionNameById.get(worker.funcaoId) ??
                            "Função indisponível"}
                        </p>
                      </div>
                      <div className="w-full sm:w-56">
                        {renderCodePicker(worker)}
                      </div>
                    </div>
                    <details className="mt-3 border-t pt-2">
                      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
                        {value?.observacao?.trim()
                          ? "Editar observação"
                          : "Adicionar observação"}
                      </summary>
                      <label className="mt-2 block space-y-1.5">
                        <span className="text-sm font-medium">
                          Observação opcional para {worker.nome}
                        </span>
                        <textarea
                          rows={2}
                          maxLength={500}
                          disabled={!value?.codigo || saveMutation.isPending}
                          value={value?.observacao ?? ""}
                          onChange={(event) =>
                            updateDraft(worker.id, {
                              observacao: event.currentTarget.value,
                            })
                          }
                          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                        />
                        {!value?.codigo && (
                          <p className="text-xs text-muted-foreground">
                            Selecione um código de presença para adicionar uma
                            observação.
                          </p>
                        )}
                      </label>
                      {saved?.observacao && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Observação salva: {saved.observacao}
                        </p>
                      )}
                    </details>
                  </article>
                );
              })}
            </div>
          )
        ) : periodWorkers.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed px-5 text-center">
            <div>
              <h2 className="font-semibold">Sem dados de trabalhadores no período</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Os trabalhadores elegíveis para essas datas aparecerão nesta tabela.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div
              className="overflow-x-auto"
              role="region"
              aria-label={`Frequência da ${mode === "week" ? "semana" : "mês"}, somente leitura`}
              tabIndex={0}
            >
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Consulta somente leitura da frequência por trabalhador e dia
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 min-w-48 border-b bg-muted px-4 py-3 font-semibold"
                    >
                      Trabalhador
                    </th>
                    {visibleDates.map((visibleDate) => (
                      <th
                        key={visibleDate}
                        scope="col"
                        className="min-w-20 border-b bg-muted px-3 py-3 text-center font-semibold"
                        title={formatDateBR(visibleDate)}
                      >
                        <span className="block capitalize">{dateLabel(visibleDate)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periodWorkers.map((worker) => (
                    <tr key={worker.id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-card px-4 py-3 font-medium"
                      >
                        <span className="block">{worker.nome}</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          {functionNameById.get(worker.funcaoId) ??
                            "Função indisponível"}
                        </span>
                      </th>
                      {visibleDates.map((visibleDate) => {
                        const eligible = isWorkerEligibleOnDate(
                          worker,
                          visibleDate,
                        );
                        const code = eligible
                          ? periodAttendanceByKey.get(
                              `${worker.id}:${visibleDate}`,
                            )
                          : undefined;
                        return (
                          <td
                            key={visibleDate}
                            className="border-l px-3 py-3 text-center"
                          >
                            {eligible ? (
                              code ? (
                                <span
                                  className="inline-flex size-9 items-center justify-center rounded-md border font-bold"
                                  title={presencaLabels[code]}
                                >
                                  {code}
                                </span>
                              ) : (
                                <span
                                  className="text-muted-foreground"
                                  aria-label="Sem lançamento"
                                >
                                  —
                                </span>
                              )
                            ) : (
                              <span
                                className="text-muted-foreground"
                                aria-label="Não elegível nesta data"
                              >
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mode === "day" && !isLoading && !requestError && (
          <div className="fixed inset-x-0 bottom-[4.5rem] z-20 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_18px_-14px_rgba(0,0,0,0.35)] backdrop-blur lg:bottom-0 lg:left-72">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {isDirty ? "Alterações não salvas" : "Frequência atualizada"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={eligibleWorkers.length === 0 || saveMutation.isPending}
                  onClick={() => setConfirmMarkAllOpen(true)}
                >
                  Marcar todos como P
                </Button>
              </div>
              <Button
                type="button"
                className="min-h-11"
                disabled={!isDirty || saveMutation.isPending}
                onClick={() => void saveAttendances()}
              >
                {saveMutation.isPending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                Salvar frequência
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog.Root
        open={confirmMarkAllOpen}
        onOpenChange={setConfirmMarkAllOpen}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-xl outline-none">
            <Dialog.Title className="text-lg font-semibold">
              Marcar todos como presentes?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Isso marcará {eligibleWorkers.length} trabalhadores elegíveis
              como presentes em {formatDateBR(date)}. As observações existentes
              serão mantidas. Você ainda precisará salvar as alterações.
            </Dialog.Description>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close
                className="min-h-11 rounded-lg border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                Cancelar
              </Dialog.Close>
              <Button
                type="button"
                className="min-h-11"
                onClick={confirmMarkAllPresent}
              >
                Confirmar
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
