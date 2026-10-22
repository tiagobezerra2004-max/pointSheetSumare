import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getAttendances,
} from "@/api/attendance";
import {
  createOvertimeEntry,
  deleteOvertimeEntry,
  getActivities,
  getOvertimeEntries,
  updateOvertimeEntry,
} from "@/api/overtime";
import { getFunctions, getWorkers } from "@/api/workers";
import { OvertimePage } from "@/components/overtime/overtime-page";
import { MockServiceWorkerStatusContext } from "@/components/providers/mock-service-worker-context";
import type { HoraExtra, Trabalhador } from "@/schemas/data";

jest.mock("@/api/attendance", () => ({
  getAttendances: jest.fn(),
  saveAttendances: jest.fn(),
}));

jest.mock("@/api/overtime", () => ({
  createOvertimeEntry: jest.fn(),
  deleteOvertimeEntry: jest.fn(),
  getActivities: jest.fn(),
  getOvertimeEntries: jest.fn(),
  updateOvertimeEntry: jest.fn(),
}));

jest.mock("@/api/workers", () => ({
  createWorker: jest.fn(),
  getFunctions: jest.fn(),
  getWorkers: jest.fn(),
  updateWorker: jest.fn(),
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

const entry: HoraExtra = {
  id: "overtime-1",
  trabalhadorId: worker.id,
  data: "2026-10-22",
  horas: 2,
  atividadeId: "activity-laje",
  valorCalculado: 23.58,
};

function renderOvertimePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MockServiceWorkerStatusContext.Provider value="ready">
        <OvertimePage />
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
  jest.mocked(getActivities).mockResolvedValue([
    { id: "activity-laje", nome: "Laje" },
  ]);
  jest.mocked(getAttendances).mockResolvedValue([]);
  jest.mocked(getOvertimeEntries).mockResolvedValue({
    items: [entry],
    total: 23.58,
  });
  jest.mocked(createOvertimeEntry).mockResolvedValue(entry);
  jest.mocked(updateOvertimeEntry).mockResolvedValue(entry);
  jest.mocked(deleteOvertimeEntry).mockResolvedValue({ success: true });
});

describe("tela de horas extras RF03", () => {
  it("lista os lançamentos e mostra o total calculado pela API", async () => {
    renderOvertimePage();

    expect(
      await screen.findByText("1 lançamento no período"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText((text) => text.includes("23,58")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("João Pedro Almeida").length).toBeGreaterThan(0);
  });

  it("exige motivo antes de atualizar um lançamento", async () => {
    renderOvertimePage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Editar hora extra de João Pedro Almeida",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar hora extra",
    });
    expect(within(dialog).getByText("Dia de semana")).toBeInTheDocument();
    expect(
      within(dialog).getByText((text) => text.includes("23,58")),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(
      await screen.findByText("Informe um motivo com pelo menos 3 caracteres."),
    ).toBeInTheDocument();
    expect(updateOvertimeEntry).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it("confirma e registra o motivo ao editar um lançamento", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    renderOvertimePage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Editar hora extra de João Pedro Almeida",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar hora extra",
    });
    fireEvent.change(
      screen.getByLabelText("Motivo da edição *"),
      { target: { value: "Ajuste solicitado pela engenharia" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmar edição" }),
    );

    await waitFor(() =>
      expect(updateOvertimeEntry).toHaveBeenCalledWith(
        entry.id,
        expect.objectContaining({ horas: entry.horas }),
        "Ajuste solicitado pela engenharia",
      ),
    );
    expect(dialog).not.toBeInTheDocument();
  });

  it("exige motivo e confirma a exclusão", async () => {
    renderOvertimePage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Excluir hora extra de João Pedro Almeida",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Excluir lançamento?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirmar exclusão" }),
    );
    expect(
      await within(dialog).findByText(
        "Informe um motivo com pelo menos 3 caracteres.",
      ),
    ).toBeInTheDocument();
    expect(deleteOvertimeEntry).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Motivo obrigatório"), {
      target: { value: "Lançamento duplicado" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirmar exclusão" }),
    );

    await waitFor(() =>
      expect(deleteOvertimeEntry).toHaveBeenCalledWith(
        entry.id,
        "Lançamento duplicado",
      ),
    );
  });

  it("valida trabalhador e atividade no formulário de novo lançamento", async () => {
    renderOvertimePage();
    await screen.findByText("1 lançamento no período");
    fireEvent.click(
      screen.getByRole("button", { name: "Novo lançamento" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Lançar hora extra" }),
    );

    expect(await screen.findByText("Selecione um trabalhador.")).toBeInTheDocument();
    expect(await screen.findByText("Selecione uma atividade.")).toBeInTheDocument();
    expect(createOvertimeEntry).not.toHaveBeenCalled();
  });

});
