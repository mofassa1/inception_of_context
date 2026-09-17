import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { AUTOSAVE_DELAY_MS } from "@/shared/constants/config";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import type { WriteFileInputDTO, WriteFileOutputDTO } from "@/shared/types/dto";

type WriteFileOptions = {
  onWriteStarted: (path: string) => void;
  onWriteSucceeded: (path: string) => void;
  onWriteFailed: (path: string, message: string) => void;
};

export function useWriteFile({
  onWriteStarted,
  onWriteSucceeded,
  onWriteFailed,
}: WriteFileOptions) {
  const { mutate, error, isPending, isError } = useMutation({
    mutationFn: (body: WriteFileInputDTO) =>
      api.put<WriteFileOutputDTO>(ENDPOINTS.WRITE_FILE, body),
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBodyRef = useRef<WriteFileInputDTO | null>(null);

  const callbacksRef = useRef({ onWriteStarted, onWriteSucceeded, onWriteFailed });
  callbacksRef.current = { onWriteStarted, onWriteSucceeded, onWriteFailed };

  function writeFileNow(body: WriteFileInputDTO) {
    callbacksRef.current.onWriteStarted(body.path);

    mutate(body, {
      onSuccess: () => callbacksRef.current.onWriteSucceeded(body.path),
      onError: (writeError) =>
        callbacksRef.current.onWriteFailed(body.path, (writeError as Error).message),
    });
  }

  function scheduleWriteFile(body: WriteFileInputDTO) {
    pendingBodyRef.current = body;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pendingBody = pendingBodyRef.current;
      pendingBodyRef.current = null;
      if (pendingBody) writeFileNow(pendingBody);
    }, AUTOSAVE_DELAY_MS);
  }

  function flushWriteFile() {
    if (!timerRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;

    const pendingBody = pendingBodyRef.current;
    pendingBodyRef.current = null;
    if (pendingBody) writeFileNow(pendingBody);
  }

  const flushWriteFileRef = useRef(flushWriteFile);
  flushWriteFileRef.current = flushWriteFile;

  useEffect(() => {
    function handleBeforeUnload() {
      flushWriteFileRef.current();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return {
    scheduleWriteFile,
    flushWriteFile,
    isWritingFile: isPending,
    writeFileFailed: isError,
    writeFileError: error,
  };
}
