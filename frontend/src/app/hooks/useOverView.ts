import { useQuery } from "@tanstack/react-query";
import { fetchOverview, type OverviewData } from "../overview";

export function useOverview(root: string) {
  return useQuery<OverviewData, Error>({
    queryKey: ["overview", root],
    queryFn: () => fetchOverview(root),
    enabled: Boolean(root),
  });
}