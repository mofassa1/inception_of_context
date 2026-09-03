import { ArrowRight, Folder, SquareTerminal } from "lucide-react";
import { useChooseFolder } from "@/shared/hooks/useChooseFolder";
import { useOpenFolder } from "@/shared/hooks/useOpenFolder";
import { useRecentFolders } from "@/shared/hooks/useRecentFolders";
import { getBaseName } from "@/shared/lib/path";
import "./Welcome.css";

const MODIFIER_KEY = navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl";

export function Welcome({ onOpen }: { onOpen: (folderPath: string) => void }) {
  const { recentFolders, forgetFolder } = useRecentFolders();
  const {
    chooseFolder,
    error: chooseError,
    isPending: choosing,
  } = useChooseFolder();
  const {
    openFolder,
    attemptedPath,
    error: openError,
    isPending: opening,
  } = useOpenFolder();

  const busy = choosing || opening;

  const errorMessage = chooseError
    ? chooseError.message
    : openError
      ? `Couldn't open ${attemptedPath}`
      : null;

  async function pickAndOpen() {
    const folderPath = await chooseFolder().catch(() => null);
    if (folderPath) onOpen(folderPath);
  }

  async function openRecent(folderPath: string) {
    try {
      await openFolder(folderPath);
      onOpen(folderPath);
    } catch {
      forgetFolder(folderPath);
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-mark">
          <SquareTerminal size={30} strokeWidth={1.75} />
        </div>
        <h1 className="welcome-title">not vscode</h1>
        <p className="welcome-tagline">
          Open a folder, edit some files, autosave to disk. That's the whole app.
        </p>

        <button className="welcome-open" disabled={busy} onClick={pickAndOpen}>
          <Folder size={16} />
          <span>Open Folder</span>
          <kbd>{MODIFIER_KEY} O</kbd>
        </button>

        {errorMessage && <p className="welcome-error">{errorMessage}</p>}

        {recentFolders.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-label">Recent</div>
            {recentFolders.map((folderPath) => (
              <button
                key={folderPath}
                className="welcome-recent-item"
                disabled={busy}
                onClick={() => openRecent(folderPath)}
              >
                <Folder size={16} className="welcome-recent-icon" />
                <span className="welcome-recent-text">
                  <span className="welcome-recent-name">
                    {getBaseName(folderPath)}
                  </span>
                  <span className="welcome-recent-path">{folderPath}</span>
                </span>
                <ArrowRight size={14} className="welcome-recent-arrow" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
