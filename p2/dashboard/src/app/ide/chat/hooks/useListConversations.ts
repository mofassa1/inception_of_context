import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type {
  ListConversationsInputDTO,
  ListConversationsOutputDTO,
} from "@/shared/types/dto";

export function useListConversations(params: ListConversationsInputDTO) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.LIST_CONVERSATIONS, params.directory],
    queryFn: () =>
      api.get<ListConversationsOutputDTO>(ENDPOINTS.LIST_CONVERSATIONS, {
        params,
      }),
  });

  return {
    listConversationsOutput: data ?? null,
    isListingConversations: isLoading,
    listConversationsFailed: isError,
    listConversationsError: error,
  };
}
