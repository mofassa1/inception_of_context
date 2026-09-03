import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type {
  DirectoryEntry,
  RenameEntryInput,
} from "@/shared/types/filesystem";

export function useRenameEntry() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: ({ currentPath, nextPath }: RenameEntryInput) =>
        api.post<DirectoryEntry>(ENDPOINTS.FILES_RENAME, {
          path: currentPath,
          new_path: nextPath,
        }),
      onSuccess: (_result, variables) => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.DIRECTORY, getParentPath(variables.currentPath)],
        });
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.DIRECTORY, getParentPath(variables.nextPath)],
        });
      },
    });

  return {
    renameEntry: mutateAsync,
    data,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
