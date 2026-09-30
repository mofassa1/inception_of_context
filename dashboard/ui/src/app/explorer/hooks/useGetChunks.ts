import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ChunksInputDTO, ChunksOutputDTO } from "@/shared/types/dto";

export function useGetChunks(params: ChunksInputDTO) {
  const { data, error, isLoading, isError, isFetching } = useQuery({
    queryKey: [QUERY_KEYS.GET_CHUNKS, params.offset, params.limit],
    queryFn: () => api.get<ChunksOutputDTO>(ENDPOINTS.GET_CHUNKS, { params }),
    placeholderData: keepPreviousData,
  });

  return {
    chunksOutput: data ?? null,
    isGettingChunks: isLoading,
    isRefreshingChunks: isFetching,
    getChunksFailed: isError,
    getChunksError: error,
  };
}
