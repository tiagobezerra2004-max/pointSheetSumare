import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getAttendances,
  saveAttendances,
} from "@/api/attendance";
import { getFunctions, getWorkers } from "@/api/workers";
import { AttendancePage } from "@/components/attendance/attendance-page";
import { MockServiceWorkerStatusContext } from "@/components/providers/mock-service-worker-context";
import type { Presenca, Trabalhador } from "@/schemas/data";

jest.mock("@/api/attendance", () => ({
  getAttendances: jest.fn(),
  saveAttendances: jest.fn(),
}));

jest.mock("@/api/workers", () => ({
  getFunctions: jest.fn(),
  getWorkers: jest.fn(),
}));

const worker: Trabalhador = {
  id: "worker-1",
  nome: "João Pedro Almeida",
  funcaoId: "funcao-ajudante",
  vinculo: "CLT",
  status: "Ativo",
  dataInicio: "2024-01-10",
  cpf: "529.982.247-25",
  dataNascimento: "1990-05-20",
};

const attendance: Presenca = {
  id: "attendance-1",
  trabalhadorId: worker.id,
  data: "2026-10-22",
  codigo: "P",
};

function renderAttendancePage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MockServiceWorkerStatusContext.Provider value="ready">
        <AttendancePage />
      </MockServiceWorkerStatusContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getWorkers).mockResolvedValue([worker]);
  jest.mocked(getFunctions).mockResolvedValue([
    {
      id: "funcao-ajudante",
      nome: "Ajudante de obra",
      valorHoraSemana: 11.79,
      valorHoraSabado: 12.23,
    },
  ]);
  jest.mocked(getAttendances).mockResolvedValue([attendance]);
  jest.mocked(saveAttendances).mockResolvedValue([attendance]);
});

describe("tela de frequência RF02", () => {
  it("mostra códigos, contadores e permite editar presença diária", async () => {
    renderAttendancePage();

    expect(await screen.findByText("Presentes")).toBeInTheDocument();
    expect(screen.getByText("Faltas")).toBeInTheDocument();
    expect(screen.getByText("Sem lançamento")).toBeInTheDocument();
    expect(
      await screen.findByRole("radiogroup", {
        name: "Presença de João Pedro Almeida",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("a definir")).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("radio", {
        name: "F — Falta",
      }),
    );

    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar frequência" }),
    ).toBeEnabled();
  });

  it("exibe a vista mensal somente leitura com os dias do mês selecionado", async () => {
    renderAttendancePage();
    await screen.findByText("Presentes");
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));

    const table = await screen.findByRole("table", {
      name: "Consulta somente leitura da frequência por trabalhador e dia",
    });
    const lastDayOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
    ).getDate();
    expect(within(table).getAllByRole("columnheader")).toHaveLength(
      lastDayOfMonth + 1,
    );
    expect(screen.getByText("Consulta somente leitura")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar frequência" }),
    ).not.toBeInTheDocument();
  });
});
