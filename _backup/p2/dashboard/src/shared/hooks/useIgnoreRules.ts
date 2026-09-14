import { useCallback, useState } from "react";
import {
  DEFAULT_IGNORE_NAMES,
  IGNORE_PATHS_KEY,
} from "@/shared/constants/ignore";
import type { IgnoreRules } from "@/shared/types/agent";

function readIgnoredPaths(): string[] {
  try {
    const raw = localStorage.getItem(IGNORE_PATHS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIgnoredPaths(paths: string[]): void {
  try {
    localStorage.setItem(IGNORE_PATHS_KEY, JSON.stringify(paths));
  } catch {
    return;
  }
}

export function useIgnoreRules() {
  const [ignoredPaths, setIgnoredPaths] = useState<string[]>(readIgnoredPaths);

  const isIgnored = useCallback(
    (entryPath: string, entryName: string) =>
      DEFAULT_IGNORE_NAMES.includes(entryName as never) ||
      ignoredPaths.includes(entryPath),
    [ignoredPaths],
  );

  const toggleIgnored = useCallback((entryPath: string) => {
    setIgnoredPaths((current) => {
      const next = current.includes(entryPath)
        ? current.filter((entry) => entry !== entryPath)
        : [...current, entryPath];

      writeIgnoredPaths(next);
      return next;
    });
  }, []);

  const rules: IgnoreRules = {
    ignoreNames: [...DEFAULT_IGNORE_NAMES],
    ignorePaths: ignoredPaths,
  };

  return { rules, ignoredPaths, isIgnored, toggleIgnored };
}
