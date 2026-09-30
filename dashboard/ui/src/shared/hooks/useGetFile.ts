import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { FileOutputDTO } from "@/shared/types/dto";

export function useGetFile(filePath: string | null, enabled = true) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.GET_FILE, filePath],
    queryFn: () =>
      api.get<FileOutputDTO>(ENDPOINTS.GET_FILE, { params: { path: filePath as string } }),
    enabled: enabled && Boolean(filePath),
    staleTime: Infinity,
  });

  return {
    fileOutput: data ?? null,
    isGettingFile: isLoading,
    getFileFailed: isError,
    getFileError: error,
  };
}
