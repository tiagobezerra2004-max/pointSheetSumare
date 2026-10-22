"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useActivities,
  useAttendances,
  useCreateOvertimeEntry,
  useDeleteOvertimeEntry,
  useFunctions,
  useOvertimeEntries,
  useUpdateOvertimeEntry,
  useWorkers,
} from "@/api/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { useMockServiceWorkerStatus } from "@/components/providers/mock-service-worker-context";
import { Button } from "@/components/ui/button";
import {
  formatCurrencyBRL,
  formatDateBR,
} from "@/lib/formatters";
import {
  horaExtraDeleteSchema,
  horaExtraInputSchema,
  horaExtraUpdateSchema,
  type Atividade,
  type Funcao,
  type HoraExtra,
  type HoraExtraInput,
  type Trabalhador,
} from "@/schemas/data";

const EMPTY_ACTIVITIES: Atividade[] = [];
const EMPTY_FUNCTIONS: Funcao[] = [];
const EMPTY_WORKERS: Trabalhador[] = [];
const EMPTY_OVERTIME: HoraExtra[] = [];
const fieldClassName =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive";

function localDateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function getDefaultPeriod() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    start: localDateString(start),
    end: localDateString(today),
  };
}

function getOvertimePreview(
  worker: Trabalhador | undefined,
  funcao: Funcao | undefined,
  date: string,
  hours: number | undefined,
) {
  if (!worker || !funcao || !date || !hours || !Number.isFinite(hours)) {
    return null;
  }
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const isSaturday = weekday === 6;
  const hourlyRate = isSaturday
    ? funcao.valorHoraSabado
    : funcao.valorHoraSemana;

  return {
    dayType: isSaturday ? "Sábado" : "Dia de semana",
    hourlyRate,
    total: Math.round((hourlyRate * hours + Number.EPSILON) * 100) / 100,
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

function LoadingState() {
  return (
    <div aria-label="Carregando horas extras" aria-busy="true">
      <div className="mb-5 h-28 animate-pulse rounded-xl bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <span className="sr-only">Carregando horas extras...</span>
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
          <h2 className="font-semibold">
            Não foi possível carregar as horas extras
          </h2>
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

function WorkerCombobox({
  workers,
  value,
  onChange,
  disabled,
  error,
}: {
  workers: Trabalhador[];
  value: string;
  onChange: (workerId: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const workerById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  );
  const workerIds = useMemo(() => workers.map(({ id }) => id), [workers]);

  return (
    <div className="space-y-1.5">
      <label htmlFor="overtime-worker" className="text-sm font-medium">
        Trabalhador <span aria-hidden="true">*</span>
      </label>
      <Combobox.Root
        items={workerIds}
        value={value || null}
        onValueChange={(workerId) => onChange(workerId ?? "")}
        itemToStringLabel={(workerId) => workerById.get(workerId)?.nome ?? ""}
        filter={(workerId, query) =>
          normalizeSearch(workerById.get(workerId)?.nome ?? "").includes(
            normalizeSearch(query),
          )
        }
        autoHighlight
        disabled={disabled}
      >
        <Combobox.Input
          id="overtime-worker"
          className={fieldClassName}
          placeholder="Busque pelo nome do trabalhador"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "overtime-worker-error" : undefined}
        />
        <Combobox.Portal>
          <Combobox.Positioner
            sideOffset={4}
            className="z-[70] outline-none"
          >
            <Combobox.Popup className="max-h-64 w-[var(--anchor-width)] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
              <Combobox.List className="space-y-1">
                {(workerId: string) => {
                  const worker = workerById.get(workerId);
                  if (!worker) return null;
                  return (
                    <Combobox.Item
                      key={worker.id}
                      value={worker.id}
                      className="flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                    >
                      {worker.nome}
                    </Combobox.Item>
                  );
                }}
              </Combobox.List>
              <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">
                Nenhum trabalhador encontrado.
              </Combobox.Empty>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <FieldError id="overtime-worker-error" message={error} />
    </div>
  );
}

function OvertimeFormDialog({
  open,
  entry,
  workers,
  functions,
  activities,
  onClose,
  onSaved,
}: {
  open: boolean;
  entry: HoraExtra | null;
  workers: Trabalhador[];
  functions: Funcao[];
  activities: Atividade[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateOvertimeEntry();
  const updateMutation = useUpdateOvertimeEntry();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const [changeReason, setChangeReason] = useState("");
  const [changeReasonError, setChangeReasonError] = useState("");
  const [pendingUpdate, setPendingUpdate] = useState<{
    input: HoraExtraInput;
    motivo: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<HoraExtraInput>({
    resolver: zodResolver(horaExtraInputSchema),
    defaultValues: {
      trabalhadorId: entry?.trabalhadorId ?? "",
      data: entry?.data ?? localDateString(new Date()),
      horas: entry?.horas ?? 1,
      atividadeId: entry?.atividadeId ?? "",
      observacao: entry?.observacao ?? "",
    },
  });
  const selectedWorkerId = useWatch({ control, name: "trabalhadorId" });
  const selectedDate = useWatch({ control, name: "data" });
  const hours = useWatch({ control, name: "horas" });
  const selectedWorker = workers.find(({ id }) => id === selectedWorkerId);
  const selectedFunction = functions.find(
    ({ id }) => id === selectedWorker?.funcaoId,
  );
  const preview = getOvertimePreview(
    selectedWorker,
    selectedFunction,
    selectedDate,
    hours,
  );
  const attendancesQuery = useAttendances(selectedDate, open);
  const attendance = attendancesQuery.data?.find(
    ({ trabalhadorId }) => trabalhadorId === selectedWorkerId,
  );
  const isDischargedOnDate = Boolean(
    selectedWorker?.status === "Desligado" &&
      selectedWorker.dataDesligamento &&
      selectedDate >= selectedWorker.dataDesligamento,
  );
  const missingPresence = Boolean(
    selectedWorkerId &&
      !attendancesQuery.isLoading &&
      !attendancesQuery.error &&
      attendance?.codigo !== "P",
  );

  async function save(input: HoraExtraInput) {
    const validatedUpdate = entry
      ? horaExtraUpdateSchema.safeParse({
          ...input,
          motivo: changeReason,
        })
      : null;
    if (validatedUpdate && !validatedUpdate.success) {
      setChangeReasonError(
        validatedUpdate.error.issues[0]?.message ??
          "Informe o motivo da edição.",
      );
      return;
    }

    const warnings: string[] = [];
    if (missingPresence) {
      warnings.push(
        `${selectedWorker?.nome} não tem presença P registrada em ${formatDateBR(input.data)}.`,
      );
    }
    if (isDischargedOnDate) {
      warnings.push(
        `${selectedWorker?.nome} estava desligado(a) em ${formatDateBR(input.data)}.`,
      );
    }
    if (
      warnings.length > 0 &&
      !window.confirm(`${warnings.join("\n")}\n\nDeseja continuar?`)
    ) {
      return;
    }

    if (entry) {
      if (!validatedUpdate?.success) return;
      setPendingUpdate({
        input,
        motivo: validatedUpdate.data.motivo,
      });
      return;
    }

    try {
      await createMutation.mutateAsync(input);
      toast.success("Hora extra lançada com sucesso.");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o lançamento. Tente novamente.",
      );
    }
  }

  async function confirmUpdate() {
    if (!entry || !pendingUpdate) return;
    try {
      await updateMutation.mutateAsync({
        id: entry.id,
        ...pendingUpdate,
      });
      toast.success("Lançamento atualizado e motivo registrado no histórico.");
      setPendingUpdate(null);
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o lançamento. Tente novamente.",
      );
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-xl flex-col border-l bg-background shadow-2xl outline-none sm:inset-y-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border">
          <div className="flex min-h-20 items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                {entry ? "Editar hora extra" : "Novo lançamento"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                A função, a taxa e o valor são consultados e calculados
                automaticamente.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar formulário"
              disabled={isPending}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit(save)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              <WorkerCombobox
                workers={workers}
                value={selectedWorkerId}
                onChange={(workerId) =>
                  setValue("trabalhadorId", workerId, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={isPending}
                error={errors.trabalhadorId?.message}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="overtime-date" className="text-sm font-medium">
                    Data <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="overtime-date"
                    type="date"
                    className={fieldClassName}
                    required
                    aria-invalid={Boolean(errors.data)}
                    aria-describedby={
                      errors.data ? "overtime-date-error" : undefined
                    }
                    {...register("data")}
                    disabled={isPending}
                  />
                  <FieldError
                    id="overtime-date-error"
                    message={errors.data?.message}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="overtime-hours" className="text-sm font-medium">
                    Horas <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="overtime-hours"
                    type="number"
                    min="0.5"
                    max="12"
                    step="0.5"
                    inputMode="decimal"
                    placeholder="Ex.: 2,5"
                    className={fieldClassName}
                    required
                    aria-invalid={Boolean(errors.horas)}
                    aria-describedby={
                      errors.horas ? "overtime-hours-error" : undefined
                    }
                    {...register("horas", { valueAsNumber: true })}
                    disabled={isPending}
                  />
                  <FieldError
                    id="overtime-hours-error"
                    message={errors.horas?.message}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="overtime-activity" className="text-sm font-medium">
                  Atividade <span aria-hidden="true">*</span>
                </label>
                <select
                  id="overtime-activity"
                  className={`${fieldClassName} select-control`}
                  required
                  aria-invalid={Boolean(errors.atividadeId)}
                  aria-describedby={
                    errors.atividadeId ? "overtime-activity-error" : undefined
                  }
                  {...register("atividadeId")}
                  disabled={isPending}
                >
                  <option value="">Selecione uma atividade</option>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.nome}
                    </option>
                  ))}
                </select>
                <FieldError
                  id="overtime-activity-error"
                  message={errors.atividadeId?.message}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="overtime-observation" className="text-sm font-medium">
                  Observação
                </label>
                <textarea
                  id="overtime-observation"
                  rows={3}
                  maxLength={500}
                  className={`${fieldClassName} resize-y py-2`}
                  placeholder="Detalhes adicionais (opcional)"
                  {...register("observacao")}
                  disabled={isPending}
                />
              </div>

              {entry && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="overtime-change-reason"
                    className="text-sm font-medium"
                  >
                    Motivo da edição <span aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="overtime-change-reason"
                    rows={2}
                    minLength={3}
                    maxLength={500}
                    required
                    value={changeReason}
                    onChange={(event) => {
                      setChangeReason(event.target.value);
                      setChangeReasonError("");
                    }}
                    className={`${fieldClassName} py-2`}
                    aria-invalid={Boolean(changeReasonError)}
                    aria-describedby={
                      changeReasonError
                        ? "overtime-change-reason-error"
                        : undefined
                    }
                    disabled={isPending}
                  />
                  <FieldError
                    id="overtime-change-reason-error"
                    message={changeReasonError}
                  />
                </div>
              )}

              {selectedWorker && (
                <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <h3 className="font-semibold">Cálculo do lançamento</h3>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Função</dt>
                      <dd className="mt-1 font-medium">
                        {selectedFunction?.nome ?? "Função indisponível"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Tipo do dia</dt>
                      <dd className="mt-1 font-medium">
                        {preview?.dayType ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Taxa por hora</dt>
                      <dd className="mt-1 font-medium">
                        {preview
                          ? formatCurrencyBRL(preview.hourlyRate)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Valor calculado</dt>
                      <dd className="mt-1 font-semibold text-primary">
                        {preview ? formatCurrencyBRL(preview.total) : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {selectedWorkerId && attendancesQuery.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Verificando a presença do dia...
                </p>
              )}
              {selectedWorkerId && attendancesQuery.error && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <span>
                    Não foi possível verificar a presença. Tente novamente
                    antes de salvar.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={attendancesQuery.isFetching}
                    onClick={() => void attendancesQuery.refetch()}
                  >
                    {attendancesQuery.isFetching && (
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    )}
                    Tentar novamente
                  </Button>
                </div>
              )}
              {missingPresence && (
                <div
                  role="status"
                  className="rounded-lg border border-amber-700/30 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-950 dark:text-amber-100"
                >
                  Este trabalhador não tem presença P registrada nesta data.
                  Você poderá continuar após confirmar o aviso.
                </div>
              )}
              {isDischargedOnDate && (
                <div
                  role="status"
                  className="rounded-lg border border-amber-700/30 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-950 dark:text-amber-100"
                >
                  Atenção: o trabalhador estava desligado na data informada. O
                  lançamento só será salvo após confirmação.
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={isPending}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                disabled={isPending || Boolean(attendancesQuery.error)}
              >
                {isPending && (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {entry ? "Salvar alterações" : "Lançar hora extra"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
      <Dialog.Root
        open={Boolean(pendingUpdate)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !updateMutation.isPending) {
            setPendingUpdate(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[70] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-5 shadow-xl outline-none">
            <Dialog.Title className="text-lg font-semibold">
              Confirmar edição?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              O lançamento será atualizado e o motivo informado ficará
              registrado no histórico.
            </Dialog.Description>
            <p className="mt-3 rounded-lg bg-muted p-3 text-sm">
              {pendingUpdate?.motivo}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={updateMutation.isPending}
                onClick={() => setPendingUpdate(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="min-h-11"
                disabled={updateMutation.isPending}
                onClick={() => void confirmUpdate()}
              >
                {updateMutation.isPending && (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                Confirmar edição
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  );
}

function DeleteOvertimeDialog({
  entry,
  onClose,
}: {
  entry: HoraExtra | null;
  onClose: () => void;
}) {
  const deleteMutation = useDeleteOvertimeEntry();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entry) return;

    const parsed = horaExtraDeleteSchema.safeParse({ motivo: reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe um motivo válido.");
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        id: entry.id,
        motivo: parsed.data.motivo,
      });
      toast.success("Lançamento excluído e motivo registrado no histórico.");
      onClose();
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Não foi possível excluir o lançamento.",
      );
    }
  }

  return (
    <Dialog.Root
      open={Boolean(entry)}
      onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-5 shadow-xl outline-none">
          <Dialog.Title className="text-lg font-semibold">
            Excluir lançamento?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            A exclusão será registrada no histórico. Informe o motivo para
            continuar.
          </Dialog.Description>
          <form
            noValidate
            onSubmit={confirmDelete}
            className="mt-4 space-y-3"
          >
            <label
              htmlFor="overtime-delete-reason"
              className="text-sm font-medium"
            >
              Motivo obrigatório
            </label>
            <textarea
              id="overtime-delete-reason"
              rows={3}
              minLength={3}
              maxLength={500}
              required
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
              className={`${fieldClassName} py-2`}
              aria-invalid={Boolean(error)}
              disabled={deleteMutation.isPending}
            />
            <FieldError id="overtime-worker-error" message={error} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={deleteMutation.isPending}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="min-h-11"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                Confirmar exclusão
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OvertimeCard({
  entry,
  worker,
  activity,
  onEdit,
  onDelete,
}: {
  entry: HoraExtra;
  worker: Trabalhador | undefined;
  activity: Atividade | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">
            {worker?.nome ?? "Trabalhador indisponível"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activity?.nome ?? "Atividade indisponível"}
          </p>
        </div>
        <p className="font-semibold text-primary">
          {formatCurrencyBRL(entry.valorCalculado)}
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Data</dt>
          <dd className="mt-1 font-medium">{formatDateBR(entry.data)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Horas</dt>
          <dd className="mt-1 font-medium">{entry.horas} h</dd>
        </div>
        {entry.observacao && (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Observação</dt>
            <dd className="mt-1 break-words">{entry.observacao}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 flex gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1"
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" />
          Editar
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="min-h-11 flex-1"
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
          Excluir
        </Button>
      </div>
    </article>
  );
}

export function OvertimePage() {
  const mockStatus = useMockServiceWorkerStatus();
  const apiReady = mockStatus !== "starting" && mockStatus !== "error";
  const [period] = useState(getDefaultPeriod);
  const [workerFilter, setWorkerFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [dateStart, setDateStart] = useState(period.start);
  const [dateEnd, setDateEnd] = useState(period.end);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HoraExtra | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<HoraExtra | null>(null);

  const workersQuery = useWorkers(apiReady);
  const functionsQuery = useFunctions(apiReady);
  const activitiesQuery = useActivities(apiReady);
  const filters = useMemo(
    () => ({
      ...(workerFilter ? { trabalhadorId: workerFilter } : {}),
      ...(activityFilter ? { atividadeId: activityFilter } : {}),
      ...(dateStart ? { dataInicio: dateStart } : {}),
      ...(dateEnd ? { dataFim: dateEnd } : {}),
    }),
    [workerFilter, activityFilter, dateStart, dateEnd],
  );
  const overtimeQuery = useOvertimeEntries(filters, apiReady);
  const workers = workersQuery.data ?? EMPTY_WORKERS;
  const functions = functionsQuery.data ?? EMPTY_FUNCTIONS;
  const activities = activitiesQuery.data ?? EMPTY_ACTIVITIES;
  const entries = overtimeQuery.data?.items ?? EMPTY_OVERTIME;
  const workerById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  );
  const activityById = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities],
  );
  const loadError =
    mockStatus === "error"
      ? new Error("O serviço de dados mock não iniciou corretamente.")
      : workersQuery.error ||
        functionsQuery.error ||
        activitiesQuery.error ||
        overtimeQuery.error;
  const isLoading =
    mockStatus === "starting" ||
    workersQuery.isLoading ||
    functionsQuery.isLoading ||
    activitiesQuery.isLoading ||
    overtimeQuery.isLoading;

  function retryLoading() {
    void Promise.all([
      workersQuery.refetch(),
      functionsQuery.refetch(),
      activitiesQuery.refetch(),
      overtimeQuery.refetch(),
    ]);
  }

  function openNewForm() {
    setSelectedEntry(null);
    setFormOpen(true);
  }

  function openEditForm(entry: HoraExtra) {
    setSelectedEntry(entry);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setSelectedEntry(null);
  }

  return (
    <section>
      <PageHeader
        title="Horas extras"
        description="Registre, consulte e acompanhe os valores calculados das horas extras da equipe."
      />

      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock3 aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                Total calculado do período
              </p>
              <p className="text-xl font-semibold">
                {overtimeQuery.data
                  ? formatCurrencyBRL(overtimeQuery.data.total)
                  : "—"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="min-h-11"
            onClick={openNewForm}
            disabled={isLoading || Boolean(loadError)}
          >
            <Plus aria-hidden="true" />
            Novo lançamento
          </Button>
        </div>

        <section
          aria-label="Filtros de horas extras"
          className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="overtime-filter-worker" className="text-sm font-medium">
              Trabalhador
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <select
                id="overtime-filter-worker"
                className={`${fieldClassName} select-control pl-9`}
                value={workerFilter}
                onChange={(event) => setWorkerFilter(event.target.value)}
              >
                <option value="">Todos os trabalhadores</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="overtime-filter-activity" className="text-sm font-medium">
              Atividade
            </label>
            <select
              id="overtime-filter-activity"
              className={`${fieldClassName} select-control`}
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value)}
            >
              <option value="">Todas as atividades</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="overtime-filter-start" className="text-sm font-medium">
              De
            </label>
            <div className="relative">
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="overtime-filter-start"
                type="date"
                className={`${fieldClassName} pl-9`}
                value={dateStart}
                max={dateEnd || undefined}
                onChange={(event) => setDateStart(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="overtime-filter-end" className="text-sm font-medium">
              Até
            </label>
            <div className="relative">
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="overtime-filter-end"
                type="date"
                className={`${fieldClassName} pl-9`}
                value={dateEnd}
                min={dateStart || undefined}
                onChange={(event) => setDateEnd(event.target.value)}
              />
            </div>
          </div>
        </section>

        {isLoading ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState
            message={loadError.message}
            onRetry={retryLoading}
            disabled={
              workersQuery.isFetching ||
              functionsQuery.isFetching ||
              activitiesQuery.isFetching ||
              overtimeQuery.isFetching
            }
          />
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <Clock3
              aria-hidden="true"
              className="mx-auto size-9 text-muted-foreground"
            />
            <h2 className="mt-3 font-semibold">
              Nenhum lançamento neste período
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros ou registre uma nova hora extra.
            </p>
            <Button
              type="button"
              className="mt-4 min-h-11"
              onClick={openNewForm}
            >
              <Plus aria-hidden="true" />
              Novo lançamento
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {entries.length} lançamento{entries.length === 1 ? "" : "s"} no
              período
            </p>
            <div className="space-y-3 md:hidden">
              {entries.map((entry) => (
                <OvertimeCard
                  key={entry.id}
                  entry={entry}
                  worker={workerById.get(entry.trabalhadorId)}
                  activity={activityById.get(entry.atividadeId)}
                  onEdit={() => openEditForm(entry)}
                  onDelete={() => setEntryToDelete(entry)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border md:block">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Lançamentos de horas extras do período
                </caption>
                <thead className="bg-muted/60">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Trabalhador
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Data
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Atividade
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Horas
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Valor calculado
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="bg-card">
                      <td className="px-4 py-3 font-medium">
                        {workerById.get(entry.trabalhadorId)?.nome ??
                          "Trabalhador indisponível"}
                      </td>
                      <td className="px-4 py-3">{formatDateBR(entry.data)}</td>
                      <td className="px-4 py-3">
                        {activityById.get(entry.atividadeId)?.nome ??
                          "Atividade indisponível"}
                      </td>
                      <td className="px-4 py-3">{entry.horas} h</td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrencyBRL(entry.valorCalculado)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11"
                            aria-label={`Editar hora extra de ${workerById.get(entry.trabalhadorId)?.nome ?? "trabalhador"}`}
                            onClick={() => openEditForm(entry)}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="size-11"
                            aria-label={`Excluir hora extra de ${workerById.get(entry.trabalhadorId)?.nome ?? "trabalhador"}`}
                            onClick={() => setEntryToDelete(entry)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <OvertimeFormDialog
        key={
          selectedEntry?.id ??
          (formOpen ? "new-open" : "new-closed")
        }
        open={formOpen}
        entry={selectedEntry}
        workers={workers}
        functions={functions}
        activities={activities}
        onClose={closeForm}
        onSaved={closeForm}
      />
      <DeleteOvertimeDialog
        key={entryToDelete?.id ?? "closed"}
        entry={entryToDelete}
        onClose={() => setEntryToDelete(null)}
      />
    </section>
  );
}
