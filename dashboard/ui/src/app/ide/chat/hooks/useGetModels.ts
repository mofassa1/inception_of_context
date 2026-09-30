import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ModelsOutputDTO } from "@/shared/types/dto";

export function useGetModels() {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.GET_MODELS],
    queryFn: () => api.get<ModelsOutputDTO>(ENDPOINTS.GET_MODELS),
  });

  return {
    modelsOutput: data ?? null,
    isGettingModels: isLoading,
    getModelsFailed: isError,
    getModelsError: error,
  };
}
