"use client";

import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  useCreateWorker,
  useUpdateWorker,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { statusOptions, vinculoOptions } from "@/lib/workerOptions";
import {
  trabalhadorInputSchema,
  type Funcao,
  type Trabalhador,
  type TrabalhadorInput,
} from "@/schemas/data";

interface WorkerFormSheetProps {
  open: boolean;
  worker: Trabalhador | null;
  workers: Trabalhador[];
  functions: Funcao[];
  onClose: () => void;
  onOpenWorker: (worker: Trabalhador) => void;
  onSaved: () => void;
}

const fieldClassName =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive";

function localToday(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 0) return "";
  if (digits.length < 3) return `(${digits}`;

  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${areaCode}) ${number}`;
  if (number.length <= 8) {
    return `(${areaCode}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  return `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5, 9)}`;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameSimilarity(left: string, right: string): number {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }

  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function getDefaultValues(worker: Trabalhador | null): TrabalhadorInput {
  return {
    nome: worker?.nome ?? "",
    funcaoId: worker?.funcaoId ?? "",
    vinculo: worker?.vinculo ?? "CLT",
    status: worker?.status ?? "Ativo",
    dataInicio: worker?.dataInicio ?? localToday(),
    ...(worker?.dataDesligamento
      ? { dataDesligamento: worker.dataDesligamento }
      : {}),
    cpf: worker?.cpf ?? "",
    dataNascimento: worker?.dataNascimento ?? "",
    telefone: worker?.telefone ?? "",
    ...(worker?.pagamento ? { pagamento: worker.pagamento } : {}),
  };
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

function FieldLabel({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {required && <span aria-hidden="true"> *</span>}
    </label>
  );
}

function EyeToggle({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label}`}
      onClick={onToggle}
      className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {visible ? (
        <EyeOff aria-hidden="true" className="size-4" />
      ) : (
        <Eye aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

export function WorkerFormSheet({
  open,
  worker,
  workers,
  functions,
  onClose,
  onOpenWorker,
  onSaved,
}: WorkerFormSheetProps) {
  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const isSaving = createWorker.isPending || updateWorker.isPending;
  const [hasPix, setHasPix] = useState(Boolean(worker?.pagamento));
  const [showDuplicateConfirmation, setShowDuplicateConfirmation] =
    useState(false);
  const [saveError, setSaveError] = useState("");
  const [cpfVisible, setCpfVisible] = useState(false);
  const [pixVisible, setPixVisible] = useState(false);
  const form = useForm<TrabalhadorInput>({
    resolver: zodResolver(trabalhadorInputSchema),
    defaultValues: getDefaultValues(worker),
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldUnregister: true,
  });
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = form;
  const isDisabled = isSaving;
  const watchedName = useWatch({ control, name: "nome" });
  const watchedStatus = useWatch({ control, name: "status" });
  const watchedStartDate = useWatch({ control, name: "dataInicio" });
  const isThirdParty =
    useWatch({ control, name: "pagamento.chaveEmNomeDeTerceiro" }) ?? false;
  const pixType = useWatch({ control, name: "pagamento.tipoChave" }) ?? "CPF";

  const duplicateWorkers = useMemo(() => {
    const name = watchedName?.trim() ?? "";
    if (name.split(/\s+/).filter(Boolean).length < 2) return [];

    return workers.filter(
      (candidate) =>
        candidate.id !== worker?.id &&
        nameSimilarity(name, candidate.nome) >= 0.68,
    );
  }, [watchedName, workers, worker?.id]);

  useEffect(() => {
    if (!cpfVisible) return;
    const timeout = window.setTimeout(() => setCpfVisible(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [cpfVisible]);

  useEffect(() => {
    if (!pixVisible) return;
    const timeout = window.setTimeout(() => setPixVisible(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [pixVisible]);

  const cpfField = register("cpf");
  const phoneField = register("telefone");
  const nameField = register("nome");
  const pixCheckboxId = "worker-has-pix";
  const isFormDisabled = isDisabled;

  function enablePix(checked: boolean) {
    setHasPix(checked);
    setShowDuplicateConfirmation(false);
    if (checked) {
      setValue("pagamento", {
        tipoChave: "CPF",
        chavePix: "",
        banco: "",
        titularDaChave: watchedName ?? "",
        chaveEmNomeDeTerceiro: false,
      });
      return;
    }

    setValue("pagamento", undefined);
  }

  async function saveWorker(data: TrabalhadorInput, allowDuplicates: boolean) {
    if (duplicateWorkers.length > 0 && !allowDuplicates) {
      setShowDuplicateConfirmation(true);
      return;
    }

    setSaveError("");
    try {
      const payload: TrabalhadorInput = {
        ...data,
        telefone: data.telefone?.trim() || undefined,
        pagamento: data.pagamento
          ? {
              ...data.pagamento,
              titularDaChave: isThirdParty
                ? data.pagamento.titularDaChave
                : data.nome,
            }
          : undefined,
      };

      if (worker) {
        await updateWorker.mutateAsync({ id: worker.id, input: payload });
        toast.success("Cadastro atualizado com sucesso.");
      } else {
        await createWorker.mutateAsync(payload);
        toast.success("Trabalhador cadastrado com sucesso.");
      }

      onSaved();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o cadastro. Tente novamente.",
      );
    }
  }

  function requestSave(data: TrabalhadorInput) {
    void saveWorker(data, false);
  }

  function confirmAndSave() {
    void handleSubmit((data) => saveWorker(data, true))();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isDisabled) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-xl flex-col border-l bg-background shadow-2xl outline-none data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full transition-transform duration-200 sm:w-[min(100vw,40rem)]">
          <div className="flex min-h-20 items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                {worker ? "Editar trabalhador" : "Novo trabalhador"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Os campos marcados com * são obrigatórios.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar formulário"
              disabled={isDisabled}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit(requestSave)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
              {saveError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {saveError}
                </div>
              )}

              {duplicateWorkers.length > 0 && (
                <div
                  role="alert"
                  className="space-y-2 rounded-lg border border-amber-700/30 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-950 dark:text-amber-100"
                >
                  <p className="font-semibold">
                    Já existe{duplicateWorkers.length === 1 ? "" : "m"} nome
                    {duplicateWorkers.length === 1 ? "" : "s"} parecido
                    {duplicateWorkers.length === 1 ? "" : "s"}:
                  </p>
                  <ul className="space-y-1">
                    {duplicateWorkers.map((candidate) => (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          onClick={() => onOpenWorker(candidate)}
                          className="min-h-11 text-left font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          Abrir cadastro de {candidate.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {showDuplicateConfirmation ? (
                    <div className="space-y-2 border-t border-amber-700/20 pt-3 dark:border-amber-300/20">
                      <p>
                        Confira se não é um cadastro duplicado. Deseja salvar
                        mesmo assim?
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        onClick={() => setShowDuplicateConfirmation(false)}
                      >
                        Voltar ao formulário
                      </Button>
                    </div>
                  ) : (
                    <p>
                      Revise antes de salvar; será necessário confirmar se
                      quiser continuar.
                    </p>
                  )}
                </div>
              )}

              <section aria-labelledby="worker-personal-heading" className="space-y-4">
                <h3
                  id="worker-personal-heading"
                  className="text-base font-semibold"
                >
                  Dados do trabalhador
                </h3>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="worker-name" required>
                    Nome completo
                  </FieldLabel>
                  <input
                    id="worker-name"
                    autoComplete="name"
                    required
                    disabled={isFormDisabled}
                    aria-invalid={Boolean(errors.nome)}
                    aria-describedby={errors.nome ? "worker-name-error" : undefined}
                    {...nameField}
                    onChange={(event) => {
                      nameField.onChange(event);
                      setShowDuplicateConfirmation(false);
                    }}
                    className={fieldClassName}
                  />
                  <FieldError id="worker-name-error" message={errors.nome?.message} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="worker-function" required>
                      Função
                    </FieldLabel>
                    <select
                      id="worker-function"
                      required
                      disabled={isFormDisabled}
                      aria-invalid={Boolean(errors.funcaoId)}
                      aria-describedby={
                        errors.funcaoId ? "worker-function-error" : undefined
                      }
                      {...register("funcaoId", {
                        required: "Selecione a função.",
                      })}
                      className={`${fieldClassName} select-control`}
                    >
                      <option value="">Selecione</option>
                      {functions.map((funcao) => (
                        <option key={funcao.id} value={funcao.id}>
                          {funcao.nome}
                        </option>
                      ))}
                    </select>
                    <FieldError
                      id="worker-function-error"
                      message={errors.funcaoId?.message}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="worker-vinculo" required>
                      Vínculo
                    </FieldLabel>
                    <select
                      id="worker-vinculo"
                      required
                      disabled={isFormDisabled}
                      aria-invalid={Boolean(errors.vinculo)}
                      aria-describedby={
                        errors.vinculo ? "worker-vinculo-error" : undefined
                      }
                      {...register("vinculo")}
                      className={`${fieldClassName} select-control`}
                    >
                      {vinculoOptions.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <FieldError
                      id="worker-vinculo-error"
                      message={errors.vinculo?.message}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="worker-status" required>
                      Status
                    </FieldLabel>
                    <select
                      id="worker-status"
                      required
                      disabled={isFormDisabled}
                      {...register("status")}
                      className={`${fieldClassName} select-control`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="worker-start-date" required>
                      Data de início
                    </FieldLabel>
                    <input
                      id="worker-start-date"
                      type="date"
                      required
                      max={localToday()}
                      disabled={isFormDisabled}
                      aria-invalid={Boolean(errors.dataInicio)}
                      aria-describedby={
                        errors.dataInicio ? "worker-start-date-error" : undefined
                      }
                      {...register("dataInicio")}
                      className={fieldClassName}
                    />
                    <FieldError
                      id="worker-start-date-error"
                      message={errors.dataInicio?.message}
                    />
                  </div>
                </div>

                {watchedStatus === "Desligado" && (
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="worker-termination-date" required>
                      Data de desligamento
                    </FieldLabel>
                    <input
                      id="worker-termination-date"
                      type="date"
                      required
                      min={watchedStartDate}
                      max={localToday()}
                      disabled={isFormDisabled}
                      aria-invalid={Boolean(errors.dataDesligamento)}
                      aria-describedby={
                        errors.dataDesligamento
                          ? "worker-termination-date-error"
                          : undefined
                      }
                      {...register("dataDesligamento")}
                      className={fieldClassName}
                    />
                    <FieldError
                      id="worker-termination-date-error"
                      message={errors.dataDesligamento?.message}
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="worker-cpf" required>
                      CPF
                    </FieldLabel>
                    <div className="relative">
                      <input
                        id="worker-cpf"
                        type={cpfVisible ? "text" : "password"}
                        autoComplete="off"
                        required
                        inputMode="numeric"
                        maxLength={14}
                        disabled={isFormDisabled}
                        aria-invalid={Boolean(errors.cpf)}
                        aria-describedby={
                          errors.cpf ? "worker-cpf-error" : undefined
                        }
                        {...cpfField}
                        onChange={(event) => {
                          setValue("cpf", formatCpf(event.currentTarget.value), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        className={`${fieldClassName} pr-12`}
                      />
                      <EyeToggle
                        visible={cpfVisible}
                        onToggle={() => setCpfVisible((visible) => !visible)}
                        label="CPF"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O CPF fica oculto e será revelado por até 10 segundos.
                    </p>
                    <FieldError id="worker-cpf-error" message={errors.cpf?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="worker-birth-date" required>
                      Data de nascimento
                    </FieldLabel>
                    <input
                      id="worker-birth-date"
                      type="date"
                      required
                      max={localToday()}
                      disabled={isFormDisabled}
                      aria-invalid={Boolean(errors.dataNascimento)}
                      aria-describedby={
                        errors.dataNascimento
                          ? "worker-birth-date-error"
                          : undefined
                      }
                      {...register("dataNascimento")}
                      className={fieldClassName}
                    />
                    <FieldError
                      id="worker-birth-date-error"
                      message={errors.dataNascimento?.message}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="worker-phone">Telefone</FieldLabel>
                  <input
                    id="worker-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    disabled={isFormDisabled}
                    aria-invalid={Boolean(errors.telefone)}
                    aria-describedby={
                      errors.telefone ? "worker-phone-error" : undefined
                    }
                    {...phoneField}
                    onChange={(event) => {
                      setValue(
                        "telefone",
                        formatPhone(event.currentTarget.value),
                        { shouldDirty: true },
                      );
                    }}
                    className={fieldClassName}
                  />
                  <FieldError id="worker-phone-error" message={errors.telefone?.message} />
                </div>
              </section>

              <section
                aria-labelledby="worker-payment-heading"
                className="space-y-4 border-t pt-5"
              >
                <div>
                  <h3
                    id="worker-payment-heading"
                    className="text-base font-semibold"
                  >
                    Dados de pagamento
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O cadastro pode ser salvo sem uma chave PIX.
                  </p>
                </div>

                <div className="flex min-h-11 items-center gap-3">
                  <input
                    id={pixCheckboxId}
                    type="checkbox"
                    checked={hasPix}
                    disabled={isFormDisabled}
                    onChange={(event) => enablePix(event.currentTarget.checked)}
                    className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                  />
                  <label
                    htmlFor={pixCheckboxId}
                    className="cursor-pointer text-sm font-medium"
                  >
                    Informar dados de pagamento via PIX
                  </label>
                </div>

                {hasPix && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <FieldLabel htmlFor="worker-pix-type" required>
                          Tipo de chave
                        </FieldLabel>
                        <select
                          id="worker-pix-type"
                          required
                          disabled={isFormDisabled}
                          {...register("pagamento.tipoChave")}
                          className={`${fieldClassName} select-control`}
                        >
                          <option value="CPF">CPF</option>
                          <option value="Telefone">Telefone</option>
                          <option value="Email">E-mail</option>
                          <option value="Aleatoria">Aleatória</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <FieldLabel htmlFor="worker-pix-key" required>
                          Chave PIX
                        </FieldLabel>
                        <div className="relative">
                          <input
                            id="worker-pix-key"
                            type={pixVisible ? "text" : "password"}
                            autoComplete="off"
                            required
                            disabled={isFormDisabled}
                            aria-invalid={Boolean(errors.pagamento?.chavePix)}
                            aria-describedby={
                              errors.pagamento?.chavePix
                                ? "worker-pix-key-error"
                                : undefined
                            }
                            {...register("pagamento.chavePix")}
                            className={`${fieldClassName} pr-12`}
                          />
                          <EyeToggle
                            visible={pixVisible}
                            onToggle={() => setPixVisible((visible) => !visible)}
                            label="chave PIX"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {pixType === "CPF"
                            ? "Digite um CPF válido."
                            : pixType === "Telefone"
                              ? "Digite um telefone com DDD."
                              : pixType === "Email"
                                ? "Digite um endereço de e-mail válido."
                                : "Digite a chave aleatória cadastrada no banco."}
                          {" "}A chave fica oculta e será revelada por até 10 segundos.
                        </p>
                        <FieldError
                          id="worker-pix-key-error"
                          message={errors.pagamento?.chavePix?.message}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="worker-bank" required>
                        Banco
                      </FieldLabel>
                      <input
                        id="worker-bank"
                        autoComplete="organization"
                        required
                        disabled={isFormDisabled}
                        aria-invalid={Boolean(errors.pagamento?.banco)}
                        aria-describedby={
                          errors.pagamento?.banco
                            ? "worker-bank-error"
                            : undefined
                        }
                        {...register("pagamento.banco")}
                        className={fieldClassName}
                      />
                      <FieldError
                        id="worker-bank-error"
                        message={errors.pagamento?.banco?.message}
                      />
                    </div>

                    <div className="flex min-h-11 items-center gap-3">
                      <input
                        id="worker-third-party-pix"
                        type="checkbox"
                        disabled={isFormDisabled}
                        {...register("pagamento.chaveEmNomeDeTerceiro", {
                          onChange: (event) => {
                            setValue(
                              "pagamento.titularDaChave",
                              event.currentTarget.checked ? "" : watchedName ?? "",
                              { shouldDirty: true, shouldValidate: true },
                            );
                          },
                        })}
                        className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                      />
                      <label
                        htmlFor="worker-third-party-pix"
                        className="cursor-pointer text-sm font-medium"
                      >
                        A chave PIX está em nome de outra pessoa
                      </label>
                    </div>

                    {isThirdParty && (
                      <>
                        <div
                          role="alert"
                          className="rounded-lg border border-amber-700/30 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-950 dark:text-amber-100"
                        >
                          É necessário obter e guardar a autorização do titular
                          da chave PIX.
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel htmlFor="worker-pix-holder" required>
                            Nome do titular da chave
                          </FieldLabel>
                          <input
                            id="worker-pix-holder"
                            autoComplete="off"
                            required
                            disabled={isFormDisabled}
                            aria-invalid={Boolean(
                              errors.pagamento?.titularDaChave,
                            )}
                            aria-describedby={
                              errors.pagamento?.titularDaChave
                                ? "worker-pix-holder-error"
                                : undefined
                            }
                            {...register("pagamento.titularDaChave")}
                            className={fieldClassName}
                          />
                          <FieldError
                            id="worker-pix-holder-error"
                            message={
                              errors.pagamento?.titularDaChave?.message
                            }
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t bg-background px-4 py-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:flex-row sm:justify-end sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={isFormDisabled}
                onClick={onClose}
              >
                Cancelar
              </Button>
              {showDuplicateConfirmation ? (
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={isFormDisabled}
                  onClick={confirmAndSave}
                >
                  Confirmar e salvar mesmo assim
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={isFormDisabled}
                >
                  {isFormDisabled ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Plus aria-hidden="true" />
                  )}
                  {worker ? "Salvar alterações" : "Cadastrar trabalhador"}
                </Button>
              )}
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
