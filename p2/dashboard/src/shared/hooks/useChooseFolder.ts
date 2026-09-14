import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { pickFolder } from "@/shared/api/desktopBridge";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { ListFolderOutputDTO } from "@/shared/types/dto";

export function useChooseFolder() {
  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: async () => {
        const folderPath = await pickFolder();
        if (!folderPath) return null;

        await api.get<ListFolderOutputDTO>(ENDPOINTS.LIST_FOLDER, {
          params: { path: folderPath },
        });

        return folderPath;
      },
    });

  return {
    chooseFolder: mutateAsync,
    folderPath: data ?? null,
    isChoosingFolder: isPending,
    chooseFolderFailed: isError,
    chooseFolderError: error,
  };
}
