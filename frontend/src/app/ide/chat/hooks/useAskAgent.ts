import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { readTextStream } from "@/shared/lib/readTextStream";

type AskAgentInput = {
  query: string;
  signal: AbortSignal;
  onChunk: (text: string) => void;
};

export function useAskAgent() {
  const { mutateAsync, error, isPending, isSuccess, isError, reset } =
    useMutation({
      mutationFn: async ({ query, signal, onChunk }: AskAgentInput) => {
        const response = await api.stream(
          ENDPOINTS.AGENT_ASK,
          { query },
          { signal },
        );

        await readTextStream(response, onChunk);
      },
    });

  return { askAgent: mutateAsync, error, isPending, isSuccess, isError, reset };
}
