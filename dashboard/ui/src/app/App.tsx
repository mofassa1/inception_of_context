import { useEffect, useRef, useState } from "react";
import { TitleBar } from "@/shared/components/TitleBar";
import { APP_NAME } from "@/shared/constants/config";
import { useStreamEvents } from "@/shared/hooks/useStreamEvents";
import { useChooseFolder } from "@/shared/hooks/useChooseFolder";
import { useIdeMenu } from "@/shared/hooks/useIdeMenu";
import { useLaunchPaths } from "@/shared/hooks/useLaunchPaths";
import { getBaseName, getParentPath } from "@/shared/lib/path";
import type { LaunchPath } from "@/shared/types/ide";
import type { WorkspaceView } from "@/shared/types/view";
import { AskPanel } from "./ask/AskPanel";
import { ExplorerPanel } from "./explorer/ExplorerPanel";
import { IdeView } from "./ide/IdeView";
import { useTabs } from "./ide/editor/hooks/useTabs";
import { OverviewPanel } from "./overview/OverviewPanel";
import { PatchPanel } from "./patch/PatchPanel";

export function App() {
  const [root, setRoot] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [view, setView] = useState<WorkspaceView>("editor");

  const tabs = useTabs();
  const { chooseFolder } = useChooseFolder();
  const { events, connected } = useStreamEvents();

  const folderName = root ? getBaseName(root) : null;
  const activeFileName = tabs.activeTab ? getBaseName(tabs.activeTab.path) : null;

  const closeAllTabsRef = useRef(tabs.closeAllTabs);
  closeAllTabsRef.current = tabs.closeAllTabs;

  function openFolder(folderPath: string) {
    setRoot(folderPath);
  }

  function openLaunchPaths(paths: LaunchPath[]) {
    const directory = paths.find((entry) => entry.isDir);
    const files = paths.filter((entry) => !entry.isDir);

    const workspaceRoot =
      directory?.path ?? (files[0] ? getParentPath(files[0].path) : null);

    if (workspaceRoot) openFolder(workspaceRoot);
    for (const file of files) tabs.openFile(file.path);
  }

  async function pickFolderFromMenu() {
    try {
      const folderPath = await chooseFolder();
      if (folderPath) openFolder(folderPath);
    } catch (error) {
      alert("Couldn't open folder: " + (error as Error).message);
    }
  }

  function closeFolder() {
    setRoot(null);
    closeAllTabsRef.current();
  }

  useLaunchPaths(openLaunchPaths);

  useIdeMenu((action) => {
    if (action === "open-folder") pickFolderFromMenu();
    else if (action === "close-folder") closeFolder();
    else if (action === "toggle-chat") setChatOpen((open) => !open);
  });

  useEffect(() => {
    document.title = [activeFileName, folderName, APP_NAME]
      .filter(Boolean)
      .join(" — ");
  }, [activeFileName, folderName]);

  return (
    <>
      <TitleBar
        label={folderName ?? APP_NAME}
        title={root ?? undefined}
        showSwitch
        view={view}
        onViewChange={setView}
      />

      {root && (
        <IdeView
          root={root}
          onCloseFolder={closeFolder}
          hidden={view !== "editor"}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((open) => !open)}
          onCloseChat={() => setChatOpen(false)}
          tabs={tabs}
        />
      )}

      {view === "overview" && (
        <OverviewPanel events={events} connected={connected} />
      )}
      {view === "explorer" && <ExplorerPanel />}
      {view === "ask" && <AskPanel />}
      {view === "patch" && <PatchPanel root={root} />}
    </>
  );
}
