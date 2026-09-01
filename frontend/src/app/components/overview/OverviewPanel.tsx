import { useMemo } from "react";
import { mockOverview, type ActivityEvent, type IndexedFile } from "../../overview.js";

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  modified: "modified",
  created: "created",
  deleted: "deleted",
};

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={"ov-stat" + (highlight ? " hl" : "")}>
      <span className="ov-stat-label">{label}</span>
      <span className="ov-stat-value">{value}</span>
    </div>
  );
}

function FileRow({ file, max }: { file: IndexedFile; max: number }) {
  const width = 6 + Math.round(78 * (file.chunks / max));
  return (
    <div className="ov-file">
      <span className="ov-file-name" title={file.name}>
        {file.name}
      </span>
      <span className="ov-file-count">
        {file.chunks} chunk{file.chunks === 1 ? "" : "s"}
      </span>
      <span className="ov-file-track">
        <span className="ov-file-bar" style={{ width }} />
      </span>
    </div>
  );
}

export function OverviewPanel({ root }: { root: string }) {
  // TODO(backend): placeholder data — see overview.ts. Swap for fetchOverview(root)
  // once GET /api/agent/status and the file-events stream are implemented.
  const { status, files, activity } = useMemo(() => mockOverview(root), [root]);
  const maxChunks = Math.max(1, ...files.map((f) => f.chunks));

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
          <span className="ov-live" title="Placeholder — not connected yet">
            <span className="ov-live-dot" />
            live
          </span>
        </header>

        <section className="ov-panel">
          <div className="ov-panel-title">Status</div>
          <div className="ov-stats">
            <StatCard label="Chunks indexed" value={status.chunksIndexed} highlight />
            <StatCard label="Target project" value={status.targetProject} />
            <StatCard label="Chroma path" value={status.chromaPath} />
            <StatCard label="Ask model" value={status.askModel} />
            <StatCard label="Code model" value={status.codeModel} />
            <StatCard label="Ollama backend" value={status.ollamaBackend} />
          </div>
        </section>

        <section className="ov-panel">
          <div className="ov-panel-title">Indexed files</div>
          {files.length === 0 ? (
            <p className="ov-empty">nothing indexed yet.</p>
          ) : (
            <div className="ov-files">
              {files.map((file) => (
                <FileRow key={file.name} file={file} max={maxChunks} />
              ))}
            </div>
          )}
        </section>

        <section className="ov-panel">
          <div className="ov-panel-title">Live activity</div>
          {activity.length === 0 ? (
            <p className="ov-empty">
              no file activity yet. edit a file in the target to see live updates.
            </p>
          ) : (
            <div className="ov-events">
              {activity.map((event) => (
                <div key={event.id} className="ov-event">
                  <span className={"ov-event-dot ov-" + event.kind} />
                  <span className="ov-event-kind">{KIND_LABEL[event.kind]}</span>
                  <span className="ov-event-path" title={event.path}>
                    {event.path}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
