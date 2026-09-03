import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { IndexResult } from "@/shared/types/chat";

export function useIndexWorkspace() {
  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: (workspacePath: string) =>
        api.post<IndexResult>(ENDPOINTS.AGENT_INDEX, { path: workspacePath }),
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
