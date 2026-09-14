import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ChunksForFileOutputDTO } from "@/shared/types/dto";

export function useGetChunksForFile(filePath: string | null, enabled = true) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.GET_CHUNKS_FOR_FILE, filePath],
    queryFn: () =>
      api.get<ChunksForFileOutputDTO>(
        `${ENDPOINTS.GET_CHUNKS_FOR_FILE}/${encodeURIComponent(filePath as string)}`,
      ),
    enabled: enabled && Boolean(filePath),
    staleTime: Infinity,
  });

  return {
    chunksForFileOutput: data ?? null,
    isGettingChunksForFile: isLoading,
    getChunksForFileFailed: isError,
    getChunksForFileError: error,
  };
}
