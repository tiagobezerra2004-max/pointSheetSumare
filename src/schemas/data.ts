import { z } from "zod";

const isoDateSchema = z.string().refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  { message: "Informe uma data válida no formato AAAA-MM-DD." },
);

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number, weight: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (weight - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(9, 10) === Number(digits[9]) &&
    calculateDigit(10, 11) === Number(digits[10])
  );
}

export const vinculoSchema = z.enum([
  "CLT",
  "Avulso",
  "Vigia",
  "JovemAprendiz",
  "Estagiario",
]);

export const statusTrabalhadorSchema = z.enum([
  "Ativo",
  "Desligado",
  "Afastado",
]);

export const codigoPresencaSchema = z.enum(["P", "F", "A", "FC"]);

export const funcaoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  valorHoraSemana: z.number().nonnegative(),
  valorHoraSabado: z.number().nonnegative(),
});

const tipoChavePixSchema = z.enum(["CPF", "Telefone", "Email", "Aleatoria"]);

export const pagamentoSchema = z.object({
  tipoChave: tipoChavePixSchema,
  chavePix: z.string().trim().min(1, "Informe a chave PIX."),
  banco: z.string().trim().min(1, "Informe o banco."),
  titularDaChave: z.string().trim().min(1, "Informe o titular da chave."),
  chaveEmNomeDeTerceiro: z.boolean(),
}).superRefine((pagamento, context) => {
  const chave = pagamento.chavePix.trim();
  const coerente =
    pagamento.tipoChave === "Email"
      ? z.email().safeParse(chave).success
      : pagamento.tipoChave === "CPF"
        ? isValidCpf(chave)
        : pagamento.tipoChave === "Telefone"
          ? /^\d{10,13}$/.test(chave.replace(/\D/g, ""))
          : chave.length >= 8;

  if (!coerente) {
    context.addIssue({
      code: "custom",
      path: ["chavePix"],
      message: "A chave PIX não corresponde ao tipo selecionado.",
    });
  }
});

const trabalhadorFieldsSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").refine(
    (nome) => nome.split(/\s+/).filter(Boolean).length >= 2,
    "Informe nome e sobrenome.",
  ),
  funcaoId: z.string().min(1),
  vinculo: vinculoSchema,
  status: statusTrabalhadorSchema,
  dataInicio: isoDateSchema,
  dataDesligamento: isoDateSchema.optional(),
  cpf: z.string().refine(isValidCpf, "Informe um CPF válido."),
  dataNascimento: isoDateSchema,
  telefone: z.string().optional(),
  pagamento: pagamentoSchema.optional(),
});

function validateTrabalhadorDates(
  trabalhador: z.infer<typeof trabalhadorFieldsSchema>,
  context: z.RefinementCtx,
) {
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (trabalhador.dataInicio > todayIso) {
    context.addIssue({
      code: "custom",
      path: ["dataInicio"],
      message: "A data de início não pode ser futura.",
    });
  }

  if (trabalhador.status === "Desligado" && !trabalhador.dataDesligamento) {
    context.addIssue({
      code: "custom",
      path: ["dataDesligamento"],
      message: "Informe a data de desligamento.",
    });
  }

  if (
    trabalhador.dataDesligamento &&
    trabalhador.dataDesligamento < trabalhador.dataInicio
  ) {
    context.addIssue({
      code: "custom",
      path: ["dataDesligamento"],
      message: "A data de desligamento não pode ser anterior ao início.",
    });
  }
}

export const trabalhadorSchema = z
  .object({ id: z.string().min(1), ...trabalhadorFieldsSchema.shape })
  .superRefine(validateTrabalhadorDates);

export const trabalhadorInputSchema =
  trabalhadorFieldsSchema.superRefine(validateTrabalhadorDates);

export const presencaSchema = z.object({
  id: z.string().min(1),
  trabalhadorId: z.string().min(1),
  data: isoDateSchema,
  codigo: codigoPresencaSchema,
  observacao: z.string().optional(),
});

export const presencaInputSchema = presencaSchema.omit({ id: true });
export const presencasLoteSchema = z.array(presencaInputSchema);

export const atividadeSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
});

export const horaExtraSchema = z.object({
  id: z.string().min(1),
  trabalhadorId: z.string().min(1, "Selecione um trabalhador."),
  data: isoDateSchema,
  horas: z
    .number()
    .positive("Informe uma quantidade de horas maior que zero.")
    .max(12, "O máximo permitido é 12 horas.")
    .multipleOf(0.5, "Informe as horas em intervalos de 0,5."),
  atividadeId: z.string().min(1, "Selecione uma atividade."),
  observacao: z
    .string()
    .max(500, "A observação deve ter no máximo 500 caracteres.")
    .optional(),
  valorCalculado: z.number().nonnegative(),
});

export const horaExtraInputSchema = horaExtraSchema.omit({
  id: true,
  valorCalculado: true,
});

const motivoHoraExtraSchema = z
  .string()
  .trim()
  .min(3, "Informe um motivo com pelo menos 3 caracteres.")
  .max(500, "O motivo deve ter no máximo 500 caracteres.");

export const horaExtraUpdateSchema = z.object({
  trabalhadorId: horaExtraInputSchema.shape.trabalhadorId,
  data: horaExtraInputSchema.shape.data,
  horas: horaExtraInputSchema.shape.horas,
  atividadeId: horaExtraInputSchema.shape.atividadeId,
  observacao: horaExtraInputSchema.shape.observacao,
  motivo: motivoHoraExtraSchema,
});

export const horaExtraDeleteSchema = z.object({
  motivo: motivoHoraExtraSchema,
});

export const horaExtraHistorySchema = z.object({
  id: z.string().min(1),
  horaExtraId: z.string().min(1),
  acao: z.enum(["edicao", "exclusao"]),
  motivo: motivoHoraExtraSchema,
  criadoEm: z.iso.datetime(),
  registroAnterior: horaExtraSchema,
  registroAtual: horaExtraSchema.optional(),
});

export const horaExtraMutationResponseSchema = z.object({
  success: z.literal(true),
});

export const horasExtrasResponseSchema = z.object({
  items: z.array(horaExtraSchema),
  total: z.number().nonnegative(),
});

export type Vinculo = z.infer<typeof vinculoSchema>;
export type StatusTrabalhador = z.infer<typeof statusTrabalhadorSchema>;
export type CodigoPresenca = z.infer<typeof codigoPresencaSchema>;
export type Funcao = z.infer<typeof funcaoSchema>;
export type Pagamento = z.infer<typeof pagamentoSchema>;
export type Trabalhador = z.infer<typeof trabalhadorSchema>;
export type TrabalhadorInput = z.infer<typeof trabalhadorInputSchema>;
export type Presenca = z.infer<typeof presencaSchema>;
export type PresencaInput = z.infer<typeof presencaInputSchema>;
export type Atividade = z.infer<typeof atividadeSchema>;
export type HoraExtra = z.infer<typeof horaExtraSchema>;
export type HoraExtraInput = z.infer<typeof horaExtraInputSchema>;
export type HoraExtraUpdate = z.infer<typeof horaExtraUpdateSchema>;
export type HoraExtraDelete = z.infer<typeof horaExtraDeleteSchema>;
export type HoraExtraHistory = z.infer<typeof horaExtraHistorySchema>;
export type HorasExtrasResponse = z.infer<typeof horasExtrasResponseSchema>;
