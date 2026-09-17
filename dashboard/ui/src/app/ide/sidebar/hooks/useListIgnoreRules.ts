import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { ListIgnoreRulesOutputDTO } from "@/shared/types/dto";

export function useListIgnoreRules(conversationId: string | null) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.LIST_IGNORE_RULES, conversationId],
    queryFn: () =>
      api.get<ListIgnoreRulesOutputDTO>(
        `${ENDPOINTS.LIST_IGNORE_RULES}/${conversationId}/ignore-rules`,
      ),
    enabled: Boolean(conversationId),
  });

  return {
    listIgnoreRulesOutput: data ?? null,
    isListingIgnoreRules: isLoading,
    listIgnoreRulesFailed: isError,
    listIgnoreRulesError: error,
  };
}
