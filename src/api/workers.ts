import { z } from "zod";
import { apiRequest } from "./client";
import {
  funcaoSchema,
  trabalhadorInputSchema,
  trabalhadorSchema,
  type Funcao,
  type Trabalhador,
  type TrabalhadorInput,
} from "@/schemas/data";

const workersSchema = z.array(trabalhadorSchema);
const functionsSchema = z.array(funcaoSchema);

export function getWorkers(): Promise<Trabalhador[]> {
  return apiRequest("/api/trabalhadores", workersSchema);
}

export function getFunctions(): Promise<Funcao[]> {
  return apiRequest("/api/funcoes", functionsSchema);
}

export function createWorker(input: TrabalhadorInput): Promise<Trabalhador> {
  const body = trabalhadorInputSchema.parse(input);
  return apiRequest("/api/trabalhadores", trabalhadorSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateWorker(
  id: string,
  input: TrabalhadorInput,
): Promise<Trabalhador> {
  const body = trabalhadorInputSchema.parse(input);
  return apiRequest(
    `/api/trabalhadores/${encodeURIComponent(id)}`,
    trabalhadorSchema,
    { method: "PUT", body: JSON.stringify(body) },
  );
}
