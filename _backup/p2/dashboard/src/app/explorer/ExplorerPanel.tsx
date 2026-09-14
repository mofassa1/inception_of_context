import { useState } from "react";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { getBaseName } from "@/shared/lib/path";
import { useChunkPage } from "./hooks/useChunkPage";
import "./explorer.css";

const PAGE_SIZE = 25;

export function ExplorerPanel() {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { chunks, total, isLoading, isError, error, isFetching } = useChunkPage(
    offset,
    PAGE_SIZE,
  );

  const lastOffset = Math.max(0, Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE);
  const shown = total === 0 ? 0 : offset + 1;

  return (
    <section className="panel explorer-panel" aria-label="ChromaDB Explorer">
      <header className="panel-header">
        <h1>
          <Database size={18} /> ChromaDB Explorer
        </h1>
        <p>
          Browse the collection one page at a time. Each row is one stored chunk:
          its id, source span and the exact document text that was embedded.
        </p>
      </header>

      <div className="explorer-toolbar">
        <span className="muted">
          {isLoading
            ? "Loading…"
            : `${shown}–${Math.min(offset + PAGE_SIZE, total)} of ${total} chunks`}
          {isFetching && !isLoading ? " · refreshing" : ""}
        </span>

        <div className="explorer-pager">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || isLoading}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <button
            type="button"
            onClick={() => setOffset(Math.min(lastOffset, offset + PAGE_SIZE))}
            disabled={offset >= lastOffset || isLoading}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {isError && <p className="error">{error?.message}</p>}

      <div className="explorer-rows">
        {chunks.map((chunk) => (
          <article key={chunk.id} className="explorer-row">
            <button
              type="button"
              className="explorer-row-head"
              onClick={() =>
                setExpanded(expanded === chunk.id ? null : chunk.id)
              }
            >
              <span className="explorer-kind">{chunk.kind}</span>
              <span className="explorer-name">{chunk.qualifiedName}</span>
              <span className="explorer-file" title={chunk.file}>
                {getBaseName(chunk.file)}
              </span>
              <span className="explorer-lines">
                {chunk.startLine}–{chunk.endLine}
              </span>
            </button>

            {expanded === chunk.id && (
              <div className="explorer-detail">
                <code className="explorer-id">{chunk.id}</code>
                <pre>{chunk.content}</pre>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
