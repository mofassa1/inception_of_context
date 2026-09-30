import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ModelsOutputDTO, SetModelsInputDTO } from "@/shared/types/dto";

export function useSetModels() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } = useMutation({
    mutationFn: (body: SetModelsInputDTO) =>
      api.put<ModelsOutputDTO>(ENDPOINTS.SET_MODELS, body),
    onSuccess: (modelsOutput) => {
      queryClient.setQueryData([QUERY_KEYS.GET_MODELS], modelsOutput);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_STATUS] });
    },
  });

  return {
    setModels: mutateAsync,
    modelsOutput: data ?? null,
    isSettingModels: isPending,
    setModelsFailed: isError,
    setModelsError: error,
  };
}
