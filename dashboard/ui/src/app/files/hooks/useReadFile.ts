import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ReadFileInputDTO, ReadFileOutputDTO } from "@/shared/types/dto";

export function useReadFile(params: ReadFileInputDTO | null) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.READ_FILE, params?.path],
    queryFn: () =>
      api.get<ReadFileOutputDTO>(ENDPOINTS.READ_FILE, {
        params: params as ReadFileInputDTO,
      }),
    enabled: Boolean(params),
  });

  return {
    readFileOutput: data ?? null,
    isReadingFile: isLoading,
    readFileFailed: isError,
    readFileError: error,
  };
}
