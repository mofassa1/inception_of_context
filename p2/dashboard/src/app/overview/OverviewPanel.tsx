import type { IndexEventDTO } from "@/shared/types/dto";
import { ActivityList } from "./ActivityList";
import { IndexedFileRow } from "./IndexedFileRow";
import { StatCard } from "./StatCard";
import { useGetStatus } from "./hooks/useGetStatus";

export function OverviewPanel({
  events,
  connected,
}: {
  events: IndexEventDTO[];
  connected: boolean;
}) {
  const { statusOutput, isGettingStatus, getStatusFailed, getStatusError } =
    useGetStatus();

  if (isGettingStatus) {
    return <div className="flex min-h-0 flex-1 items-center justify-center bg-chrome-bg p-8 text-center text-[13px] text-fg-dim">Loading overview…</div>;
  }

  if (getStatusFailed || !statusOutput) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-chrome-bg p-8 text-center text-[13px] text-danger">
        Error loading overview: {getStatusError?.message ?? "Unknown error"}
      </div>
    );
  }

  const { files } = statusOutput;
  const maxChunks = Math.max(1, ...files.map((file) => file.chunks));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-chrome-bg">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-5 px-8 pt-7 pb-14">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-[20px] font-bold tracking-[-0.01em] text-fg-strong">Overview</h1>
            <p className="mt-1 mb-0 text-[12.5px] text-fg-dim">
              What the indexer has persisted for this folder.
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-ok/8 px-[9px] py-[3px] text-[11px] text-ok"
            title={connected ? "Streaming index events" : "Not connected"}
          >
            <span className="size-[7px] rounded-full bg-ok shadow-[0_0_0_3px_rgba(152,195,121,0.18)]" />
            {connected ? "live" : "offline"}
          </span>
        </header>

        <section className="rounded-xl border border-border bg-white/1.5 px-[18px] pt-4 pb-[18px]">
          <div className="mb-3 text-[11px] font-bold tracking-[0.09em] text-fg-dim uppercase">Status</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-2.5">
            <StatCard
              label="Chunks indexed"
              value={statusOutput.chunks_indexed}
              highlight
            />
            <StatCard label="Files indexed" value={files.length} />
            <StatCard label="Target project" value={statusOutput.target_project} />
            <StatCard label="Chroma path" value={statusOutput.chroma_path} />
            <StatCard label="Embedding model" value={statusOutput.embed_model ?? "not reported"} />
            <StatCard label="Ask model" value={statusOutput.ask_model} />
            <StatCard label="Code model" value={statusOutput.code_model} />
            <StatCard label="Ollama backend" value={statusOutput.ollama_backend} />
            <StatCard
              label="Watch mode"
              value={
                statusOutput.watching === true
                  ? "watching for changes"
                  : statusOutput.watching === false
                    ? "not watching"
                    : "not reported"
              }
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white/1.5 px-[18px] pt-4 pb-[18px]">
          <div className="mb-3 text-[11px] font-bold tracking-[0.09em] text-fg-dim uppercase">Indexed files</div>
          {files.length === 0 ? (
            <p className="m-0 text-[12.5px] text-fg-dim italic">nothing indexed yet.</p>
          ) : (
            <div className="flex flex-col">
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

        <section className="rounded-xl border border-border bg-white/1.5 px-[18px] pt-4 pb-[18px]">
          <div className="mb-3 text-[11px] font-bold tracking-[0.09em] text-fg-dim uppercase">Live activity</div>
          <ActivityList events={events} />
        </section>
      </div>
    </div>
  );
}
