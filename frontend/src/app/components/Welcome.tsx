import { useState } from "react";
import { ArrowRight, Folder, SquareTerminal } from "lucide-react";
import { chooseFolder, listDir } from "../api.js";
import { getRecentFolders, removeRecentFolder } from "../recentFolders.js";

const MOD = navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl";

export function Welcome({ onOpen }: { onOpen: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState(getRecentFolders);

  async function pickAndOpen() {
    setBusy(true);
    setError(null);
    try {
      const picked = await chooseFolder();
      if (picked) onOpen(picked);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openRecent(path: string) {
    setBusy(true);
    setError(null);
    try {
      await listDir(path);
      onOpen(path);
    } catch {
      setError(`Couldn't open ${path}`);
      setRecents(removeRecentFolder(path));
    } finally {
      setBusy(false);
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
          <kbd>{MOD} O</kbd>
        </button>

        {error && <p className="welcome-error">{error}</p>}

        {recents.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-label">Recent</div>
            {recents.map((path) => (
              <button
                key={path}
                className="welcome-recent-item"
                disabled={busy}
                onClick={() => openRecent(path)}
              >
                <Folder size={16} className="welcome-recent-icon" />
                <span className="welcome-recent-text">
                  <span className="welcome-recent-name">
                    {path.split("/").pop() || path}
                  </span>
                  <span className="welcome-recent-path">{path}</span>
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
