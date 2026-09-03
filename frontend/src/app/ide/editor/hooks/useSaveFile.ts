import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { AUTOSAVE_DELAY_MS } from "@/shared/constants/config";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { WriteFileInput, WriteResult } from "@/shared/types/filesystem";

type SaveFileOptions = {
  onSaving: (filePath: string) => void;
  onSaved: (filePath: string) => void;
  onSaveFailed: (filePath: string, message: string) => void;
};

export function useSaveFile({
  onSaving,
  onSaved,
  onSaveFailed,
}: SaveFileOptions) {
  const { mutate, error, isPending, isSuccess, isError, reset } = useMutation({
    mutationFn: ({ filePath, content }: WriteFileInput) =>
      api.put<WriteResult>(ENDPOINTS.FILES_WRITE, {
        path: filePath,
        content,
      }),
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<WriteFileInput | null>(null);

  const callbacksRef = useRef({ onSaving, onSaved, onSaveFailed });
  callbacksRef.current = { onSaving, onSaved, onSaveFailed };

  function saveNow(input: WriteFileInput) {
    callbacksRef.current.onSaving(input.filePath);

    mutate(input, {
      onSuccess: () => callbacksRef.current.onSaved(input.filePath),
      onError: (saveError) =>
        callbacksRef.current.onSaveFailed(
          input.filePath,
          (saveError as Error).message,
        ),
    });
  }

  function scheduleSave(filePath: string, content: string) {
    pendingRef.current = { filePath, content };

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) saveNow(pending);
    }, AUTOSAVE_DELAY_MS);
  }

  function flushSave() {
    if (!timerRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;

    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) saveNow(pending);
  }

  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  useEffect(() => {
    function handleBeforeUnload() {
      flushSaveRef.current();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return { scheduleSave, flushSave, error, isPending, isSuccess, isError, reset };
}
