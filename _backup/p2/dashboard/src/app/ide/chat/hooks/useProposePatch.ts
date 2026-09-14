import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { PatchProposal } from "@/shared/types/agent";

type ProposePatchInput = {
  query: string;
  conversationId: string | null;
  k?: number;
};

export function useProposePatch() {
  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: ({ query, conversationId, k = 5 }: ProposePatchInput) =>
        api.post<PatchProposal>(ENDPOINTS.AGENT_PATCH_PROPOSE, {
          query,
          k,
          conversationId,
        }),
    });

  return {
    proposePatch: mutateAsync,
    proposal: data ?? null,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
