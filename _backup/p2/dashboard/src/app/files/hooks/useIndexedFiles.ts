import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { IndexedFile } from "@/shared/types/agent";

type IndexedFilesResponse = { files: IndexedFile[] };

export function useIndexedFiles() {
  const { data, error, isLoading, isError, refetch } = useQuery<
    IndexedFilesResponse,
    Error
  >({
    queryKey: [QUERY_KEYS.AGENT_FILES],
    queryFn: () => api.get<IndexedFilesResponse>(ENDPOINTS.AGENT_FILES),
  });

  return { files: data?.files ?? [], error, isLoading, isError, refetch };
}
