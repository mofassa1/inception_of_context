import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { pickFolder } from "@/shared/api/desktopBridge";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { DirectoryListing } from "@/shared/types/filesystem";

export function useChooseFolder() {
  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: async () => {
        const folderPath = await pickFolder();
        if (!folderPath) return null;

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
    chooseFolder: mutateAsync,
    folderPath: data ?? null,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
