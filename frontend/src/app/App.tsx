import { useEffect, useRef, useState } from "react";
import { TitleBar } from "@/shared/components/TitleBar";
import { Welcome } from "@/shared/components/Welcome";
import { APP_NAME } from "@/shared/constants/config";
import { useChooseFolder } from "@/shared/hooks/useChooseFolder";
import { useIdeMenu } from "@/shared/hooks/useIdeMenu";
import { getBaseName } from "@/shared/lib/path";
import { addRecentFolder } from "@/shared/lib/recentFolders";
import type { WorkspaceView } from "@/shared/types/view";
import { IdeView } from "./ide/IdeView";
import { useTabs } from "./ide/editor/hooks/useTabs";
import { OverviewPanel } from "./overview/OverviewPanel";

export function App() {
  const [root, setRoot] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [view, setView] = useState<WorkspaceView>("editor");

  const tabs = useTabs();
  const { chooseFolder } = useChooseFolder();

  const folderName = root ? getBaseName(root) : null;
  const activeFileName = tabs.activeTab ? getBaseName(tabs.activeTab.path) : null;

  const closeAllTabsRef = useRef(tabs.closeAllTabs);
  closeAllTabsRef.current = tabs.closeAllTabs;

  function openFolder(folderPath: string) {
    addRecentFolder(folderPath);
    setRoot(folderPath);
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
        showSwitch={Boolean(root)}
        view={view}
        onViewChange={setView}
      />

      {!root ? (
        <Welcome onOpen={openFolder} />
      ) : (
        <>
          <IdeView
            root={root}
            hidden={view !== "editor"}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((open) => !open)}
            onCloseChat={() => setChatOpen(false)}
            tabs={tabs}
          />
          {view === "overview" && <OverviewPanel root={root} />}
        </>
      )}
    </>
  );
}
