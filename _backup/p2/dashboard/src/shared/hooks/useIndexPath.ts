import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { IgnoreRules, IndexResult } from "@/shared/types/agent";

type IndexPathInput = {
  path: string;
  rules: IgnoreRules;
};

export function useIndexPath() {
  const queryClient = useQueryClient();

  function invalidateIndexViews() {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AGENT_FILES] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERVIEW] });
  }

  const indexMutation = useMutation({
    mutationFn: ({ path, rules }: IndexPathInput) =>
      api.post<IndexResult>(ENDPOINTS.AGENT_INDEX_PATH, { path, ...rules }),
    onSuccess: invalidateIndexViews,
  });

  const forgetMutation = useMutation({
    mutationFn: (path: string) =>
      api.post<{ path: string; filesRemoved: number }>(
        ENDPOINTS.AGENT_INDEX_FORGET,
        { path },
      ),
    onSuccess: invalidateIndexViews,
  });

  return {
    indexPath: indexMutation.mutateAsync,
    forgetPath: forgetMutation.mutateAsync,
    isPending: indexMutation.isPending || forgetMutation.isPending,
    error: indexMutation.error ?? forgetMutation.error,
  };
}
