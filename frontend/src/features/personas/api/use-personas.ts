import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convexMutation, convexQuery } from "@/lib/convex";
import type { Persona, PersonaFormData } from "@/types";

export function usePersonas() {
  return useQuery({
    queryKey: ["personas"],
    queryFn: () => convexQuery<Persona[]>("personas:list"),
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PersonaFormData) =>
      convexMutation("personas:create", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useUpdatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: PersonaFormData & { id: string }) =>
      convexMutation("personas:update", { id, ...data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useDeletePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => convexMutation("personas:remove", { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}
