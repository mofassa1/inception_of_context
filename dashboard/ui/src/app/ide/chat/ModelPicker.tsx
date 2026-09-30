import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CircleAlert, Download, Loader2 } from "lucide-react";
import type { ChatMode } from "@/shared/types/chat";
import type { ModelChoiceDTO } from "@/shared/types/dto";
import { useGetModels } from "./hooks/useGetModels";
import { usePullModel } from "./hooks/usePullModel";
import { useSetModels } from "./hooks/useSetModels";

const MODE_FIELDS = {
  ask: "ask_model",
  agent: "code_model",
} as const;

const MODE_HINTS = {
  ask: "Model that answers questions",
  agent: "Model that writes patches",
} as const;

const NO_CHOICES: ModelChoiceDTO[] = [];

export function ModelPicker({
  mode,
  disabled,
}: {
  mode: ChatMode;
  disabled: boolean;
}) {
  const { modelsOutput, isGettingModels } = useGetModels();
  const { setModels, isSettingModels, setModelsError } = useSetModels();
  const { pullModel, pullModelError } = usePullModel();
  const [isOpen, setIsOpen] = useState(false);
  const [pullingName, setPullingName] = useState("");
  const [pulledRatio, setPulledRatio] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const field = MODE_FIELDS[mode];
  const currentName = modelsOutput ? modelsOutput[field] : "";
  const choices = modelsOutput?.models ?? NO_CHOICES;
  const isBusy = isSettingModels || pullingName !== "";
  const failure = pullModelError ?? setModelsError;

  async function choose(choice: ModelChoiceDTO) {
    if (isBusy) return;

    if (!choice.installed) {
      setPullingName(choice.name);
      setPulledRatio(0);
      try {
        await pullModel({
          name: choice.name,
          onProgress: (ratio) => setPulledRatio(ratio),
        });
      } catch {
        setPullingName("");
        return;
      }
      setPullingName("");
    }

    if (choice.name !== currentName) {
      await setModels(
        field === "ask_model"
          ? { ask_model: choice.name }
          : { code_model: choice.name },
      );
    }
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-none">
      <button
        type="button"
        title={MODE_HINTS[mode]}
        disabled={disabled || isGettingModels}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="inline-flex max-w-[190px] cursor-pointer items-center gap-1 rounded-md border-none bg-chrome-bg px-2 py-[3px] [font:inherit] text-[10.5px] text-fg-dim transition-colors duration-120 enabled:hover:text-fg disabled:cursor-default disabled:opacity-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isBusy ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <ChevronDown size={11} />
        )}
        <span className="truncate">
          {pullingName !== ""
            ? `${pullingName} ${Math.round(pulledRatio * 100)}%`
            : currentName || "no model"}
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 bottom-[calc(100%+4px)] z-20 w-[236px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[6px] border border-border bg-chrome-bg shadow-menu"
        >
          <div className="border-b border-border px-2.5 py-1.5 text-[9.5px] tracking-wide text-fg-dim uppercase">
            {MODE_HINTS[mode]}
          </div>

          {choices.map((choice) => (
            <button
              key={choice.name}
              type="button"
              role="option"
              aria-selected={choice.name === currentName}
              disabled={isBusy}
              className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-2.5 py-[5px] text-left [font:inherit] text-[11px] text-fg transition-colors duration-120 enabled:hover:bg-list-hover disabled:cursor-default disabled:opacity-60"
              onClick={() => choose(choice)}
            >
              <span className="grid size-3 flex-none place-items-center">
                {choice.name === currentName && <Check size={11} />}
                {!choice.installed && pullingName !== choice.name && (
                  <Download size={11} className="text-fg-dim" />
                )}
                {pullingName === choice.name && (
                  <Loader2 size={11} className="animate-spin" />
                )}
              </span>

              <span className="min-w-0 flex-1 truncate">{choice.name}</span>

              <span className="flex-none text-[9.5px] text-fg-dim">
                {pullingName === choice.name
                  ? `${Math.round(pulledRatio * 100)}%`
                  : choice.installed
                    ? choice.ram_gib
                      ? `${choice.ram_gib.toFixed(1)} GiB RAM`
                      : "installed"
                    : `pull ${choice.download_gib?.toFixed(1)} GiB`}
              </span>
            </button>
          ))}

          {pullingName !== "" && (
            <div className="h-[3px] w-full bg-focus">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${Math.round(pulledRatio * 100)}%` }}
              />
            </div>
          )}

          {failure && (
            <div className="flex items-start gap-1.5 border-t border-border px-2.5 py-1.5 text-[10px] text-danger">
              <CircleAlert size={11} className="mt-px flex-none" />
              <span className="min-w-0 break-words">{failure.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
