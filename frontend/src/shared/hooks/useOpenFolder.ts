import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { DirectoryListing } from "@/shared/types/filesystem";

export function useOpenFolder() {
  const {
    mutateAsync,
    data,
    variables,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  } = useMutation({
      mutationFn: async (folderPath: string) => {
        await api.get(ENDPOINTS.INDEXER_START, {
          params: { body: folderPath },
        });
        await api.get<DirectoryListing>(ENDPOINTS.FILES_LIST, {
          params: { path: folderPath },
        });

        return folderPath;
      },
    });

  return {
    openFolder: mutateAsync,
    folderPath: data ?? null,
    attemptedPath: variables ?? null,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
