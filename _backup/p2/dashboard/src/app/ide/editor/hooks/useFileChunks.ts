import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { FileChunk, FileChunks } from "@/shared/types/agent";

const EMPTY_CHUNKS: FileChunk[] = [];

export function useFileChunks(filePath: string | null, enabled = true) {
  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: [QUERY_KEYS.FILE_CHUNKS, filePath],
    queryFn: () =>
      api
        .get<FileChunks>(ENDPOINTS.AGENT_FILE_CHUNKS, {
          params: { path: filePath as string },
        })
        .then((response) => response.chunks),
    enabled: enabled && Boolean(filePath),
    staleTime: Infinity,
  });

  return { chunks: data ?? EMPTY_CHUNKS, error, isLoading, isError, refetch };
}
