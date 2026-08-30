import { useState } from "react";
import { chooseFolder } from "../api.js";

export function Welcome({ onOpen }: { onOpen: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="ide-empty">
      <div className="ide-empty-card">
        <h1>not vscode</h1>
        <p className="muted">Open a folder to start editing.</p>
        <button className="navbtn primary" disabled={busy} onClick={pickAndOpen}>
          Open Folder…
        </button>
        {error && <p className="tree-error">{error}</p>}
      </div>
    </div>
  );
}
