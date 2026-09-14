import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { readJsonLines } from "@/shared/lib/readJsonLines";
import type { AnswerSource, AskStreamLine } from "@/shared/types/agent";

type AskAgentInput = {
  query: string;
  conversationId: string | null;
  signal: AbortSignal;
  onSources: (sources: AnswerSource[]) => void;
  onToken: (text: string) => void;
};

export function useAskAgent() {
  const { mutateAsync, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: async ({
        query,
        conversationId,
        signal,
        onSources,
        onToken,
      }: AskAgentInput) => {
        const response = await api.stream(
          ENDPOINTS.AGENT_ASK,
          { query, conversationId },
          { signal },
        );

        await readJsonLines<AskStreamLine>(response, (line) => {
          if (line.type === "sources") onSources(line.sources);
          else onToken(line.text);
        });
      },
    });

  return { askAgent: mutateAsync, error, isPending, isSuccess, isError, reset };
}
