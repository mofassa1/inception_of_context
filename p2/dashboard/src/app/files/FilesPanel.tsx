import { useState } from "react";
import { FileCode2, Layers } from "lucide-react";
import { useGetChunksForFile } from "@/shared/hooks/useGetChunksForFile";
import { listStoredChunks } from "@/shared/lib/listStoredChunks";
import { getBaseName } from "@/shared/lib/path";
import type { StoredChunk } from "@/shared/types/chunk";
import { useGetAllFiles } from "./hooks/useGetAllFiles";
import { useReadFile } from "./hooks/useReadFile";

function boundaryMap(chunks: StoredChunk[]): Map<number, StoredChunk[]> {
  const starts = new Map<number, StoredChunk[]>();

  for (const chunk of chunks) {
    const existing = starts.get(chunk.metadata.start_line);
    if (existing) existing.push(chunk);
    else starts.set(chunk.metadata.start_line, [chunk]);
  }

  return starts;
}

function SourceLines({ content, chunks }: { content: string; chunks: StoredChunk[] }) {
  const starts = boundaryMap(chunks);

  return (
    <div className="flex-1 bg-editor-bg pt-2 pb-10 font-mono text-[12px] leading-[1.6]">
      {content.split("\n").map((line, index) => {
        const lineNumber = index + 1;
        const beginning = starts.get(lineNumber);

        return (
          <div
            key={lineNumber}
            className={
              "flex items-baseline gap-2 px-4 whitespace-pre" +
              (beginning ? " border-t border-info/22 bg-info/8" : "")
            }
          >
            <span className="w-3 shrink-0 text-center text-info" aria-hidden="true">
              {beginning ? "▶" : ""}
            </span>
            <span className="w-11 shrink-0 text-right text-fg-dim select-none">{lineNumber}</span>
            <code className="[font-family:inherit] whitespace-pre text-fg">{line || " "}</code>
            {beginning && (
              <span className="ml-auto pl-4 text-[11px] whitespace-nowrap text-info opacity-85">
                {beginning.map((chunk) => chunk.metadata.qualified_name).join(", ")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FilesPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const { filesOutput, isGettingAllFiles, getAllFilesFailed, getAllFilesError } =
    useGetAllFiles();
  const { readFileOutput, isReadingFile, readFileFailed, readFileError } = useReadFile(
    selected ? { path: selected } : null,
  );
  const { chunksForFileOutput, isGettingChunksForFile } = useGetChunksForFile(selected);
  const files = filesOutput?.files ?? [];
  const chunks = chunksForFileOutput ? listStoredChunks(chunksForFileOutput.chunks) : [];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-chrome-bg text-[13px] text-fg" aria-label="Files">
      <header className="shrink-0 border-b border-border px-7 pt-[22px] pb-4">
        <h1 className="m-0 mb-1.5 flex items-center gap-[9px] text-[16px] font-semibold text-fg-strong">
          <FileCode2 size={18} /> Files
        </h1>
        <p className="m-0 max-w-[78ch] leading-[1.55] text-fg-dim">
          Every indexed file and the chunk boundaries the retriever sees. A{" "}
          <span className="font-mono text-info">▶</span> marks where a chunk starts.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-0.5 overflow-y-auto border-r border-border px-2 py-2.5">
          {isGettingAllFiles && <p className="m-0 px-2.5 py-2 text-fg-dim">Loading…</p>}
          {getAllFilesFailed && <p className="m-0 px-7 py-2.5 text-danger">{getAllFilesError?.message}</p>}
          {!isGettingAllFiles && files.length === 0 && (
            <p className="m-0 px-2.5 py-2 text-fg-dim">Nothing indexed yet.</p>
          )}

          {files.map((file) => (
            <button
              key={file.name}
              type="button"
              className={
                "inline-flex w-full shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-[5px] border px-[9px] py-1.5 text-left [font-family:inherit] text-[12px] hover:bg-list-hover hover:text-fg-strong " +
                (file.name === selected
                  ? "border-focus bg-list-hover text-fg-strong"
                  : "border-transparent bg-transparent text-fg")
              }
              onClick={() => setSelected(file.name)}
              title={file.name}
            >
              <span className="truncate">{getBaseName(file.name)}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-fg-dim">
                <Layers size={11} /> {file.chunks}
              </span>
            </button>
          ))}
        </aside>

        <div className="flex min-w-0 flex-col overflow-auto">
          {!selected && <p className="px-6 py-5 text-fg-dim">Select a file to see its chunks.</p>}
          {selected && (isReadingFile || isGettingChunksForFile) && (
            <p className="px-6 py-5 text-fg-dim">Loading source…</p>
          )}
          {readFileFailed && <p className="m-0 px-7 py-2.5 text-danger">{readFileError?.message}</p>}
          {readFileOutput && chunksForFileOutput && (
            <>
              <div className="sticky top-0 z-1 flex items-baseline justify-between gap-4 border-b border-border bg-chrome-bg px-5 py-3">
                <code className="truncate font-mono text-[12px] text-fg-strong">{readFileOutput.path}</code>
                <span className="shrink-0 text-[11px] text-fg-dim">
                  {readFileOutput.content.split("\n").length} lines · {chunks.length} chunks
                </span>
              </div>
              <SourceLines content={readFileOutput.content} chunks={chunks} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
