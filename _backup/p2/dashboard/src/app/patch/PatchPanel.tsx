import { useState } from "react";
import { CircleCheck, CircleX, Undo2, Wrench } from "lucide-react";
import type { PatchAttempt } from "@/shared/types/agent";
import { usePatchLoop } from "./hooks/usePatchLoop";
import "./patch.css";

function AttemptCard({ attempt }: { attempt: PatchAttempt }) {
  const rejected = attempt.sanity.code !== 0;
  const state = attempt.validationPassed
    ? "passed"
    : rejected
      ? "rejected"
      : "failed";

  return (
    <article className={"patch-attempt " + state}>
      <header>
        <span className="patch-attempt-number">Attempt {attempt.number}</span>
        <span className="patch-attempt-state">
          {attempt.validationPassed && <CircleCheck size={13} />}
          {!attempt.validationPassed && <CircleX size={13} />}
          {rejected
            ? `rejected by sanity check ${attempt.sanity.code}`
            : attempt.validationPassed
              ? "validation passed"
              : "validation failed"}
        </span>
      </header>

      <p className="patch-attempt-summary">{attempt.summary}</p>

      {rejected && <p className="patch-attempt-reason">{attempt.sanity.message}</p>}

      {attempt.files.length > 0 && (
        <ul className="patch-attempt-files">
          {attempt.files.map((file) => (
            <li key={file.path}>
              <span className={"patch-op " + file.op}>{file.op}</span>
              <code>{file.path}</code>
            </li>
          ))}
        </ul>
      )}

      {attempt.validationOutput && (
        <pre className="patch-attempt-output">{attempt.validationOutput}</pre>
      )}
    </article>
  );
}

export function PatchPanel({ root }: { root: string | null }) {
  const [query, setQuery] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const { runPatchLoop, result, isPending, isError, error } = usePatchLoop();

  const canSubmit = query.trim().length > 0 && !isPending;
  const finalAttempt = result?.attempts[result.attempts.length - 1] ?? null;

  return (
    <section className="panel patch-panel" aria-label="Patch Loop">
      <header className="panel-header">
        <h1>
          <Wrench size={18} /> Patch Loop
        </h1>
        <p>
          Propose, apply, then run the validation command from{" "}
          <code>ioc.config.yml</code>. Up to three attempts; if none pass, every
          touched file is restored to its pre-loop state.
        </p>
      </header>

      <form
        className="patch-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          runPatchLoop({
            query,
            k: 8,
            targetPath: targetPath.trim() || root,
          }).catch(() => undefined);
        }}
      >
        <textarea
          className="patch-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Add a rename method to NoteService and cover it with a test."
          rows={3}
        />

        <div className="patch-controls">
          <label className="patch-target">
            <span>Target project</span>
            <input
              value={targetPath}
              onChange={(event) => setTargetPath(event.target.value)}
              placeholder={root ?? "the indexed project"}
            />
          </label>

          <button type="submit" className="patch-button" disabled={!canSubmit}>
            <Wrench size={14} /> {isPending ? "Running loop…" : "Run patch loop"}
          </button>
        </div>
      </form>

      {isError && <p className="error">{error?.message}</p>}
      {isPending && (
        <p className="muted">
          Running up to three attempts — each one proposes, applies and validates.
        </p>
      )}

      {result && (
        <div className="patch-result">
          <div
            className={
              "patch-verdict " + (result.succeeded ? "succeeded" : "rolled-back")
            }
          >
            {result.succeeded ? <CircleCheck size={16} /> : <Undo2 size={16} />}
            <div>
              <strong>
                {result.succeeded
                  ? "Validation passed"
                  : result.rolledBack
                    ? "Rolled back to the pre-loop state"
                    : "Gave up without applying anything"}
              </strong>
              <p>{result.summary}</p>
            </div>
          </div>

          {result.filesTouched.length > 0 && (
            <div className="patch-touched">
              <h2>{result.rolledBack ? "Files restored" : "Files changed"}</h2>
              <ul>
                {result.filesTouched.map((path) => (
                  <li key={path}>
                    <code>{path}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {finalAttempt && (
            <div className="patch-json">
              <h2>Final patch (JSON)</h2>
              <pre>
                {JSON.stringify(
                  { summary: finalAttempt.summary, files: finalAttempt.files },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}

          <div className="patch-attempts">
            <h2>Attempts</h2>
            {result.attempts.map((attempt) => (
              <AttemptCard key={attempt.number} attempt={attempt} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
