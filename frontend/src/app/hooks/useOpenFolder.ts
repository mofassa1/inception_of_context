import { useMutation } from "@tanstack/react-query";
import * as api from "../api.js";

export function useOpenFolder() {
  return useMutation({
    mutationFn: async (path: string) => {
      await api.listDir(path);
      return path;
    },
  });
}
