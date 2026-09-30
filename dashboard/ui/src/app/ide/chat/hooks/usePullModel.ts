import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { readJsonLines } from "@/shared/lib/readJsonLines";
import type {
  PullDoneLineDTO,
  PullErrorLineDTO,
  PullProgressLineDTO,
} from "@/shared/types/dto";

type PullModelVariables = {
  name: string;
  onProgress: (ratio: number, status: string) => void;
};

export function usePullModel() {
  const queryClient = useQueryClient();

  const { mutateAsync, error, isPending, isError } = useMutation({
    mutationFn: async ({ name, onProgress }: PullModelVariables) => {
      const response = await api.stream(ENDPOINTS.PULL_MODEL, { name });
      let failure = "";

      await readJsonLines<
        PullProgressLineDTO | PullDoneLineDTO | PullErrorLineDTO
      >(response, (line) => {
        if (line.type === "progress") {
          const ratio = line.total > 0 ? line.completed / line.total : 0;
          onProgress(ratio, line.status);
        }
        if (line.type === "error") failure = line.message;
      });

      if (failure) throw new Error(failure);
      return name;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_MODELS] });
    },
  });

  return {
    pullModel: mutateAsync,
    isPullingModel: isPending,
    pullModelFailed: isError,
    pullModelError: error,
  };
}
