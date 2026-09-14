import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type {
  RenameEntryInputDTO,
  RenameEntryOutputDTO,
} from "@/shared/types/dto";

export function useRenameEntry() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: (body: RenameEntryInputDTO) =>
        api.post<RenameEntryOutputDTO>(ENDPOINTS.RENAME_ENTRY, body),
      onSuccess: (_renameEntryOutput, body) => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_FOLDER, getParentPath(body.path)],
        });
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_FOLDER, getParentPath(body.new_path)],
        });
      },
    });

  return {
    renameEntry: mutateAsync,
    renameEntryOutput: data ?? null,
    isRenamingEntry: isPending,
    renameEntryFailed: isError,
    renameEntryError: error,
  };
}
