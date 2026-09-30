import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { citedRanks } from "@/shared/lib/citedRanks";
import { getBaseName } from "@/shared/lib/path";
import type { SourceDTO } from "@/shared/types/dto";

export function ChatSources({
  sources,
  answer,
  onOpenFile,
}: {
  sources: SourceDTO[];
  answer: string;
  onOpenFile: (filePath: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const cited = citedRanks(answer);

  return (
    <div className="mt-2 whitespace-normal">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-[5px] rounded-[9px] border border-focus bg-transparent py-0.5 pr-[7px] pl-1 font-ui text-[11px] text-fg-dim hover:bg-list-hover hover:text-fg-strong"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Layers size={12} />
        {sources.length} {sources.length === 1 ? "chunk" : "chunks"} used
      </button>

      {expanded && (
        <ul className="m-0 mt-1.5 flex list-none flex-col gap-[3px] p-0">
          {sources.map((source, index) => {
            const rank = index + 1;
            const isCited = cited.has(rank);
            const isPreviewed = previewId === source.id;

            return (
              <li
                key={source.id}
                className={
                  "rounded-md border bg-editor-bg " + (isCited ? "border-accent/60" : "border-border")
                }
              >
                <div className="flex min-w-0 items-center gap-1.5 py-[3px] pr-1 pl-1.5 text-[11px]">
                  <span
                    className={
                      "grid size-4 flex-none place-items-center rounded-full text-[9.5px] " +
                      (isCited ? "bg-accent text-white" : "bg-focus text-fg-strong")
                    }
                  >
                    {rank}
                  </span>
                  <button
                    type="button"
                    className="flex-none cursor-pointer border-none bg-transparent p-0 font-mono text-[11px] text-info hover:underline"
                    title={`Open ${source.file}`}
                    onClick={() => onOpenFile(source.file)}
                  >
                    {getBaseName(source.file)}:{source.start_line}-{source.end_line}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-fg-dim">{source.qualified_name}</span>
                  <button
                    type="button"
                    className="grid size-[18px] flex-none cursor-pointer place-items-center rounded border-none bg-transparent p-0 text-fg-dim hover:bg-list-hover hover:text-fg-strong"
                    aria-label={isPreviewed ? "Hide chunk" : "Show chunk"}
                    onClick={() => setPreviewId(isPreviewed ? null : source.id)}
                  >
                    {isPreviewed ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                </div>
                {isPreviewed && (
                  <pre className="m-0 max-h-[220px] overflow-auto border-t border-border px-2 py-1.5 font-mono text-[11px] leading-normal whitespace-pre">
                    {source.content}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
