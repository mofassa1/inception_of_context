import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { DirectoryListing } from "@/shared/types/filesystem";

export function useDirectory(directoryPath: string, enabled = true) {
  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: [QUERY_KEYS.DIRECTORY, directoryPath],
    queryFn: () =>
      api
        .get<DirectoryListing>(ENDPOINTS.FILES_LIST, {
          params: { path: directoryPath },
        })
        .then((listing) => listing.entries),
    enabled,
  });

  return { entries: data ?? [], error, isLoading, isError, refetch };
}
