import { useState } from "react";
import { CircleCheck, CircleX, Undo2, Wrench } from "lucide-react";
import type { PatchAttemptDTO } from "@/shared/types/dto";
import { PATCH_LOOP_CONTEXT_CHUNKS } from "@/shared/constants/config";
import { useRunPatchLoop } from "@/shared/hooks/useRunPatchLoop";

const OP_COLORS: Record<PatchAttemptDTO["files"][number]["op"], string> = {
  create: "bg-ok/22 text-ok",
  modify: "bg-info/22 text-info",
  delete: "bg-danger/22 text-danger",
};

function AttemptCard({ attempt }: { attempt: PatchAttemptDTO }) {
  const rejected = attempt.sanity.code !== 0;

  return (
    <article
      className={
        "flex flex-col gap-2 rounded-[7px] border border-l-[3px] border-border bg-editor-bg px-3.5 py-3 " +
        (attempt.validation_passed ? "border-l-ok" : "border-l-danger")
      }
    >
      <header className="flex items-center justify-between gap-3">
        <span className="font-semibold text-fg-strong">Attempt {attempt.number}</span>
        <span
          className={
            "inline-flex items-center gap-[5px] text-[11px] " +
            (attempt.validation_passed ? "text-ok" : "text-danger")
          }
        >
          {attempt.validation_passed && <CircleCheck size={13} />}
          {!attempt.validation_passed && <CircleX size={13} />}
          {rejected
            ? `rejected by sanity check ${attempt.sanity.code}`
            : attempt.validation_passed
              ? "validation passed"
              : "validation failed"}
        </span>
      </header>

      <p className="m-0 leading-normal">{attempt.summary}</p>

      {rejected && <p className="m-0 text-[12px] leading-normal text-danger">{attempt.sanity.message}</p>}

      {attempt.files.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {attempt.files.map((file) => (
            <li key={file.path} className="flex items-baseline gap-2">
              <span
                className={
                  "shrink-0 rounded-[3px] px-1.5 py-px text-[10px] tracking-[0.05em] uppercase " +
                  OP_COLORS[file.op]
                }
              >
                {file.op}
              </span>
              <code className="font-mono text-[12px] break-all text-fg-strong">{file.path}</code>
            </li>
          ))}
        </ul>
      )}

      {attempt.validation_output && (
        <pre className="m-0 font-mono text-[12px] leading-[1.55] max-h-[260px] overflow-auto rounded-md bg-chrome-bg px-3 py-2.5 whitespace-pre-wrap text-fg-dim [word-break:break-word]">{attempt.validation_output}</pre>
      )}
    </article>
  );
}

export function PatchPanel({ root }: { root: string | null }) {
  const [query, setQuery] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const {
    runPatchLoop,
    patchLoopOutput,
    isRunningPatchLoop,
    runPatchLoopFailed,
    runPatchLoopError,
  } = useRunPatchLoop();

  const canSubmit = query.trim().length > 0 && !isRunningPatchLoop;
  const finalAttempt = patchLoopOutput?.attempts[patchLoopOutput.attempts.length - 1] ?? null;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-chrome-bg text-[13px] text-fg" aria-label="Patch Loop">
      <header className="shrink-0 border-b border-border px-7 pt-[22px] pb-4">
        <h1 className="m-0 mb-1.5 flex items-center gap-[9px] text-[16px] font-semibold text-fg-strong">
          <Wrench size={18} /> Patch Loop
        </h1>
        <p className="m-0 max-w-[78ch] leading-[1.55] text-fg-dim">
          Propose, apply, then run the validation command from{" "}
          <code className="font-mono text-[12px] text-info">ioc.config.yml</code>. Up to three attempts; if none pass, every
          touched file is restored to its pre-loop state.
        </p>
      </header>

      <form
        className="flex shrink-0 flex-col gap-3 border-b border-border px-7 py-[18px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          runPatchLoop({
            query,
            k: PATCH_LOOP_CONTEXT_CHUNKS,
            targetPath: targetPath.trim() || root,
          }).catch(() => undefined);
        }}
      >
        <textarea
          className="rounded-md border border-border bg-input-bg px-[11px] py-[9px] [font-family:inherit] text-[13px] text-fg-strong focus:border-cursor focus:outline-none resize-y leading-normal"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Add a rename method to NoteService and cover it with a test."
          rows={3}
        />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="flex max-w-[460px] min-w-[240px] flex-1 flex-col gap-[5px]">
            <span className="text-[11px] tracking-[0.05em] text-fg-dim uppercase">Target project</span>
            <input
              className="rounded-md border border-border bg-input-bg px-[11px] py-[9px] [font-family:inherit] text-[13px] text-fg-strong focus:border-cursor focus:outline-none"
              value={targetPath}
              onChange={(event) => setTargetPath(event.target.value)}
              placeholder={root ?? "the indexed project"}
            />
          </label>

          <button type="submit" className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-accent bg-accent px-4 py-[9px] [font-family:inherit] text-[12px] text-white enabled:hover:border-cursor enabled:hover:bg-cursor disabled:cursor-not-allowed disabled:opacity-45" disabled={!canSubmit}>
            <Wrench size={14} /> {isRunningPatchLoop ? "Running loop…" : "Run patch loop"}
          </button>
        </div>
      </form>

      {runPatchLoopFailed && <p className="m-0 px-7 py-2.5 text-danger">{runPatchLoopError?.message}</p>}
      {isRunningPatchLoop && (
        <p className="m-0 px-7 py-3 text-fg-dim">
          Running up to three attempts — each one proposes, applies and validates.
        </p>
      )}

      {patchLoopOutput && (
        <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-7 pt-[18px] pb-12">
          <div
            className={
              "flex gap-3 rounded-lg border bg-editor-bg px-4 py-3.5 " +
              (patchLoopOutput.succeeded ? "border-ok/50 text-ok" : "border-danger/50 text-danger")
            }
          >
            {patchLoopOutput.succeeded ? <CircleCheck size={16} /> : <Undo2 size={16} />}
            <div>
              <strong className="mb-[3px] block">
                {patchLoopOutput.succeeded
                  ? "Validation passed"
                  : patchLoopOutput.rolled_back
                    ? "Rolled back to the pre-loop state"
                    : "Gave up without applying anything"}
              </strong>
              <p className="m-0 text-fg">{patchLoopOutput.summary}</p>
            </div>
          </div>

          {patchLoopOutput.files_touched.length > 0 && (
            <div>
              <h2 className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.07em] text-fg-dim uppercase">{patchLoopOutput.rolled_back ? "Files restored" : "Files changed"}</h2>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {patchLoopOutput.files_touched.map((path) => (
                  <li key={path}>
                    <code className="font-mono text-[12px] break-all text-fg-strong">{path}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {finalAttempt && (
            <div>
              <h2 className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.07em] text-fg-dim uppercase">Final patch (JSON)</h2>
              <pre className="m-0 font-mono text-[12px] leading-[1.55] max-h-[360px] overflow-auto rounded-[7px] border border-border bg-editor-bg px-3.5 py-3 whitespace-pre">
                {JSON.stringify(
                  { summary: finalAttempt.summary, files: finalAttempt.files },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <h2 className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.07em] text-fg-dim uppercase">Attempts</h2>
            {patchLoopOutput.attempts.map((attempt) => (
              <AttemptCard key={attempt.number} attempt={attempt} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
