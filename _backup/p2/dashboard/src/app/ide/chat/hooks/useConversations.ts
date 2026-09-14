import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { Conversation, ConversationSummary } from "@/shared/types/agent";

export function useConversations() {
  const queryClient = useQueryClient();

  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.CONVERSATIONS],
    queryFn: () =>
      api
        .get<{ conversations: ConversationSummary[] }>(
          ENDPOINTS.AGENT_CONVERSATIONS,
        )
        .then((payload) => payload.conversations),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
  }

  const createMutation = useMutation({
    mutationFn: () => api.post<Conversation>(ENDPOINTS.AGENT_CONVERSATIONS),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (conversationId: string) =>
      api.delete<{ ok: boolean }>(
        `${ENDPOINTS.AGENT_CONVERSATIONS}/${conversationId}`,
      ),
    onSuccess: invalidate,
  });

  return {
    conversations: data ?? [],
    createConversation: createMutation.mutateAsync,
    deleteConversation: deleteMutation.mutateAsync,
    error,
    isLoading,
    isError,
  };
}
