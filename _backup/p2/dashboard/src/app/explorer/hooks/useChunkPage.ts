import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ChunkPage } from "@/shared/types/agent";

export function useChunkPage(offset: number, limit: number) {
  const { data, error, isLoading, isError, isFetching } = useQuery<
    ChunkPage,
    Error
  >({
    queryKey: [QUERY_KEYS.AGENT_CHUNKS, offset, limit],
    queryFn: () =>
      api.get<ChunkPage>(ENDPOINTS.AGENT_CHUNKS, { params: { offset, limit } }),
    placeholderData: keepPreviousData,
  });

  return {
    chunks: data?.chunks ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    isError,
    isFetching,
  };
}
