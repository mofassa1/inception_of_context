import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type {
  DeleteConversationOutputDTO,
  ListConversationsOutputDTO,
} from "@/shared/types/dto";

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: (conversationId: string) =>
        api.delete<DeleteConversationOutputDTO>(
          `${ENDPOINTS.DELETE_CONVERSATION}/${conversationId}`,
        ),
      onSuccess: (_deleteConversationOutput, conversationId) => {
        queryClient.setQueriesData<ListConversationsOutputDTO>(
          { queryKey: [QUERY_KEYS.LIST_CONVERSATIONS] },
          (listConversationsOutput) =>
            listConversationsOutput && {
              conversations: listConversationsOutput.conversations.filter(
                (conversation) => conversation.id !== conversationId,
              ),
            },
        );
        queryClient.removeQueries({
          queryKey: [QUERY_KEYS.GET_CONVERSATION, conversationId],
        });
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_CONVERSATIONS],
        });
      },
    });

  return {
    deleteConversation: mutateAsync,
    deleteConversationOutput: data ?? null,
    isDeletingConversation: isPending,
    deleteConversationFailed: isError,
    deleteConversationError: error,
  };
}
