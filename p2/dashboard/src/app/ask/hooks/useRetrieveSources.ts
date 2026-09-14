import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { RetrieveInputDTO, RetrieveOutputDTO } from "@/shared/types/dto";

export function useRetrieveSources() {
  const { mutateAsync, data, error, isPending, isError } = useMutation({
    mutationFn: (body: RetrieveInputDTO) =>
      api.post<RetrieveOutputDTO>(ENDPOINTS.RETRIEVE_SOURCES, body),
  });

  return {
    retrieveSources: mutateAsync,
    retrieveOutput: data ?? null,
    isRetrievingSources: isPending,
    retrieveSourcesFailed: isError,
    retrieveSourcesError: error,
  };
}
