import { z } from "zod";
import { apiRequest } from "./client";
import {
  presencasLoteSchema,
  presencaSchema,
  type Presenca,
  type PresencaInput,
} from "@/schemas/data";

const attendancesSchema = z.array(presencaSchema);

export function getAttendances(date?: string): Promise<Presenca[]> {
  const query = date ? `?data=${encodeURIComponent(date)}` : "";
  return apiRequest(`/api/presencas${query}`, attendancesSchema);
}

export function saveAttendances(
  attendances: PresencaInput[],
): Promise<Presenca[]> {
  const body = presencasLoteSchema.parse(attendances);
  return apiRequest("/api/presencas/lote", attendancesSchema, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
