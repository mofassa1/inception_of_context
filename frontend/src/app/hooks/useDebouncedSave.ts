import { useRef } from "react";

export function useDebouncedSave(save: (key: string, value: string) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ key: string; value: string } | null>(null);

  function run() {
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) save(p.key, p.value);
  }

  function schedule(key: string, value: string) {
    pending.current = { key, value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, delay);
  }

  function flush() {
    if (!timer.current) return;
    clearTimeout(timer.current);
    run();
  }

  return { schedule, flush };
}
