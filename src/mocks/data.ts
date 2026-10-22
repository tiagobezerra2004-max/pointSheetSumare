import type {
  Atividade,
  CodigoPresenca,
  Funcao,
  HoraExtra,
  HoraExtraHistory,
  Presenca,
  StatusTrabalhador,
  Trabalhador,
  Vinculo,
} from "@/schemas/data";
import { isValidCpf } from "@/schemas/data";

const hourlyRates = {
  ajudante: [11.79, 12.23],
  oficial: [16.22, 16.83],
  encarregado: [19.05, 19.77],
  tecnico: [43.26, 44.88],
  estagiario: [3.64, 3.77],
  aprendiz: [11.78, 12.23],
  vigia: [12.22, 12.68],
} as const;

function makeFunction(
  id: string,
  nome: string,
  rates: readonly [number, number],
): Funcao {
  return {
    id,
    nome,
    valorHoraSemana: rates[0],
    valorHoraSabado: rates[1],
  };
}

export const mockFunctions: Funcao[] = [
  makeFunction("funcao-ajudante", "Ajudante de obra", hourlyRates.ajudante),
  makeFunction("funcao-pedreiro", "Pedreiro", hourlyRates.oficial),
  makeFunction("funcao-eletricista", "Eletricista", hourlyRates.oficial),
  makeFunction("funcao-ferreiro", "Ferreiro", hourlyRates.oficial),
  makeFunction("funcao-bombeiro", "Bombeiro", hourlyRates.oficial),
  makeFunction("funcao-encarregado", "Encarregado", hourlyRates.encarregado),
  makeFunction("funcao-tecnico", "Técnico em edificações", hourlyRates.tecnico),
  makeFunction("funcao-estagiario", "Estagiário", hourlyRates.estagiario),
  makeFunction("funcao-aprendiz", "Jovem aprendiz", hourlyRates.aprendiz),
  makeFunction("funcao-vigia", "Vigia", hourlyRates.vigia),
];

type WorkerSeed = {
  nome: string;
  funcaoId: string;
  vinculo?: Vinculo;
  status?: StatusTrabalhador;
  dataInicio?: string;
  dataDesligamento?: string;
  semPagamento?: boolean;
};

const workerSeeds: WorkerSeed[] = [
  { nome: "Ana Beatriz Costa", funcaoId: "funcao-ajudante" },
  { nome: "André Luiz Martins", funcaoId: "funcao-pedreiro" },
  { nome: "Bruno Henrique Alves", funcaoId: "funcao-eletricista" },
  { nome: "Caio Roberto Lima", funcaoId: "funcao-ferreiro" },
  { nome: "Carlos Eduardo Souza", funcaoId: "funcao-bombeiro" },
  { nome: "Daniela Ferreira Rocha", funcaoId: "funcao-encarregado" },
  { nome: "Diego Matheus Ribeiro", funcaoId: "funcao-ajudante" },
  { nome: "Eduarda Nunes Carvalho", funcaoId: "funcao-tecnico" },
  { nome: "Felipe Augusto Mendes", funcaoId: "funcao-pedreiro" },
  { nome: "Gabriela Ramos Oliveira", funcaoId: "funcao-estagiario", vinculo: "Estagiario" },
  { nome: "Gustavo Pereira Santos", funcaoId: "funcao-aprendiz", vinculo: "JovemAprendiz" },
  { nome: "Igor Vinicius Barros", funcaoId: "funcao-vigia", vinculo: "Vigia" },
  { nome: "João Pedro Almeida", funcaoId: "funcao-ajudante" },
  { nome: "João Paulo Almeida", funcaoId: "funcao-pedreiro" },
  { nome: "Juliana Mendes Castro", funcaoId: "funcao-eletricista" },
  { nome: "Lucas Gabriel Freitas", funcaoId: "funcao-ferreiro" },
  { nome: "Mariana Lopes Teixeira", funcaoId: "funcao-bombeiro" },
  { nome: "Mateus Carvalho Dias", funcaoId: "funcao-encarregado" },
  { nome: "Nicolas Ribeiro Campos", funcaoId: "funcao-ajudante", semPagamento: true },
  { nome: "Otávio Moreira Pinto", funcaoId: "funcao-tecnico" },
  { nome: "Paula Cristina Azevedo", funcaoId: "funcao-estagiario", vinculo: "Estagiario" },
  { nome: "Rafael Augusto Melo", funcaoId: "funcao-aprendiz", vinculo: "JovemAprendiz" },
  { nome: "Renata Carvalho Leite", funcaoId: "funcao-vigia", vinculo: "Vigia" },
  { nome: "Ricardo Gomes Batista", funcaoId: "funcao-ajudante" },
  { nome: "Samuel Ferreira Nogueira", funcaoId: "funcao-pedreiro" },
  { nome: "Sofia Martins Cardoso", funcaoId: "funcao-eletricista" },
  { nome: "Thiago Barros Fonseca", funcaoId: "funcao-ferreiro" },
  { nome: "Valéria Costa Farias", funcaoId: "funcao-bombeiro" },
  { nome: "Vinícius Andrade Moreira", funcaoId: "funcao-encarregado", status: "Desligado", dataDesligamento: "2025-12-19" },
  { nome: "Wesley Tavares Machado", funcaoId: "funcao-ajudante", status: "Afastado" },
];

