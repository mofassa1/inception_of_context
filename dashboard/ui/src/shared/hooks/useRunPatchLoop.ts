import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type {
  PatchLoopInputDTO,
  PatchLoopOutputDTO,
} from "@/shared/types/dto";

export function useRunPatchLoop() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: (body: PatchLoopInputDTO) =>
        api.post<PatchLoopOutputDTO>(ENDPOINTS.RUN_PATCH_LOOP, body),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_STATUS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_ALL_FILES] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_CHUNKS] });
      },
    });

  return {
    runPatchLoop: mutateAsync,
    patchLoopOutput: data ?? null,
    isRunningPatchLoop: isPending,
    runPatchLoopFailed: isError,
    runPatchLoopError: error,
  };
}
