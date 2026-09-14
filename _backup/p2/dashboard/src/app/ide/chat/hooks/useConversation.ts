import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { Conversation, ConversationTurn } from "@/shared/types/agent";

type AppendTurnsInput = {
  conversationId: string;
  turns: Pick<ConversationTurn, "role" | "content" | "mode" | "sources">[];
};

export function useConversation(conversationId: string | null) {
  const queryClient = useQueryClient();

  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.CONVERSATION, conversationId],
    queryFn: () =>
      api.get<Conversation>(
        `${ENDPOINTS.AGENT_CONVERSATIONS}/${conversationId}`,
      ),
    enabled: Boolean(conversationId),
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ conversationId: id, turns }: AppendTurnsInput) =>
      api.patch<Conversation>(`${ENDPOINTS.AGENT_CONVERSATIONS}/${id}`, {
        turns,
      }),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        [QUERY_KEYS.CONVERSATION, conversation.id],
        conversation,
      );
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
    },
  });

  return {
    conversation: data ?? null,
    appendTurns: mutateAsync,
    isSaving: isPending,
    error,
    isLoading,
    isError,
  };
}
