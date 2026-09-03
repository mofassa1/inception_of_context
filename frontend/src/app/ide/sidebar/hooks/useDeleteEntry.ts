import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type { WriteResult } from "@/shared/types/filesystem";

export function useDeleteEntry() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: (entryPath: string) =>
        api.delete<WriteResult>(ENDPOINTS.FILES_DELETE, {
          params: { path: entryPath },
        }),
      onSuccess: (_result, entryPath) => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.DIRECTORY, getParentPath(entryPath)],
        });
      },
    });

  return {
    deleteEntry: mutateAsync,
    data,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
