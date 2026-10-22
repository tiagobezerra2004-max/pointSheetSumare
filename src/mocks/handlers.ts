import { http, HttpResponse } from "msw";
import { z } from "zod";
import {
  horaExtraInputSchema,
  horaExtraUpdateSchema,
  horaExtraDeleteSchema,
  presencasLoteSchema,
  trabalhadorInputSchema,
  type HoraExtra,
  type HoraExtraHistory,
  type Presenca,
  type Trabalhador,
} from "@/schemas/data";
import {
  mockActivities,
  mockAttendances,
  mockFunctions,
  mockOvertimeEntries,
  mockOvertimeHistory,
  mockWorkers,
} from "./data";

function parseBody<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: { message: string } } },
  body: unknown,
): T | Response {
  const result = schema.safeParse(body);
  if (!result.success || result.data === undefined) {
    return HttpResponse.json(
      { message: result.error?.message ?? "Os dados enviados são inválidos." },
      { status: 400 },
    );
  }
  return result.data;
}

function isErrorResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function getOvertimeValue(entry: Omit<HoraExtra, "id" | "valorCalculado">): number | null {
  const worker = mockWorkers.find(({ id }) => id === entry.trabalhadorId);
  const funcao = mockFunctions.find(({ id }) => id === worker?.funcaoId);
  if (!funcao) return null;

  const isSaturday = new Date(`${entry.data}T00:00:00.000Z`).getUTCDay() === 6;
  const hourlyRate = isSaturday ? funcao.valorHoraSabado : funcao.valorHoraSemana;
  return Math.round((hourlyRate * entry.horas + Number.EPSILON) * 100) / 100;
}

