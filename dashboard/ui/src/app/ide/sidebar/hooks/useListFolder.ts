import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ListFolderInputDTO, ListFolderOutputDTO } from "@/shared/types/dto";

export function useListFolder(params: ListFolderInputDTO, enabled = true) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.LIST_FOLDER, params.path],
    queryFn: () =>
      api.get<ListFolderOutputDTO>(ENDPOINTS.LIST_FOLDER, { params }),
    enabled,
  });

  return {
    listFolderOutput: data ?? null,
    isListingFolder: isLoading,
    listFolderFailed: isError,
    listFolderError: error,
  };
}
