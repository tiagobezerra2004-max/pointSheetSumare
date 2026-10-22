import { z } from "zod";
import { apiRequest } from "./client";
import {
  atividadeSchema,
  horaExtraSchema,
  horaExtraInputSchema,
  horaExtraUpdateSchema,
  horaExtraDeleteSchema,
  horaExtraMutationResponseSchema,
  horasExtrasResponseSchema,
  type Atividade,
  type HoraExtra,
  type HoraExtraInput,
  type HorasExtrasResponse,
  type HoraExtraUpdate,
} from "@/schemas/data";

const activitiesSchema = z.array(atividadeSchema);

export interface OvertimeFilters {
  trabalhadorId?: string;
  atividadeId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function getActivities(): Promise<Atividade[]> {
  return apiRequest("/api/atividades", activitiesSchema);
}

export function getOvertimeEntries(
  filters: OvertimeFilters = {},
): Promise<HorasExtrasResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }

  const query = search.size > 0 ? `?${search.toString()}` : "";
  return apiRequest(`/api/horas-extras${query}`, horasExtrasResponseSchema);
}

export function createOvertimeEntry(
  input: HoraExtraInput,
): Promise<HoraExtra> {
  const body = horaExtraInputSchema.parse(input);
  return apiRequest("/api/horas-extras", horaExtraSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateOvertimeEntry(
  id: string,
  input: HoraExtraInput,
  motivo: string,
): Promise<HoraExtra> {
  const body: HoraExtraUpdate = horaExtraUpdateSchema.parse({
    ...input,
    motivo,
  });
  return apiRequest(`/api/horas-extras/${encodeURIComponent(id)}`, horaExtraSchema, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteOvertimeEntry(
  id: string,
  motivo: string,
): Promise<{ success: true }> {
  const body = horaExtraDeleteSchema.parse({ motivo });
  return apiRequest(
    `/api/horas-extras/${encodeURIComponent(id)}`,
    horaExtraMutationResponseSchema,
    {
      method: "DELETE",
      body: JSON.stringify(body),
    },
  );
}