function makeFakeCpf(index: number): string {
  const base = String(100_000_000 + index * 7919).padStart(9, "0");
  const digits = base.split("").map(Number);
  for (const length of [9, 10]) {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, position) => total + digit * (length + 1 - position), 0);
    const remainder = sum % 11;
    digits.push(remainder < 2 ? 0 : 11 - remainder);
  }
  const cpf = digits.join("");
  if (!isValidCpf(cpf)) {
    throw new Error("Não foi possível gerar o CPF fictício de demonstração.");
  }
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export const mockWorkers: Trabalhador[] = workerSeeds.map((worker, index) => {
  const id = `trabalhador-${String(index + 1).padStart(3, "0")}`;
  const month = String((index % 9) + 1).padStart(2, "0");
  const dataInicio = worker.dataInicio ?? `202${index % 5}-${month}-15`;

  return {
    id,
    nome: worker.nome,
    funcaoId: worker.funcaoId,
    vinculo: worker.vinculo ?? "CLT",
    status: worker.status ?? "Ativo",
    dataInicio,
    ...(worker.dataDesligamento
      ? { dataDesligamento: worker.dataDesligamento }
      : {}),
    cpf: makeFakeCpf(index + 1),
    dataNascimento: `19${80 + (index % 20)}-${month}-10`,
    telefone: `+55 11 90000-${String(1000 + index).slice(-4)}`,
    ...(!worker.semPagamento
      ? {
          pagamento: {
            tipoChave: "Email" as const,
            chavePix: `trabalhador${index + 1}@example.invalid`,
            banco: "Banco Fictício",
            titularDaChave: worker.nome,
            chaveEmNomeDeTerceiro: false,
          },
        }
      : {}),
  };
});

export const mockActivities: Atividade[] = [
  { id: "atividade-pista", nome: "Pista" },
  { id: "atividade-pista-radier", nome: "Pista radier" },
  { id: "atividade-laje", nome: "Laje" },
  { id: "atividade-argamassa", nome: "Argamassa" },
  { id: "atividade-ferragem", nome: "Ferragem das casas" },
  { id: "atividade-descarregamento", nome: "Descarregando caminhão" },
  { id: "atividade-montagem", nome: "Montagem de casa" },
  { id: "atividade-vigia", nome: "Vigia" },
  { id: "atividade-outros", nome: "Outros" },
];

const sampleDate = "2026-10-22";
const attendanceCodes: CodigoPresenca[] = ["P", "P", "P", "F", "A", "FC"];

export const mockAttendances: Presenca[] = mockWorkers
  .filter((worker) => worker.status === "Ativo")
  .slice(0, 12)
  .map((worker, index) => ({
    id: `presenca-${String(index + 1).padStart(3, "0")}`,
    trabalhadorId: worker.id,
    data: sampleDate,
    codigo: attendanceCodes[index % attendanceCodes.length],
    ...(index === 4 ? { observacao: "Registro de demonstração." } : {}),
  }));

export const mockOvertimeEntries: HoraExtra[] = [
  {
    id: "hora-extra-001",
    trabalhadorId: "trabalhador-002",
    data: sampleDate,
    horas: 2,
    atividadeId: "atividade-laje",
    observacao: "Dado fictício de demonstração.",
    valorCalculado: 33.66,
  },
  {
    id: "hora-extra-002",
    trabalhadorId: "trabalhador-006",
    data: "2026-10-17",
    horas: 1.5,
    atividadeId: "atividade-montagem",
    valorCalculado: 29.66,
  },
];

export const mockOvertimeHistory: HoraExtraHistory[] = [];
