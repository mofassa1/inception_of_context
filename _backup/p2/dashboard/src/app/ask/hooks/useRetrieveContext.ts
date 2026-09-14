import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { RetrieveResult } from "@/shared/types/agent";

type RetrieveInput = {
  query: string;
  k: number;
};

export function useRetrieveContext() {
  const { mutateAsync, data, error, isPending, isSuccess, isError, reset } =
    useMutation<RetrieveResult, Error, RetrieveInput>({
      mutationFn: ({ query, k }) =>
        api.post<RetrieveResult>(ENDPOINTS.AGENT_CONTEXT, { query, k }),
    });

  return {
    retrieveContext: mutateAsync,
    sources: data?.sources ?? [],
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
