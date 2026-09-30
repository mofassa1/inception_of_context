import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type {
  DeleteEntryInputDTO,
  DeleteEntryOutputDTO,
} from "@/shared/types/dto";

export function useDeleteEntry() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: (params: DeleteEntryInputDTO) =>
        api.delete<DeleteEntryOutputDTO>(ENDPOINTS.DELETE_ENTRY, { params }),
      onSuccess: (_deleteEntryOutput, params) => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_FOLDER, getParentPath(params.path)],
        });
      },
    });

  return {
    deleteEntry: mutateAsync,
    deleteEntryOutput: data ?? null,
    isDeletingEntry: isPending,
    deleteEntryFailed: isError,
    deleteEntryError: error,
  };
}
