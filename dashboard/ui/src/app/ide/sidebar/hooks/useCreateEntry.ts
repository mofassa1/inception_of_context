import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type {
  CreateEntryInputDTO,
  CreateEntryOutputDTO,
} from "@/shared/types/dto";

export function useCreateEntry() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: (body: CreateEntryInputDTO) =>
        api.post<CreateEntryOutputDTO>(ENDPOINTS.CREATE_ENTRY, body),
      onSuccess: (_createEntryOutput, body) => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_FOLDER, getParentPath(body.path)],
        });
      },
    });

  return {
    createEntry: mutateAsync,
    createEntryOutput: data ?? null,
    isCreatingEntry: isPending,
    createEntryFailed: isError,
    createEntryError: error,
  };
}
