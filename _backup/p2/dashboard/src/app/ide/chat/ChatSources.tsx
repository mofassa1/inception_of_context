import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { citedRanks } from "@/shared/lib/citedRanks";
import { getBaseName } from "@/shared/lib/path";
import type { AnswerSource } from "@/shared/types/agent";

export function ChatSources({
  sources,
  answer,
  onOpenFile,
}: {
  sources: AnswerSource[];
  answer: string;
  onOpenFile: (filePath: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const cited = citedRanks(answer);

  return (
    <div className="chat-sources">
      <button
        type="button"
        className="chat-sources-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Layers size={12} />
        {sources.length} {sources.length === 1 ? "chunk" : "chunks"} used
      </button>

      {expanded && (
        <ul className="chat-sources-list">
          {sources.map((source) => {
            const isCited = cited.has(source.rank);
            const isPreviewed = previewId === source.id;

            return (
              <li
                key={source.id}
                className={"chat-source" + (isCited ? " cited" : "")}
              >
                <div className="chat-source-row">
                  <span className="chat-source-rank">{source.rank}</span>
                  <button
                    type="button"
                    className="chat-source-file"
                    title={`Open ${source.file}`}
                    onClick={() => onOpenFile(source.file)}
                  >
                    {getBaseName(source.file)}:{source.startLine}-{source.endLine}
                  </button>
                  <span className="chat-source-symbol">{source.qualifiedName}</span>
                  <button
                    type="button"
                    className="chat-source-preview"
                    aria-label={isPreviewed ? "Hide chunk" : "Show chunk"}
                    onClick={() => setPreviewId(isPreviewed ? null : source.id)}
                  >
                    {isPreviewed ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                </div>
                {isPreviewed && (
                  <pre className="chat-source-content">{source.content}</pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
