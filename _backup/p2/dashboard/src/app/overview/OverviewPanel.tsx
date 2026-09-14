import type { IndexEvent } from "@/shared/types/agent";
import { ActivityList } from "./ActivityList";
import { IndexedFileRow } from "./IndexedFileRow";
import { StatCard } from "./StatCard";
import { useOverview } from "./hooks/useOverview";
import "./overview.css";

export function OverviewPanel({
  root,
  events,
  connected,
}: {
  root: string;
  events: IndexEvent[];
  connected: boolean;
}) {
  const { overview, isLoading, isError, error } = useOverview(root);

  if (isLoading) {
    return <div className="overview-loading">Loading overview…</div>;
  }

  if (isError || !overview) {
    return (
      <div className="overview-error">
        Error loading overview: {error?.message ?? "Unknown error"}
      </div>
    );
  }

  const { status, files, filesIndexed } = overview;
  const maxChunks = Math.max(1, ...files.map((file) => file.chunks));

  return (
    <div className="overview">
      <div className="overview-inner">
        <header className="ov-head">
          <div>
            <h1 className="ov-title">Overview</h1>
            <p className="ov-subtitle">
              What the indexer has persisted for this folder.
            </p>
          </div>
          <span
            className={"ov-live" + (connected ? " connected" : "")}
            title={connected ? "Streaming index events" : "Not connected"}
          >
            <span className="ov-live-dot" />
            {connected ? "live" : "offline"}
          </span>
        </header>

        <section className="ov-panel">
          <div className="ov-panel-title">Status</div>
          <div className="ov-stats">
            <StatCard
              label="Chunks indexed"
              value={status.chunksIndexed}
              highlight
            />
            <StatCard label="Files indexed" value={filesIndexed} />
            <StatCard label="Target project" value={status.targetProject} />
            <StatCard label="Chroma path" value={status.chromaPath} />
            <StatCard label="Embedding model" value={status.embedModel} />
            <StatCard label="Ask model" value={status.askModel} />
            <StatCard label="Code model" value={status.codeModel} />
            <StatCard label="Ollama backend" value={status.ollamaBackend} />
            <StatCard
              label="Watch mode"
              value={status.watching ? "watching for changes" : "not watching"}
            />
          </div>
        </section>

        <section className="ov-panel">
          <div className="ov-panel-title">Indexed files</div>
          {files.length === 0 ? (
            <p className="ov-empty">nothing indexed yet.</p>
          ) : (
            <div className="ov-files">
              {files.map((file) => (
                <IndexedFileRow
                  key={file.name}
                  file={file}
                  maxChunks={maxChunks}
                />
              ))}
            </div>
          )}
        </section>

        <section className="ov-panel">
          <div className="ov-panel-title">Live activity</div>
          <ActivityList events={events} />
        </section>
      </div>
    </div>
  );
}
