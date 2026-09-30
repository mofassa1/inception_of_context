import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type {
  ConversationDTO,
  CreateConversationInputDTO,
} from "@/shared/types/dto";

export function useCreateConversation() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: (body: CreateConversationInputDTO) =>
        api.post<ConversationDTO>(ENDPOINTS.CREATE_CONVERSATION, body),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_CONVERSATIONS],
        });
      },
    });

  return {
    createConversation: mutateAsync,
    conversation: data ?? null,
    isCreatingConversation: isPending,
    createConversationFailed: isError,
    createConversationError: error,
  };
}
