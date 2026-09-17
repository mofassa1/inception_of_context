import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { AddChatsInputDTO, ConversationDTO } from "@/shared/types/dto";

type AddChatsVariables = {
  conversationId: string;
  body: AddChatsInputDTO;
};

export function useAddChats() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } =
    useMutation({
      mutationFn: ({ conversationId, body }: AddChatsVariables) =>
        api.patch<ConversationDTO>(
          `${ENDPOINTS.ADD_CHATS}/${conversationId}`,
          body,
        ),
      onSuccess: (conversation) => {
        queryClient.setQueryData(
          [QUERY_KEYS.GET_CONVERSATION, conversation.id],
          conversation,
        );
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_CONVERSATIONS],
        });
      },
    });

  return {
    addChats: mutateAsync,
    conversation: data ?? null,
    isAddingChats: isPending,
    addChatsFailed: isError,
    addChatsError: error,
  };
}
