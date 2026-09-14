import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EditorState } from "@codemirror/state";
import { api } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { isPathInside, replacePathPrefix } from "@/shared/lib/path";
import type { ReadFileInputDTO, ReadFileOutputDTO } from "@/shared/types/dto";
import type { EditorTab, FileSaveStatus } from "@/shared/types/editor";
import { createDocumentState } from "../codemirror";
import { useWriteFile } from "./useWriteFile";

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

  const { scheduleWriteFile, flushWriteFile } = useWriteFile({
    onWriteStarted: (path) => setStatus(path, "saving"),
    onWriteSucceeded: (path) => setStatus(path, "saved"),
    onWriteFailed: (path, message) => setStatus(path, "error", message),
  });

  function handleDocumentChange(state: EditorState) {
    const filePath = activePathRef.current;
    if (!filePath) return;

    setTabs((current) =>
      current.map((tab) => (tab.path === filePath ? { ...tab, state } : tab)),
    );
    scheduleWriteFile({ path: filePath, content: state.doc.toString() });
  }

  async function openFile(filePath: string) {
    if (tabsRef.current.some((tab) => tab.path === filePath)) {
      flushWriteFile();
      setActivePath(filePath);
      return;
    }

    const params: ReadFileInputDTO = { path: filePath };
    let readFileOutput: ReadFileOutputDTO;

    try {
      readFileOutput = await queryClient.fetchQuery({
        queryKey: [QUERY_KEYS.READ_FILE, params.path],
        queryFn: () =>
          api.get<ReadFileOutputDTO>(ENDPOINTS.READ_FILE, { params }),
      });
    } catch (error) {
      alert(`Couldn't open ${filePath}: ${(error as Error).message}`);
      return;
    }

    const state = await createDocumentState(
      filePath,
      readFileOutput.content,
      handleDocumentChange,
    );

    flushWriteFile();
    setTabs((current) => [...current, { path: filePath, state, status: "saved" }]);
    setActivePath(filePath);
  }

  function switchTab(filePath: string) {
    if (filePath === activePathRef.current) return;
    flushWriteFile();
    setActivePath(filePath);
  }

  function closeTab(filePath: string) {
    if (filePath === activePathRef.current) flushWriteFile();

    const remaining = tabsRef.current.filter((tab) => tab.path !== filePath);
    setTabs(remaining);

    if (activePathRef.current === filePath) {
      setActivePath(remaining.length ? remaining[remaining.length - 1].path : null);
    }
  }

  function closeAllTabs() {
    flushWriteFile();
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
