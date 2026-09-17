import { useState } from "react";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { getBaseName } from "@/shared/lib/path";
import { useGetChunks } from "./hooks/useGetChunks";

const PAGE_SIZE = 25;

export function ExplorerPanel() {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const {
    chunksOutput,
    isGettingChunks,
    isRefreshingChunks,
    getChunksFailed,
    getChunksError,
  } = useGetChunks({
    offset,
    limit: PAGE_SIZE,
  });
  const chunks = chunksOutput ? chunksOutput.chunks : [];
  const total = chunksOutput?.total ?? 0;

  const lastOffset = Math.max(0, Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE);
  const shown = total === 0 ? 0 : offset + 1;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-chrome-bg text-[13px] text-fg" aria-label="ChromaDB Explorer">
      <header className="shrink-0 border-b border-border px-7 pt-[22px] pb-4">
        <h1 className="m-0 mb-1.5 flex items-center gap-[9px] text-[16px] font-semibold text-fg-strong">
          <Database size={18} /> ChromaDB Explorer
        </h1>
        <p className="m-0 max-w-[78ch] leading-[1.55] text-fg-dim">
          Browse the collection one page at a time. Each row is one stored chunk:
          its id, source span and the exact document text that was embedded.
        </p>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-7 py-3">
        <span className="text-fg-dim">
          {isGettingChunks
            ? "Loading…"
            : `${shown}–${Math.min(offset + PAGE_SIZE, total)} of ${total} chunks`}
          {isRefreshingChunks && !isGettingChunks ? " · refreshing" : ""}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-input-bg px-3 py-[7px] [font-family:inherit] text-[12px] text-fg enabled:hover:bg-list-hover enabled:hover:text-fg-strong disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || isGettingChunks}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-input-bg px-3 py-[7px] [font-family:inherit] text-[12px] text-fg enabled:hover:bg-list-hover enabled:hover:text-fg-strong disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => setOffset(Math.min(lastOffset, offset + PAGE_SIZE))}
            disabled={offset >= lastOffset || isGettingChunks}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {getChunksFailed && <p className="m-0 px-7 py-2.5 text-danger">{getChunksError?.message}</p>}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-7 pt-3 pb-10">
        {chunks.map((chunk) => (
          <article key={chunk.id} className="shrink-0 overflow-hidden rounded-[7px] border border-border bg-editor-bg">
            <button
              type="button"
              className="grid w-full cursor-pointer grid-cols-[90px_minmax(0,1.4fr)_minmax(0,1fr)_80px] items-center gap-3 border-none bg-transparent px-3 py-[9px] text-left [font-family:inherit] text-[12px] text-fg hover:bg-list-hover hover:text-fg-strong"
              onClick={() =>
                setExpanded(expanded === chunk.id ? null : chunk.id)
              }
            >
              <span className="overflow-hidden text-[10px] tracking-[0.05em] text-ellipsis text-accent uppercase">{chunk.kind}</span>
              <span className="truncate font-mono text-[12px] text-fg-strong">{chunk.qualified_name}</span>
              <span className="truncate text-[11px] text-fg-dim" title={chunk.file}>
                {getBaseName(chunk.file)}
              </span>
              <span className="text-right font-mono text-[11px] text-fg-dim">
                {chunk.start_line}–{chunk.end_line}
              </span>
            </button>

            {expanded === chunk.id && (
              <div className="flex max-h-[420px] flex-col gap-2.5 overflow-auto border-t border-border p-3">
                <code className="font-mono text-[11px] break-all text-fg-dim">{chunk.id}</code>
                <pre className="m-0 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap [word-break:break-word] rounded-md bg-chrome-bg px-3 py-2.5">{chunk.content}</pre>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
