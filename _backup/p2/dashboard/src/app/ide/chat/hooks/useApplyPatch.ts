import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type {
  ApplyPatchResult,
  IgnoreRules,
  PatchFile,
} from "@/shared/types/agent";

type ApplyPatchInput = {
  files: PatchFile[];
  rules: IgnoreRules;
};

export function useApplyPatch() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: ({ files, rules }: ApplyPatchInput) =>
        api.post<ApplyPatchResult>(ENDPOINTS.AGENT_PATCH_APPLY, {
          files,
          ...rules,
        }),
      onSuccess: (result) => {
        for (const path of result.applied) {
          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.FILE_CHUNKS, path],
          });
          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.FILE_CONTENT, path],
          });
          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.DIRECTORY, getParentPath(path)],
          });
        }
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AGENT_FILES] });
      },
    });

  return {
    applyPatch: mutateAsync,
    result: data ?? null,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
