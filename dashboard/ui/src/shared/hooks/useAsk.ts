import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { readJsonLines } from "@/shared/lib/readJsonLines";
import type {
  SourceDTO,
  AskInputDTO,
  AskSourcesLineDTO,
  AskTokenLineDTO,
} from "@/shared/types/dto";

type AskVariables = {
  body: AskInputDTO;
  signal?: AbortSignal;
  onSources: (sources: SourceDTO[]) => void;
  onToken: (text: string) => void;
};

export function useAsk() {
  const queryClient = useQueryClient();

  const { mutateAsync, error, isPending, isError } =
    useMutation({
      mutationFn: async ({ body, signal, onSources, onToken }: AskVariables) => {
        const response = await api.stream(ENDPOINTS.ASK, body, { signal });

        await readJsonLines<AskSourcesLineDTO | AskTokenLineDTO>(
          response,
          (line) => {
            if (line.type === "sources") onSources(line.sources);
            else onToken(line.text);
          },
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.LIST_CONVERSATIONS],
        });
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.GET_CONVERSATION],
        });
      },
    });

  return {
    ask: mutateAsync,
    isAsking: isPending,
    askFailed: isError,
    askError: error,
  };
}
