import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type {
  CreateEntryInput,
  DirectoryEntry,
} from "@/shared/types/filesystem";

export function useCreateEntry() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: ({ entryPath, isDirectory }: CreateEntryInput) =>
        api.post<DirectoryEntry>(ENDPOINTS.FILES_CREATE, {
          path: entryPath,
          is_dir: isDirectory,
        }),
      onSuccess: (_result, variables) => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.DIRECTORY, getParentPath(variables.entryPath)],
        });
      },
    });

  return {
    createEntry: mutateAsync,
    data,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