export const handlers = [
  http.get("/api/health", () =>
    HttpResponse.json({ status: "ok", source: "mock" }),
  ),
  http.get("/api/funcoes", () => HttpResponse.json(mockFunctions)),
  http.get("/api/trabalhadores", () => HttpResponse.json(mockWorkers)),
  http.post("/api/trabalhadores", async ({ request }) => {
    const parsed = parseBody<z.infer<typeof trabalhadorInputSchema>>(
      trabalhadorInputSchema,
      await request.json(),
    );
    if (isErrorResponse(parsed)) return parsed;

    const worker: Trabalhador = {
      ...parsed,
      id: `trabalhador-${crypto.randomUUID()}`,
    };
    mockWorkers.push(worker);
    return HttpResponse.json(worker, { status: 201 });
  }),
  http.put("/api/trabalhadores/:id", async ({ params, request }) => {
    const index = mockWorkers.findIndex(({ id }) => id === params.id);
    if (index === -1) {
      return HttpResponse.json({ message: "Trabalhador não encontrado." }, { status: 404 });
    }

    const parsed = parseBody<z.infer<typeof trabalhadorInputSchema>>(
      trabalhadorInputSchema,
      await request.json(),
    );
    if (isErrorResponse(parsed)) return parsed;

    const worker: Trabalhador = { ...parsed, id: mockWorkers[index].id };
    mockWorkers[index] = worker;
    return HttpResponse.json(worker);
  }),
  http.get("/api/presencas", ({ request }) => {
    const date = new URL(request.url).searchParams.get("data");
    return HttpResponse.json(
      date
        ? mockAttendances.filter((attendance) => attendance.data === date)
        : mockAttendances,
    );
  }),
  http.put("/api/presencas/lote", async ({ request }) => {
    const parsed = parseBody<z.infer<typeof presencasLoteSchema>>(
      presencasLoteSchema,
      await request.json(),
    );
    if (isErrorResponse(parsed)) return parsed;

    const updated: Presenca[] = parsed.map((input) => {
      const index = mockAttendances.findIndex(
        (attendance) =>
          attendance.trabalhadorId === input.trabalhadorId &&
          attendance.data === input.data,
      );
      const attendance: Presenca = {
        ...input,
        id:
          index === -1
            ? `presenca-${crypto.randomUUID()}`
            : mockAttendances[index].id,
      };

      if (index === -1) mockAttendances.push(attendance);
      else mockAttendances[index] = attendance;
      return attendance;
    });

    return HttpResponse.json(updated);
  }),
  http.get("/api/atividades", () => HttpResponse.json(mockActivities)),
  http.get("/api/horas-extras", ({ request }) => {
    const search = new URL(request.url).searchParams;
    const items = mockOvertimeEntries.filter((entry) => {
      const start = search.get("dataInicio");
      const end = search.get("dataFim");
      return (
        (!search.get("trabalhadorId") ||
          entry.trabalhadorId === search.get("trabalhadorId")) &&
        (!search.get("atividadeId") ||
          entry.atividadeId === search.get("atividadeId")) &&
        (!start || entry.data >= start) &&
        (!end || entry.data <= end)
      );
    });
    const total = Math.round(
      items.reduce((sum, entry) => sum + entry.valorCalculado, 0) * 100,
    ) / 100;
    return HttpResponse.json({ items, total });
  }),
  http.post("/api/horas-extras", async ({ request }) => {
    const parsed = parseBody<z.infer<typeof horaExtraInputSchema>>(
      horaExtraInputSchema,
      await request.json(),
    );
    if (isErrorResponse(parsed)) return parsed;
    if (!mockActivities.some(({ id }) => id === parsed.atividadeId)) {
      return HttpResponse.json({ message: "Selecione uma atividade válida." }, { status: 400 });
    }

    const valorCalculado = getOvertimeValue(parsed);
    if (valorCalculado === null) {
      return HttpResponse.json({ message: "Trabalhador ou função não encontrado." }, { status: 400 });
    }

    const entry: HoraExtra = {
      ...parsed,
      id: `hora-extra-${crypto.randomUUID()}`,
      valorCalculado,
    };
    mockOvertimeEntries.push(entry);
    return HttpResponse.json(entry, { status: 201 });
  }),
  http.put("/api/horas-extras/:id", async ({ params, request }) => {
    const index = mockOvertimeEntries.findIndex(({ id }) => id === params.id);
    if (index === -1) {
      return HttpResponse.json({ message: "Lançamento não encontrado." }, { status: 404 });
    }

    const parsed = parseBody<z.infer<typeof horaExtraUpdateSchema>>(
      horaExtraUpdateSchema,
      await request.json(),
    );
    if (isErrorResponse(parsed)) return parsed;

    const { motivo, ...input } = parsed;
    if (!mockActivities.some(({ id }) => id === input.atividadeId)) {
      return HttpResponse.json({ message: "Selecione uma atividade válida." }, { status: 400 });
    }
    const valorCalculado = getOvertimeValue(input);
    if (valorCalculado === null) {
      return HttpResponse.json({ message: "Trabalhador ou função não encontrado." }, { status: 400 });
    }

    const previous = mockOvertimeEntries[index];
    const updated: HoraExtra = { ...input, id: previous.id, valorCalculado };
    mockOvertimeEntries[index] = updated;
    const historyEntry: HoraExtraHistory = {
      id: `historico-hora-extra-${crypto.randomUUID()}`,
      horaExtraId: previous.id,
      acao: "edicao",
      motivo,
      criadoEm: new Date().toISOString(),
      registroAnterior: previous,
      registroAtual: updated,
    };
    mockOvertimeHistory.push(historyEntry);
    return HttpResponse.json(updated);
  }),
  http.delete("/api/horas-extras/:id", async ({ params, request }) => {
    const index = mockOvertimeEntries.findIndex(({ id }) => id === params.id);
    if (index === -1) {
      return HttpResponse.json({ message: "Lançamento não encontrado." }, { status: 404 });
    }

    const parsed = parseBody<z.infer<typeof horaExtraDeleteSchema>>(
      horaExtraDeleteSchema,
      await request.json(),
    );
    if (isErrorResponse(parsed)) return parsed;

    const [previous] = mockOvertimeEntries.splice(index, 1);
    mockOvertimeHistory.push({
      id: `historico-hora-extra-${crypto.randomUUID()}`,
      horaExtraId: previous.id,
      acao: "exclusao",
      motivo: parsed.motivo,
      criadoEm: new Date().toISOString(),
      registroAnterior: previous,
    });
    return HttpResponse.json({ success: true });
  }),
];
