import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { IgnoreRules, IndexResult } from "@/shared/types/agent";

type IndexWorkspaceInput = {
  path: string;
  rules: IgnoreRules;
};

export function useIndexWorkspace() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: ({ path, rules }: IndexWorkspaceInput) =>
        api.post<IndexResult>(ENDPOINTS.AGENT_INDEX, { path, ...rules }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AGENT_FILES] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERVIEW] });
      },
    });

  return {
    indexWorkspace: mutateAsync,
    result: data ?? null,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
