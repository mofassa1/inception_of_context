import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ConversationDTO } from "@/shared/types/dto";

export function useGetConversation(conversationId: string | null) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.GET_CONVERSATION, conversationId],
    queryFn: () =>
      api.get<ConversationDTO>(
        `${ENDPOINTS.GET_CONVERSATION}/${conversationId}`,
      ),
    enabled: Boolean(conversationId),
  });

  return {
    conversation: data ?? null,
    isGettingConversation: isLoading,
    getConversationFailed: isError,
    getConversationError: error,
  };
}
