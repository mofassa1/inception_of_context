import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { ContextInputDTO, ContextOutputDTO } from "@/shared/types/dto";

export function useGetContext() {
  const { mutateAsync, data, error, isPending, isError } = useMutation({
    mutationFn: (body: ContextInputDTO) => api.post<ContextOutputDTO>(ENDPOINTS.GET_CONTEXT, body),
  });

  return {
    getContext: mutateAsync,
    contextOutput: data ?? null,
    isGettingContext: isPending,
    getContextFailed: isError,
    getContextError: error,
  };
}
