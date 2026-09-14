import { useState } from "react";
import { ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";
import { citedRanks } from "@/shared/lib/citedRanks";
import { Markdown } from "@/shared/components/Markdown";
import { getBaseName } from "@/shared/lib/path";
import { withoutCitationLine } from "@/shared/lib/withoutCitationLine";
import type { AnswerSource } from "@/shared/types/agent";
import { useAskLlm } from "./hooks/useAskLlm";
import { useRetrieveContext } from "./hooks/useRetrieveContext";
import "./ask.css";

const K_CHOICES = [1, 3, 5, 8, 10, 15, 20];

type ResultMode = "retrieve" | "ask" | null;

function AnswerSourceRow({ source, cited }: { source: AnswerSource; cited: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={"ask-source-block" + (cited ? " cited" : "")}>
      <button
        type="button"
        className="ask-source"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="ask-rank">{source.rank}</span>
        <div className="ask-source-body">
          <code title={source.file}>{getBaseName(source.file)}</code>
          <span className="ask-source-meta">
            lines {source.startLine}-{source.endLine} · {source.kind}{" "}
            {source.qualifiedName}
          </span>
        </div>
        {cited && <span className="ask-cited">cited</span>}
        <span className="ask-score" title="cosine distance — lower is closer">
          {source.distance.toFixed(3)}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && <pre className="ask-source-content">{source.content}</pre>}
    </div>
  );
}

export function AskPanel() {
  const [query, setQuery] = useState("");
  const [k, setK] = useState(5);
  const [answer, setAnswer] = useState("");
  const [answerSources, setAnswerSources] = useState<AnswerSource[]>([]);
  const [mode, setMode] = useState<ResultMode>(null);

  const {
    retrieveContext,
    sources: retrievedSources,
    isPending: retrieving,
    isError: retrieveFailed,
    error: retrieveError,
  } = useRetrieveContext();

  const {
    askLlm,
    isPending: asking,
    isError: askFailed,
    error: askError,
  } = useAskLlm();

  const busy = retrieving || asking;
  const canSubmit = query.trim().length > 0 && !busy;
  const cited = citedRanks(answer);

  function handleRetrieve() {
    if (!canSubmit) return;
    setMode("retrieve");
    setAnswer("");
    retrieveContext({ query, k }).catch(() => undefined);
  }

  function handleAsk() {
    if (!canSubmit) return;
    setMode("ask");
    setAnswer("");
    setAnswerSources([]);
    askLlm({
      query,
      k,
      onSources: setAnswerSources,
      onToken: (text) => setAnswer((prior) => prior + text),
    }).catch(() => undefined);
  }

  return (
    <section className="panel ask-panel" aria-label="Ask and Retrieve">
      <header className="panel-header">
        <h1>
          <Sparkles size={18} /> Ask &amp; Retrieve
        </h1>
        <p>
          Retrieve shows the top-k chunks and their similarity scores with no
          model involved. Ask LLM answers from its own top-k chunks and lists
          exactly which ones it was given.
        </p>
      </header>

      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleAsk();
        }}
      >
        <textarea
          className="ask-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="What does the note service do when the title is blank?"
          rows={3}
        />

        <div className="ask-controls">
          <label className="ask-k">
            <span>k</span>
            <select
              value={k}
              onChange={(event) => setK(Number(event.target.value))}
            >
              {K_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
            <small>chunks retrieved</small>
          </label>

          <div className="ask-actions">
            <button
              type="button"
              className="ask-button"
              onClick={handleRetrieve}
              disabled={!canSubmit}
            >
              <Search size={14} /> {retrieving ? "Retrieving…" : "Retrieve"}
            </button>
            <button type="submit" className="ask-button primary" disabled={!canSubmit}>
              <Sparkles size={14} /> {asking ? "Answering…" : "Ask LLM"}
            </button>
          </div>
        </div>
      </form>

      {retrieveFailed && <p className="error">{retrieveError?.message}</p>}
      {askFailed && <p className="error">{askError?.message}</p>}

      <div className="ask-results">
        <div className="ask-sources">
          {mode === "ask" ? (
            <>
              <h2>Chunks the answer used</h2>
              {answerSources.length === 0 && (
                <p className="muted">{asking ? "Retrieving…" : "No chunks retrieved."}</p>
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
              <h2>Retrieved context</h2>
              {retrievedSources.length === 0 && !retrieving && (
                <p className="muted">Nothing retrieved yet.</p>
              )}
              {retrievedSources.map((source, index) => (
                <div key={`${source.file}-${source.line}-${index}`} className="ask-source">
                  <span className="ask-rank">{index + 1}</span>
                  <div className="ask-source-body">
                    <code title={source.file}>{getBaseName(source.file)}</code>
                    <span className="ask-source-meta">
                      line {source.line} · {source.kind} {source.qualifiedName}
                    </span>
                  </div>
                  <span className="ask-score" title="cosine distance — lower is closer">
                    {source.distance.toFixed(3)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="ask-answer">
          <h2>Answer</h2>
          {!answer && !asking && <p className="muted">Ask to see an answer.</p>}
          {answer && <Markdown text={withoutCitationLine(answer)} />}
          {asking && !answer && <p className="muted">Thinking…</p>}
        </div>
      </div>
    </section>
  );
}
