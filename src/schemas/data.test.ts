import {
  horaExtraDeleteSchema,
  horaExtraInputSchema,
  trabalhadorInputSchema,
  type TrabalhadorInput,
} from "./data";

const validWorker: TrabalhadorInput = {
  nome: "João da Silva",
  funcaoId: "funcao-ajudante",
  vinculo: "CLT",
  status: "Ativo",
  dataInicio: "2025-01-10",
  cpf: "529.982.247-25",
  dataNascimento: "1990-05-20",
};

describe("validação de trabalhador", () => {
  it("aceita um cadastro válido e sem dados de pagamento", () => {
    expect(trabalhadorInputSchema.safeParse(validWorker).success).toBe(true);
  });

  describe("validação de hora extra", () => {
    const validOvertime = {
      trabalhadorId: "trabalhador-001",
      data: "2026-10-22",
      horas: 1.5,
      atividadeId: "atividade-laje",
      observacao: "Atividade concluída.",
    };

    it("aceita um lançamento válido", () => {
      expect(horaExtraInputSchema.safeParse(validOvertime).success).toBe(true);
    });

    it.each([0, 0.25, 12.5])(
      "rejeita quantidade inválida de horas: %s",
      (horas) => {
        expect(
          horaExtraInputSchema.safeParse({ ...validOvertime, horas }).success,
        ).toBe(false);
      },
    );

    it("exige motivo com ao menos 3 caracteres para excluir", () => {
      expect(horaExtraDeleteSchema.safeParse({ motivo: "  " }).success).toBe(
        false,
      );
      expect(
        horaExtraDeleteSchema.safeParse({
          motivo: "Correção solicitada.",
        }).success,
      ).toBe(true);
    });
  });

  it("exige nome e sobrenome", () => {
    const result = trabalhadorInputSchema.safeParse({
      ...validWorker,
      nome: "João",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["nome"],
          message: "Informe nome e sobrenome.",
        }),
      );
    }
  });

  it("rejeita CPF inválido", () => {
    expect(
      trabalhadorInputSchema.safeParse({ ...validWorker, cpf: "111.111.111-11" })
        .success,
    ).toBe(false);
  });

  it("não aceita data de início futura", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    const result = trabalhadorInputSchema.safeParse({
      ...validWorker,
      dataInicio: date,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["dataInicio"],
          message: "A data de início não pode ser futura.",
        }),
      );
    }
  });

  it("exige a data de desligamento para trabalhador desligado", () => {
    const result = trabalhadorInputSchema.safeParse({
      ...validWorker,
      status: "Desligado",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["dataDesligamento"] }),
      );
    }
  });

  it("rejeita desligamento anterior à data de início", () => {
    expect(
      trabalhadorInputSchema.safeParse({
        ...validWorker,
        status: "Desligado",
        dataInicio: "2025-02-01",
        dataDesligamento: "2025-01-31",
      }).success,
    ).toBe(false);
  });

  it("valida o tipo da chave PIX", () => {
    expect(
      trabalhadorInputSchema.safeParse({
        ...validWorker,
        pagamento: {
          tipoChave: "Email",
          chavePix: "não-é-email",
          banco: "Banco",
          titularDaChave: validWorker.nome,
          chaveEmNomeDeTerceiro: false,
        },
      }).success,
    ).toBe(false);
  });
});
