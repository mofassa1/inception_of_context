import { useState } from "react";
import {
  getRecentFolders,
  removeRecentFolder,
} from "@/shared/lib/recentFolders";

export function useRecentFolders() {
  const [recentFolders, setRecentFolders] = useState(getRecentFolders);

  function forgetFolder(folderPath: string) {
    setRecentFolders(removeRecentFolder(folderPath));
  }

  return { recentFolders, forgetFolder };
}
