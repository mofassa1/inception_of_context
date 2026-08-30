import { useQuery } from "@tanstack/react-query";
import * as api from "../api.js";

export function useDirEntries(path: string, enabled = true) {
  return useQuery({
    queryKey: ["fs", "list", path],
    queryFn: () => api.listDir(path).then((r) => r.entries),
    enabled,
  });
}
