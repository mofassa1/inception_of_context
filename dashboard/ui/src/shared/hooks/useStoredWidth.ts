import { useState } from "react";

function readStoredWidth(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function useStoredWidth(key: string, fallback: number) {
  const [width, setWidth] = useState(() => readStoredWidth(key, fallback));

  function persistWidth(next: number) {
    setWidth(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      return;
    }
  }

  return [width, persistWidth] as const;
}
