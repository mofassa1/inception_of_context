import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { PatchLoopResult } from "@/shared/types/agent";

type PatchLoopInput = {
  query: string;
  k: number;
  targetPath: string | null;
};

export function usePatchLoop() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation<PatchLoopResult, Error, PatchLoopInput>({
      mutationFn: ({ query, k, targetPath }) =>
        api.post<PatchLoopResult>(ENDPOINTS.AGENT_PATCH_LOOP, {
          query,
          k,
          targetPath,
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERVIEW] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AGENT_FILES] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AGENT_CHUNKS] });
      },
    });

  return {
    runPatchLoop: mutateAsync,
    result: data ?? null,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
