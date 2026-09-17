import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type {
  ListIgnoreRulesOutputDTO,
  SetIgnoreRuleInputDTO,
} from "@/shared/types/dto";

type SetIgnoreRuleVariables = {
  conversationId: string;
  body: SetIgnoreRuleInputDTO;
};

export function useSetIgnoreRule() {
  const queryClient = useQueryClient();

  const { mutateAsync, data, error, isPending, isError } = useMutation({
    mutationFn: ({ conversationId, body }: SetIgnoreRuleVariables) =>
      api.put<ListIgnoreRulesOutputDTO>(
        `${ENDPOINTS.SET_IGNORE_RULE}/${conversationId}/ignore-rules`,
        body,
      ),
    onSuccess: (listIgnoreRulesOutput, { conversationId }) => {
      queryClient.setQueryData(
        [QUERY_KEYS.LIST_IGNORE_RULES, conversationId],
        listIgnoreRulesOutput,
      );
    },
  });

  return {
    setIgnoreRule: mutateAsync,
    listIgnoreRulesOutput: data ?? null,
    isSettingIgnoreRule: isPending,
    setIgnoreRuleFailed: isError,
    setIgnoreRuleError: error,
  };
}
