import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { resolveRealPath } from "@/shared/api/desktopBridge";
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
      const realPath = await resolveRealPath(folderPath);
      if (!realPath) throw new Error(`No such folder on this computer: ${folderPath}`);

      await api.get<DirectoryListing>(ENDPOINTS.FILES_LIST, {
        params: { path: realPath },
      });

      return realPath;
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
