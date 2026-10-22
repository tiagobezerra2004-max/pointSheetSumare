import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWorker, updateWorker } from "@/api/workers";
import {
  WorkerFormSheet,
} from "@/components/workers/worker-form-sheet";
import type { Trabalhador } from "@/schemas/data";

jest.mock("@/api/workers", () => ({
  createWorker: jest.fn(),
  updateWorker: jest.fn(),
}));

const existingWorker: Trabalhador = {
  id: "worker-1",
  nome: "João Pedro Almeida",
  funcaoId: "funcao-ajudante",
  vinculo: "CLT",
  status: "Ativo",
  dataInicio: "2024-01-10",
  cpf: "529.982.247-25",
  dataNascimento: "1990-05-20",
};

function renderForm(workers: Trabalhador[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkerFormSheet
        open
        worker={null}
        workers={workers}
        functions={[
          {
            id: "funcao-ajudante",
            nome: "Ajudante de obra",
            valorHoraSemana: 11.79,
            valorHoraSabado: 12.23,
          },
        ]}
        onClose={jest.fn()}
        onOpenWorker={jest.fn()}
        onSaved={jest.fn()}
      />
    </QueryClientProvider>,
  );
}

function fillValidWorker(name = "Maria da Silva") {
  fireEvent.change(screen.getByLabelText("Nome completo *"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText("Função *"), {
    target: { value: "funcao-ajudante" },
  });
  fireEvent.change(screen.getByLabelText("CPF *"), {
    target: { value: "529.982.247-25" },
  });
  fireEvent.change(screen.getByLabelText("Data de nascimento *"), {
    target: { value: "1990-05-20" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createWorker).mockResolvedValue({ ...existingWorker });
  jest.mocked(updateWorker).mockResolvedValue({ ...existingWorker });
});

describe("formulário de trabalhador", () => {
  it("mostra erros de validação junto aos campos obrigatórios", async () => {
    renderForm();
    fillValidWorker("João");
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar trabalhador" }),
    );

    expect(
      await screen.findByText("Informe nome e sobrenome."),
    ).toBeInTheDocument();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("mostra erro quando o CPF não é válido", async () => {
    renderForm();
    fillValidWorker();
    fireEvent.change(screen.getByLabelText("CPF *"), {
      target: { value: "111.111.111-11" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar trabalhador" }),
    );

    expect(await screen.findByText("Informe um CPF válido.")).toBeInTheDocument();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("avisa sobre chave PIX de terceiro e exige o titular", async () => {
    renderForm();
    fillValidWorker();

    fireEvent.click(
      screen.getByLabelText("Informar dados de pagamento via PIX"),
    );
    fireEvent.change(screen.getByLabelText("Tipo de chave *"), {
      target: { value: "Email" },
    });
    fireEvent.change(screen.getByLabelText("Chave PIX *"), {
      target: { value: "maria@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Banco *"), {
      target: { value: "Banco fictício" },
    });
    fireEvent.click(
      screen.getByLabelText("A chave PIX está em nome de outra pessoa"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar trabalhador" }),
    );

    expect(
      await screen.findByText(
        "É necessário obter e guardar a autorização do titular da chave PIX.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Informe o titular da chave."),
    ).toBeInTheDocument();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("exige confirmar antes de salvar um nome parecido", async () => {
    renderForm([existingWorker]);
    fillValidWorker("João Paulo Almeida");
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar trabalhador" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Abrir cadastro de João Pedro Almeida",
      }),
    ).toBeInTheDocument();
    expect(createWorker).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirmar e salvar mesmo assim",
      }),
    );

    await waitFor(() => expect(createWorker).toHaveBeenCalledTimes(1));
  });
});
