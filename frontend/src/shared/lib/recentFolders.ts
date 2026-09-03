import {
  RECENT_FOLDERS_KEY,
  RECENT_FOLDERS_LIMIT,
} from "@/shared/constants/config";

function readStoredFolders(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredFolders(folders: string[]): void {
  try {
    localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    return;
  }
}

export function getRecentFolders(): string[] {
  return readStoredFolders();
}

export function addRecentFolder(folderPath: string): string[] {
  const next = [
    folderPath,
    ...readStoredFolders().filter((entry) => entry !== folderPath),
  ].slice(0, RECENT_FOLDERS_LIMIT);

  writeStoredFolders(next);
  return next;
}

export function removeRecentFolder(folderPath: string): string[] {
  const next = readStoredFolders().filter((entry) => entry !== folderPath);

  writeStoredFolders(next);
  return next;
}
