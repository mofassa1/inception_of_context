import { useEffect, useRef, useState } from "react";
import { TitleBar } from "@/shared/components/TitleBar";
import { Welcome } from "@/shared/components/Welcome";
import { APP_NAME } from "@/shared/constants/config";
import { useAgentEvents } from "@/shared/hooks/useAgentEvents";
import { useChooseFolder } from "@/shared/hooks/useChooseFolder";
import { useIdeMenu } from "@/shared/hooks/useIdeMenu";
import { useIgnoreRules } from "@/shared/hooks/useIgnoreRules";
import { useIndexPath } from "@/shared/hooks/useIndexPath";
import { useIndexWorkspace } from "@/shared/hooks/useIndexWorkspace";
import { useLaunchPaths } from "@/shared/hooks/useLaunchPaths";
import { getBaseName, getParentPath } from "@/shared/lib/path";
import { addRecentFolder } from "@/shared/lib/recentFolders";
import type { LaunchPath } from "@/shared/types/ide";
import type { WorkspaceView } from "@/shared/types/view";
import { AskPanel } from "./ask/AskPanel";
import { ExplorerPanel } from "./explorer/ExplorerPanel";
import { FilesPanel } from "./files/FilesPanel";
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
  const { rules, isIgnored, toggleIgnored } = useIgnoreRules();
  const { indexWorkspace, isPending: indexing } = useIndexWorkspace();
  const { indexPath, forgetPath, isPending: syncingPath } = useIndexPath();
  const { events, connected } = useAgentEvents();

  const folderName = root ? getBaseName(root) : null;
  const activeFileName = tabs.activeTab ? getBaseName(tabs.activeTab.path) : null;

  const closeAllTabsRef = useRef(tabs.closeAllTabs);
  closeAllTabsRef.current = tabs.closeAllTabs;

  function handleToggleIgnored(entryPath: string) {
    const willIgnore = !isIgnored(entryPath, "");
    toggleIgnored(entryPath);

    const request = willIgnore
      ? forgetPath(entryPath)
      : indexPath({ path: entryPath, rules });

    request.catch(() => undefined);
  }

  function openFolder(folderPath: string) {
    addRecentFolder(folderPath);
    setRoot(folderPath);
    indexWorkspace({ path: folderPath, rules }).catch(() => undefined);
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

      {view === "editor" &&
        (root ? null : <Welcome onOpen={openFolder} />)}

      {root && (
        <IdeView
          root={root}
          onCloseFolder={closeFolder}
          hidden={view !== "editor"}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((open) => !open)}
          onCloseChat={() => setChatOpen(false)}
          tabs={tabs}
          isIgnored={isIgnored}
          onToggleIgnored={handleToggleIgnored}
          rules={rules}
          indexing={indexing || syncingPath}
        />
      )}

      {view === "overview" && (
        <OverviewPanel root={root} events={events} connected={connected} />
      )}
      {view === "files" && <FilesPanel />}
      {view === "explorer" && <ExplorerPanel />}
      {view === "ask" && <AskPanel />}
      {view === "patch" && <PatchPanel root={root} />}
    </>
  );
}
