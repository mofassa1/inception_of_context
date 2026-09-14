import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { FileSource } from "@/shared/types/agent";

export function useFileSource(path: string | null) {
  const { data, error, isLoading, isError } = useQuery<FileSource, Error>({
    queryKey: [QUERY_KEYS.FILE_SOURCE, path],
    queryFn: () =>
      api.get<FileSource>(ENDPOINTS.AGENT_FILE_SOURCE, {
        params: { path: path as string },
      }),
    enabled: Boolean(path),
  });

  return { source: data ?? null, error, isLoading, isError };
}
