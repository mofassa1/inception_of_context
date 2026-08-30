import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EditorState } from "@codemirror/state";
import * as api from "../api.js";
import { createFileState } from "../editor.js";
import { useDebouncedSave } from "./useDebouncedSave.js";

type SaveStatus = "saved" | "saving" | "error";
type Tab = {
  path: string;
  state: EditorState;
  status: SaveStatus;
  error?: string;
};

const AUTOSAVE_DELAY_MS = 280;

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(active);
  activeRef.current = active;

  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      api.writeFile(path, content),
  });

  function setStatus(path: string, status: SaveStatus, error?: string) {
    setTabs((ts) =>
      ts.map((t) => (t.path === path ? { ...t, status, error } : t)),
    );
  }

  const { schedule, flush } = useDebouncedSave((path, content) => {
    setStatus(path, "saving");
    saveMutation.mutate(
      { path, content },
      {
        onSuccess: () => setStatus(path, "saved"),
        onError: (err) => setStatus(path, "error", (err as Error).message),
      },
    );
  }, AUTOSAVE_DELAY_MS);

  function onDocChange(state: EditorState) {
    const path = activeRef.current;
    if (!path) return;
    setTabs((ts) => ts.map((t) => (t.path === path ? { ...t, state } : t)));
    schedule(path, state.doc.toString());
  }

  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [flush]);

  async function openFile(path: string) {
    if (tabsRef.current.some((t) => t.path === path)) {
      flush();
      setActive(path);
      return;
    }
    let content: string;
    try {
      content = await queryClient.fetchQuery({
        queryKey: ["fs", "read", path],
        queryFn: () => api.readFile(path).then((r) => r.content),
      });
    } catch (err) {
      alert(`Couldn't open ${path}: ${(err as Error).message}`);
      return;
    }
    const state = await createFileState(path, content, onDocChange);
    flush();
    setTabs((ts) => [...ts, { path, state, status: "saved" }]);
    setActive(path);
  }

  function switchTab(path: string) {
    if (path === activeRef.current) return;
    flush();
    setActive(path);
  }

  function closeTab(path: string) {
    if (path === activeRef.current) flush();
    const next = tabsRef.current.filter((t) => t.path !== path);
    setTabs(next);
    if (activeRef.current === path) {
      setActive(next.length ? next[next.length - 1].path : null);
    }
  }

  function handleTreeRemoved(path: string) {
    const next = tabsRef.current.filter(
      (t) => t.path !== path && !t.path.startsWith(path + "/"),
    );
    setTabs(next);
    if (
      activeRef.current === path ||
      activeRef.current?.startsWith(path + "/")
    ) {
      setActive(next.length ? next[next.length - 1].path : null);
    }
  }

  function handleTreeRenamed(oldPath: string, newPath: string) {
    const rename = (p: string) =>
      p === oldPath
        ? newPath
        : p.startsWith(oldPath + "/")
          ? newPath + p.slice(oldPath.length)
          : p;
    setTabs(
      tabsRef.current.map((t) =>
        t.path === oldPath || t.path.startsWith(oldPath + "/")
          ? { ...t, path: rename(t.path) }
          : t,
      ),
    );
    if (
      activeRef.current &&
      (activeRef.current === oldPath ||
        activeRef.current.startsWith(oldPath + "/"))
    ) {
      setActive(rename(activeRef.current));
    }
  }

  const activeTab = tabs.find((t) => t.path === active) ?? null;

  return {
    tabs,
    active,
    activeTab,
    openFile,
    switchTab,
    closeTab,
    onDocChange,
    handleTreeRemoved,
    handleTreeRenamed,
  };
}
