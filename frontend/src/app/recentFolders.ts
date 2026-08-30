const KEY = "not-vscode:recent-folders";
const MAX = 6;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === "string")
      : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return;
  }
}

export function getRecentFolders(): string[] {
  return read();
}

export function addRecentFolder(path: string): string[] {
  const next = [path, ...read().filter((p) => p !== path)].slice(0, MAX);
  write(next);
  return next;
}

export function removeRecentFolder(path: string): string[] {
  const next = read().filter((p) => p !== path);
  write(next);
  return next;
}
