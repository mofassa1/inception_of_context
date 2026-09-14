import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { readJsonLines } from "@/shared/lib/readJsonLines";
import type { AnswerSource, AskStreamLine } from "@/shared/types/agent";

type AskLlmInput = {
  query: string;
  k: number;
  onSources: (sources: AnswerSource[]) => void;
  onToken: (text: string) => void;
};

export function useAskLlm() {
  const { mutateAsync, error, isPending, isSuccess, isError, reset } =
    useMutation<void, Error, AskLlmInput>({
      mutationFn: async ({ query, k, onSources, onToken }) => {
        const response = await api.stream(ENDPOINTS.AGENT_ASK, { query, k });

        await readJsonLines<AskStreamLine>(response, (line) => {
          if (line.type === "sources") onSources(line.sources);
          else onToken(line.text);
        });
      },
    });

  return { askLlm: mutateAsync, error, isPending, isSuccess, isError, reset };
}
