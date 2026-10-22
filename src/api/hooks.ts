"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createOvertimeEntry,
  deleteOvertimeEntry,
  getActivities,
  getOvertimeEntries,
  type OvertimeFilters,
  updateOvertimeEntry,
} from "./overtime";
import {
  getAttendances,
  saveAttendances,
} from "./attendance";
import {
  createWorker,
  getFunctions,
  getWorkers,
  updateWorker,
} from "./workers";
import type {
  HoraExtraInput,
  PresencaInput,
  TrabalhadorInput,
} from "@/schemas/data";

export const dataQueryKeys = {
  workers: ["trabalhadores"] as const,
  functions: ["funcoes"] as const,
  attendances: (date?: string) => ["presencas", date ?? "todas"] as const,
  activities: ["atividades"] as const,
  overtime: (filters: OvertimeFilters) => ["horas-extras", filters] as const,
};

export function useWorkers(enabled = true) {
  return useQuery({
    queryKey: dataQueryKeys.workers,
    queryFn: getWorkers,
    enabled,
  });
}

export function useFunctions(enabled = true) {
  return useQuery({
    queryKey: dataQueryKeys.functions,
    queryFn: getFunctions,
    enabled,
  });
}

export function useAttendances(date?: string, enabled = true) {
  return useQuery({
    queryKey: dataQueryKeys.attendances(date),
    queryFn: () => getAttendances(date),
    enabled:
      enabled && (date === undefined || /^\d{4}-\d{2}-\d{2}$/.test(date)),
  });
}

export function useActivities(enabled = true) {
  return useQuery({
    queryKey: dataQueryKeys.activities,
    queryFn: getActivities,
    enabled,
  });
}

export function useOvertimeEntries(
  filters: OvertimeFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: dataQueryKeys.overtime(filters),
    queryFn: () => getOvertimeEntries(filters),
    enabled,
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TrabalhadorInput) => createWorker(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataQueryKeys.workers }),
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TrabalhadorInput }) =>
      updateWorker(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataQueryKeys.workers }),
  });
}

export function useSaveAttendances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attendances: PresencaInput[]) => saveAttendances(attendances),
    onSuccess: (attendances) => {
      for (const date of new Set(attendances.map(({ data }) => data))) {
        void queryClient.invalidateQueries({
          queryKey: dataQueryKeys.attendances(date),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: dataQueryKeys.attendances(),
      });
    },
  });
}

export function useCreateOvertimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HoraExtraInput) => createOvertimeEntry(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["horas-extras"] }),
  });
}

export function useUpdateOvertimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      motivo,
    }: {
      id: string;
      input: HoraExtraInput;
      motivo: string;
    }) => updateOvertimeEntry(id, input, motivo),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["horas-extras"] }),
  });
}

export function useDeleteOvertimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      deleteOvertimeEntry(id, motivo),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["horas-extras"] }),
  });
}
