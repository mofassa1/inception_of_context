import { useState } from "react";
import { ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";
import { citedRanks } from "@/shared/lib/citedRanks";
import { Markdown } from "@/shared/components/Markdown";
import { getBaseName } from "@/shared/lib/path";
import { withoutCitationLine } from "@/shared/lib/withoutCitationLine";
import { useAsk } from "@/shared/hooks/useAsk";
import type { AnswerSourceDTO } from "@/shared/types/dto";
import { useRetrieveSources } from "./hooks/useRetrieveSources";

const K_CHOICES = [1, 3, 5, 8, 10, 15, 20];

type ResultMode = "retrieve" | "ask" | null;

function AnswerSourceRow({ source, cited }: { source: AnswerSourceDTO; cited: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-1.5">
      <button
        type="button"
        className={
          "inline-flex w-full cursor-pointer items-center gap-1.5 rounded-md border bg-input-bg px-3 py-[7px] text-left [font:inherit] text-fg hover:bg-list-hover hover:text-fg-strong " +
          (cited ? "border-accent" : "border-border")
        }
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={"grid size-5 shrink-0 place-items-center rounded-full text-[10px] " + (cited ? "bg-accent text-white" : "bg-focus text-fg-strong")}>
          {source.rank}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <code className="truncate font-mono text-[12px] text-fg-strong" title={source.file}>
            {getBaseName(source.file)}
          </code>
          <span className="truncate text-[11px] text-fg-dim">
            lines {source.start_line}-{source.end_line} · {source.kind}{" "}
            {source.qualified_name}
          </span>
        </div>
        {cited && (
          <span className="shrink-0 rounded-full bg-accent/22 px-1.5 py-px text-[10px] text-fg-strong">cited</span>
        )}
        <span className="shrink-0 font-mono text-[11px] text-info" title="cosine distance — lower is closer">
          {source.score.toFixed(3)}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && (
        <pre
          className="m-0 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap [word-break:break-word] mt-1 max-h-[320px] overflow-auto rounded-md border border-border bg-editor-bg px-3 py-2.5"
        >
          {source.content}
        </pre>
      )}
    </div>
  );
}

