import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import type { OverviewData } from "@/shared/types/overview";

export function useOverview(root: string) {
  const { data, error, isLoading, isError, refetch } = useQuery<
    OverviewData,
    Error
  >({
    queryKey: [QUERY_KEYS.OVERVIEW, root],
    queryFn: () => api.get<OverviewData>(ENDPOINTS.AGENT_STATUS),
    enabled: Boolean(root),
  });

  return { overview: data ?? null, error, isLoading, isError, refetch };
}
