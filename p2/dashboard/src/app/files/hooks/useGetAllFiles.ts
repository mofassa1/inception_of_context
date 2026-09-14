import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { FilesOutputDTO } from "@/shared/types/dto";

export function useGetAllFiles() {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.GET_ALL_FILES],
    queryFn: () => api.get<FilesOutputDTO>(ENDPOINTS.GET_ALL_FILES),
  });

  return {
    filesOutput: data ?? null,
    isGettingAllFiles: isLoading,
    getAllFilesFailed: isError,
    getAllFilesError: error,
  };
}