export function AskPanel() {
  const [query, setQuery] = useState("");
  const [k, setK] = useState(5);
  const [answer, setAnswer] = useState("");
  const [answerSources, setAnswerSources] = useState<AnswerSourceDTO[]>([]);
  const [mode, setMode] = useState<ResultMode>(null);

  const {
    retrieveSources,
    retrieveOutput,
    isRetrievingSources,
    retrieveSourcesFailed,
    retrieveSourcesError,
  } = useRetrieveSources();

  const { ask, isAsking, askFailed, askError } = useAsk();

  const retrievedSources = retrieveOutput ?? [];

  const busy = isRetrievingSources || isAsking;
  const canSubmit = query.trim().length > 0 && !busy;
  const cited = citedRanks(answer);

  function handleRetrieve() {
    if (!canSubmit) return;
    setMode("retrieve");
    setAnswer("");
    retrieveSources({ query, k }).catch(() => undefined);
  }

  function handleAsk() {
    if (!canSubmit) return;
    setMode("ask");
    setAnswer("");
    setAnswerSources([]);
    ask({
      body: { query, k },
      onSources: setAnswerSources,
      onToken: (text) => setAnswer((prior) => prior + text),
    }).catch(() => undefined);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-chrome-bg text-[13px] text-fg" aria-label="Ask and Retrieve">
      <header className="shrink-0 border-b border-border px-7 pt-[22px] pb-4">
        <h1 className="m-0 mb-1.5 flex items-center gap-[9px] text-[16px] font-semibold text-fg-strong">
          <Sparkles size={18} /> Ask &amp; Retrieve
        </h1>
        <p className="m-0 max-w-[78ch] leading-[1.55] text-fg-dim">
          Retrieve shows the top-k chunks and their similarity scores with no
          model involved. Ask LLM answers from its own top-k chunks and lists
          exactly which ones it was given.
        </p>
      </header>

      <form
        className="flex shrink-0 flex-col gap-3 border-b border-border px-7 py-[18px]"
        onSubmit={(event) => {
          event.preventDefault();
          handleAsk();
        }}
      >
        <textarea
          className="rounded-md border border-border bg-input-bg px-[11px] py-[9px] [font-family:inherit] text-[13px] text-fg-strong focus:border-cursor focus:outline-none w-full resize-y leading-normal"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="What does the note service do when the title is blank?"
          rows={3}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2">
            <span className="font-mono text-[13px] text-fg-strong">k</span>
            <select
              className="min-w-16 rounded-md border border-border bg-input-bg px-2 py-1.5 [font-family:inherit] text-[13px] text-fg-strong focus:border-cursor focus:outline-none"
              value={k}
              onChange={(event) => setK(Number(event.target.value))}
            >
              {K_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
            <small className="text-[11px] text-fg-dim">chunks retrieved</small>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-input-bg px-3 py-[7px] [font-family:inherit] text-[12px] text-fg enabled:hover:bg-list-hover enabled:hover:text-fg-strong disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleRetrieve}
              disabled={!canSubmit}
            >
              <Search size={14} /> {isRetrievingSources ? "Retrieving…" : "Retrieve"}
            </button>
            <button type="submit" className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-[7px] [font-family:inherit] text-[12px] text-white enabled:hover:border-cursor enabled:hover:bg-cursor disabled:cursor-not-allowed disabled:opacity-45" disabled={!canSubmit}>
              <Sparkles size={14} /> {isAsking ? "Answering…" : "Ask LLM"}
            </button>
          </div>
        </div>
      </form>

      {retrieveSourcesFailed && <p className="m-0 px-7 py-2.5 text-danger">{retrieveSourcesError?.message}</p>}
      {askFailed && <p className="m-0 px-7 py-2.5 text-danger">{askError?.message}</p>}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-y-auto border-r border-border px-6 pt-[18px] pb-10">
          {mode === "ask" ? (
            <>
              <h2 className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.07em] text-fg-dim uppercase">Chunks the answer used</h2>
              {answerSources.length === 0 && (
                <p className="text-fg-dim">{isAsking ? "Retrieving…" : "No chunks retrieved."}</p>
              )}
              {answerSources.map((source) => (
                <AnswerSourceRow
                  key={source.id}
                  source={source}
                  cited={cited.has(source.rank)}
                />
              ))}
            </>
          ) : (
            <>
              <h2 className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.07em] text-fg-dim uppercase">Retrieved context</h2>
              {retrievedSources.length === 0 && !isRetrievingSources && (
                <p className="text-fg-dim">Nothing retrieved yet.</p>
              )}
              {retrievedSources.map((source, index) => (
                <div
                  key={`${source.file}-${source.line}-${index}`}
                  className="mb-1.5 flex items-center gap-2.5 rounded-md border border-border bg-editor-bg px-2.5 py-2"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] bg-focus text-fg-strong">{index + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <code className="truncate font-mono text-[12px] text-fg-strong" title={source.file}>
            {getBaseName(source.file)}
          </code>
                    <span className="truncate text-[11px] text-fg-dim">
                      line {source.line}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-info" title="cosine distance — lower is closer">
                    {source.score.toFixed(3)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="min-w-0 overflow-y-auto px-6 pt-[18px] pb-10">
          <h2 className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.07em] text-fg-dim uppercase">Answer</h2>
          {!answer && !isAsking && <p className="text-fg-dim">Ask to see an answer.</p>}
          {answer && <Markdown text={withoutCitationLine(answer)} />}
          {isAsking && !answer && <p className="text-fg-dim">Thinking…</p>}
        </div>
      </div>
    </section>
  );
}
