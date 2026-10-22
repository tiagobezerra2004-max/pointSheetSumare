import type { StatusTrabalhador, Vinculo } from "@/schemas/data";

export const statusOptions: StatusTrabalhador[] = [
  "Ativo",
  "Afastado",
  "Desligado",
];

export const vinculoOptions: { value: Vinculo; label: string }[] = [
  { value: "CLT", label: "CLT" },
  { value: "Avulso", label: "Avulso" },
  { value: "Vigia", label: "Vigia" },
  { value: "JovemAprendiz", label: "Jovem aprendiz" },
  { value: "Estagiario", label: "Estagiário" },
];
