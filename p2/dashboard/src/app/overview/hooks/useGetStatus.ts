import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { StatusOutputDTO } from "@/shared/types/dto";

export function useGetStatus() {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.GET_STATUS],
    queryFn: () => api.get<StatusOutputDTO>(ENDPOINTS.GET_STATUS),
  });

  return {
    statusOutput: data ?? null,
    isGettingStatus: isLoading,
    getStatusFailed: isError,
    getStatusError: error,
  };
}
