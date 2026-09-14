import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EditorState } from "@codemirror/state";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { isPathInside, replacePathPrefix } from "@/shared/lib/path";
import type { FileContent } from "@/shared/types/filesystem";
import type { EditorTab, FileSaveStatus } from "@/shared/types/editor";
import { createDocumentState } from "../codemirror";
import { useSaveFile } from "./useSaveFile";

export function useTabs() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  const queryClient = useQueryClient();

  function setStatus(
    filePath: string,
    status: FileSaveStatus,
    error?: string,
  ) {
    setTabs((current) =>
      current.map((tab) =>
        tab.path === filePath ? { ...tab, status, error } : tab,
      ),
    );
  }

  const { scheduleSave, flushSave } = useSaveFile({
    onSaving: (filePath) => setStatus(filePath, "saving"),
    onSaved: (filePath) => setStatus(filePath, "saved"),
    onSaveFailed: (filePath, message) =>
      setStatus(filePath, "error", message),
  });

  function handleDocumentChange(state: EditorState) {
    const filePath = activePathRef.current;
    if (!filePath) return;

    setTabs((current) =>
      current.map((tab) => (tab.path === filePath ? { ...tab, state } : tab)),
    );
    scheduleSave(filePath, state.doc.toString());
  }

  async function openFile(filePath: string) {
    if (tabsRef.current.some((tab) => tab.path === filePath)) {
      flushSave();
      setActivePath(filePath);
      return;
    }

    let content: string;

    try {
      content = await queryClient.fetchQuery({
        queryKey: [QUERY_KEYS.FILE_CONTENT, filePath],
        queryFn: () =>
          api
            .get<FileContent>(ENDPOINTS.FILES_READ, {
              params: { path: filePath },
            })
            .then((file) => file.content),
      });
    } catch (error) {
      alert(`Couldn't open ${filePath}: ${(error as Error).message}`);
      return;
    }

    const state = await createDocumentState(
      filePath,
      content,
      handleDocumentChange,
    );

    flushSave();
    setTabs((current) => [...current, { path: filePath, state, status: "saved" }]);
    setActivePath(filePath);
  }

  function switchTab(filePath: string) {
    if (filePath === activePathRef.current) return;
    flushSave();
    setActivePath(filePath);
  }

  function closeTab(filePath: string) {
    if (filePath === activePathRef.current) flushSave();

    const remaining = tabsRef.current.filter((tab) => tab.path !== filePath);
    setTabs(remaining);

    if (activePathRef.current === filePath) {
      setActivePath(remaining.length ? remaining[remaining.length - 1].path : null);
    }
  }

  function closeAllTabs() {
    flushSave();
    setTabs([]);
    setActivePath(null);
  }

  function handlePathRemoved(removedPath: string) {
    const remaining = tabsRef.current.filter(
      (tab) => !isPathInside(tab.path, removedPath),
    );
    setTabs(remaining);

    if (
      activePathRef.current &&
      isPathInside(activePathRef.current, removedPath)
    ) {
      setActivePath(remaining.length ? remaining[remaining.length - 1].path : null);
    }
  }

  function handlePathRenamed(previousPath: string, nextPath: string) {
    setTabs(
      tabsRef.current.map((tab) =>
        isPathInside(tab.path, previousPath)
          ? { ...tab, path: replacePathPrefix(tab.path, previousPath, nextPath) }
          : tab,
      ),
    );

    if (
      activePathRef.current &&
      isPathInside(activePathRef.current, previousPath)
    ) {
      setActivePath(
        replacePathPrefix(activePathRef.current, previousPath, nextPath),
      );
    }
  }

  const activeTab = tabs.find((tab) => tab.path === activePath) ?? null;

  return {
    tabs,
    activePath,
    activeTab,
    openFile,
    switchTab,
    closeTab,
    closeAllTabs,
    handleDocumentChange,
    handlePathRemoved,
    handlePathRenamed,
  };
}
