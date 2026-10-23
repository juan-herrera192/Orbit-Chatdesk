import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOrbitStateQueryKey, useGetOrbitState, usePerformOrbitAction, type OrbitActionInput } from "@workspace/api-client-react";

export function errorText(error: unknown) {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data as { error?: string };
    if (data?.error) return data.error;
  }
  return error instanceof Error ? error.message : "No pudimos completar la acción. Inténtalo de nuevo.";
}
export function useOrbit() {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const mutation = usePerformOrbitAction({ request: { credentials: "include" } });
  const query = useGetOrbitState({
    query: {
      queryKey: getGetOrbitStateQueryKey(),
      refetchInterval: mutation.isPending ? false : 2000,
      refetchOnWindowFocus: !mutation.isPending,
    },
    request: { credentials: "include" },
  });
  async function act(data: OrbitActionInput) {
    setError("");
    try {
      await client.cancelQueries({ queryKey: getGetOrbitStateQueryKey() });
      const state = await mutation.mutateAsync({ data });
      client.setQueryData(getGetOrbitStateQueryKey(), state);
      return state;
    } catch (e) { setError(errorText(e)); throw e; }
  }
  return { ...query, queryError: query.error, act, pending: mutation.isPending, error, setError };
}
export type OrbitAction = ReturnType<typeof useOrbit>["act"];
