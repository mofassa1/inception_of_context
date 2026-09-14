import { useState } from "react";
import { FileCode2, Layers } from "lucide-react";
import { getBaseName } from "@/shared/lib/path";
import type { FileChunk } from "@/shared/types/agent";
import { useFileSource } from "./hooks/useFileSource";
import { useIndexedFiles } from "./hooks/useIndexedFiles";
import "./files.css";

function boundaryMap(chunks: FileChunk[]): Map<number, FileChunk[]> {
  const starts = new Map<number, FileChunk[]>();

  for (const chunk of chunks) {
    const existing = starts.get(chunk.startLine);
    if (existing) existing.push(chunk);
    else starts.set(chunk.startLine, [chunk]);
  }

  return starts;
}

function SourceLines({ content, chunks }: { content: string; chunks: FileChunk[] }) {
  const starts = boundaryMap(chunks);

  return (
    <div className="files-source">
      {content.split("\n").map((line, index) => {
        const lineNumber = index + 1;
        const beginning = starts.get(lineNumber);

        return (
          <div
            key={lineNumber}
            className={"files-line" + (beginning ? " boundary" : "")}
          >
            <span className="files-gutter" aria-hidden="true">
              {beginning ? "▶" : ""}
            </span>
            <span className="files-lineno">{lineNumber}</span>
            <code className="files-code">{line || " "}</code>
            {beginning && (
              <span className="files-chunk-label">
                {beginning.map((chunk) => chunk.qualifiedName).join(", ")}
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
  const { files, isLoading, isError, error } = useIndexedFiles();
  const { source, isLoading: loadingSource } = useFileSource(selected);

  return (
    <section className="panel files-panel" aria-label="Files">
      <header className="panel-header">
        <h1>
          <FileCode2 size={18} /> Files
        </h1>
        <p>
          Every indexed file and the chunk boundaries the retriever sees. A{" "}
          <span className="files-marker">▶</span> marks where a chunk starts.
        </p>
      </header>

      <div className="files-body">
        <aside className="files-list">
          {isLoading && <p className="muted">Loading…</p>}
          {isError && <p className="error">{error?.message}</p>}
          {!isLoading && files.length === 0 && (
            <p className="muted">Nothing indexed yet.</p>
          )}

          {files.map((file) => (
            <button
              key={file.name}
              type="button"
              className={"files-item" + (file.name === selected ? " active" : "")}
              onClick={() => setSelected(file.name)}
              title={file.name}
            >
              <span className="files-item-name">{getBaseName(file.name)}</span>
              <span className="files-item-count">
                <Layers size={11} /> {file.chunks}
              </span>
            </button>
          ))}
        </aside>

        <div className="files-viewer">
          {!selected && <p className="muted">Select a file to see its chunks.</p>}
          {selected && loadingSource && <p className="muted">Loading source…</p>}
          {source && (
            <>
              <div className="files-viewer-head">
                <code>{source.path}</code>
                <span>
                  {source.lines} lines · {source.chunks.length} chunks
                </span>
              </div>
              <SourceLines content={source.content} chunks={source.chunks} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
