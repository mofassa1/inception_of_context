import { useState } from "react";
import { ArrowRight, Folder, FolderInput, SquareTerminal, X } from "lucide-react";
import { hasDesktopBridge, resolveRealPath } from "@/shared/api/desktopBridge";
import { useChooseFolder } from "@/shared/hooks/useChooseFolder";
import { useOpenFolder } from "@/shared/hooks/useOpenFolder";
import { useRecentFolders } from "@/shared/hooks/useRecentFolders";
import { getBaseName } from "@/shared/lib/path";
import "./Welcome.css";

const MODIFIER_KEY = navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl";

export function Welcome({ onOpen }: { onOpen: (folderPath: string) => void }) {
  const [typedPath, setTypedPath] = useState("");
  const { recentFolders, forgetFolder, forgetAllFolders } = useRecentFolders();
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
      ? openError.message || `Couldn't open ${attemptedPath}`
      : null;

  async function pickAndOpen() {
    const folderPath = await chooseFolder().catch(() => null);
    if (folderPath) onOpen(folderPath);
  }

  async function openRecent(folderPath: string) {
    try {
      onOpen(await openFolder(folderPath));
    } catch {
      const stillExists = await resolveRealPath(folderPath);
      if (!stillExists) forgetFolder(folderPath);
    }
  }

  async function openTypedPath() {
    const folderPath = typedPath.trim();
    if (!folderPath) return;

    try {
      onOpen(await openFolder(folderPath));
    } catch {
      return;
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-mark">
          <SquareTerminal size={30} strokeWidth={1.75} />
        </div>
        <h1 className="welcome-title">Inception of Context</h1>
        <p className="welcome-tagline">
          Open a project to edit it. The Overview, Files, ChromaDB, Ask and Patch
          tabs read the index directly and work without one.
        </p>

        <div className="welcome-actions">
          {hasDesktopBridge() && (
            <>
              <button className="welcome-open" disabled={busy} onClick={pickAndOpen}>
                <Folder size={16} />
                <span>Open Folder</span>
                <kbd>{MODIFIER_KEY} O</kbd>
              </button>
              <div className="welcome-divider">
                <span>or type a path</span>
              </div>
            </>
          )}

          <form
            className={"welcome-path" + (openError ? " invalid" : "")}
            onSubmit={(event) => {
              event.preventDefault();
              openTypedPath();
            }}
          >
            <FolderInput size={15} className="welcome-path-icon" />
            <input
              value={typedPath}
              onChange={(event) => setTypedPath(event.target.value)}
              placeholder="/path/to/your/project"
              aria-label="Project folder path"
              spellCheck={false}
            />
            <button
              type="submit"
              className="welcome-path-submit"
              disabled={busy || !typedPath.trim()}
            >
              <span>{opening ? "Opening…" : "Open"}</span>
              <ArrowRight size={13} />
            </button>
          </form>

          {errorMessage && <p className="welcome-error">{errorMessage}</p>}
        </div>

        {recentFolders.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-head">
              <span className="welcome-recent-label">Recent</span>
              <button
                type="button"
                className="welcome-recent-clear"
                disabled={busy}
                onClick={forgetAllFolders}
              >
                Clear all
              </button>
            </div>
            {recentFolders.map((folderPath) => (
              <div key={folderPath} className="welcome-recent-row">
                <button
                  type="button"
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
                <button
                  type="button"
                  className="welcome-recent-remove"
                  title="Remove from Recent"
                  aria-label={`Remove ${getBaseName(folderPath)} from Recent`}
                  disabled={busy}
                  onClick={() => forgetFolder(folderPath)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
