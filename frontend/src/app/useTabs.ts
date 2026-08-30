import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EditorState } from "@codemirror/state";
import * as api from "./api.js";
import { createDocState } from "./editor.js";

export type SaveStatus = "saved" | "saving" | "error";

export type Tab = {
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
    setTabs((ts) => ts.map((t) => (t.path === path ? { ...t, status, error } : t)));
  }

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<{ path: string; content: string } | null>(null);

  function writeNow(path: string, content: string) {
    setStatus(path, "saving");
    saveMutation.mutate(
      { path, content },
      {
        onSuccess: () => setStatus(path, "saved"),
        onError: (err) => setStatus(path, "error", (err as Error).message),
      },
    );
  }

  function scheduleSave(path: string, content: string) {
    pendingSave.current = { path, content };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const p = pendingSave.current;
      pendingSave.current = null;
      if (p) writeNow(p.path, p.content);
    }, AUTOSAVE_DELAY_MS);
  }

  function flushSave() {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const p = pendingSave.current;
    pendingSave.current = null;
    if (p) writeNow(p.path, p.content);
  }

  useEffect(() => {
    window.addEventListener("beforeunload", flushSave);
    return () => window.removeEventListener("beforeunload", flushSave);
  }, []);

  function onDocChange(state: EditorState) {
    const path = activeRef.current;
    if (!path) return;
    setTabs((ts) => ts.map((t) => (t.path === path ? { ...t, state } : t)));
    scheduleSave(path, state.doc.toString());
  }

  async function openFile(path: string) {
    if (tabsRef.current.some((t) => t.path === path)) {
      flushSave();
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
    const state = await createDocState(path, content, onDocChange);
    flushSave();
    setTabs((ts) => [...ts, { path, state, status: "saved" }]);
    setActive(path);
  }

  function switchTab(path: string) {
    if (path === activeRef.current) return;
    flushSave();
    setActive(path);
  }

  function closeTab(path: string) {
    if (path === activeRef.current) flushSave();
    const next = tabsRef.current.filter((t) => t.path !== path);
    setTabs(next);
    if (activeRef.current === path) {
      setActive(next.length ? next[next.length - 1].path : null);
    }
  }

  function closeAll() {
    flushSave();
    setTabs([]);
    setActive(null);
  }

  function isAtOrUnder(p: string, base: string) {
    return p === base || p.startsWith(base + "/");
  }

  function handleTreeRemoved(removedPath: string) {
    const next = tabsRef.current.filter((t) => !isAtOrUnder(t.path, removedPath));
    setTabs(next);
    if (activeRef.current && isAtOrUnder(activeRef.current, removedPath)) {
      setActive(next.length ? next[next.length - 1].path : null);
    }
  }

  function handleTreeRenamed(oldPath: string, newPath: string) {
    function rewritePath(p: string) {
      if (p === oldPath) return newPath;
      if (p.startsWith(oldPath + "/")) return newPath + p.slice(oldPath.length);
      return p;
    }

    setTabs(
      tabsRef.current.map((t) =>
        isAtOrUnder(t.path, oldPath) ? { ...t, path: rewritePath(t.path) } : t,
      ),
    );
    if (activeRef.current && isAtOrUnder(activeRef.current, oldPath)) {
      setActive(rewritePath(activeRef.current));
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
    closeAll,
    onDocChange,
    handleTreeRemoved,
    handleTreeRenamed,
  };
}
