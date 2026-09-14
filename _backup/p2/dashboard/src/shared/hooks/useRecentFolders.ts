import { useState } from "react";
import {
  clearRecentFolders,
  getRecentFolders,
  removeRecentFolder,
} from "@/shared/lib/recentFolders";

export function useRecentFolders() {
  const [recentFolders, setRecentFolders] = useState(getRecentFolders);

  function forgetFolder(folderPath: string) {
    setRecentFolders(removeRecentFolder(folderPath));
  }

  function forgetAllFolders() {
    setRecentFolders(clearRecentFolders());
  }

  return { recentFolders, forgetFolder, forgetAllFolders };
}
