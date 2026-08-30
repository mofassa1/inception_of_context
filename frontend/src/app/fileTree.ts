import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api.js";

export type TreeCallbacks = {
  onOpenFile: (path: string) => void;
  onPathRemoved: (path: string) => void;
  onPathRenamed: (oldPath: string, newPath: string) => void;
};

function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

export function useDirectory(path: string, enabled = true) {
  return useQuery({
    queryKey: ["fs", "list", path],
    queryFn: () => api.listDir(path).then((r) => r.entries),
    enabled,
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, isDir }: { path: string; isDir: boolean }) =>
      api.createEntry(path, isDir),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fs", "list", parentOf(vars.path)] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.deleteEntry(path),
    onSuccess: (_data, path) => {
      queryClient.invalidateQueries({ queryKey: ["fs", "list", parentOf(path)] });
    },
  });
}

export function useRenameEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, newPath }: { path: string; newPath: string }) =>
      api.renameEntry(path, newPath),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fs", "list", parentOf(vars.path)] });
      queryClient.invalidateQueries({ queryKey: ["fs", "list", parentOf(vars.newPath)] });
    },
  });
}
