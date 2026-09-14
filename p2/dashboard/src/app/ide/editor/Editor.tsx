import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import type { RefObject } from "react";
import type { StoredChunk } from "@/shared/types/chunk";
import { buildExtensions } from "./codemirror";
import { setChunks } from "./chunkOverlay";

export function Editor({
  path,
  currentState,
  chunks,
  viewRef,
  onChange,
}: {
  path: string;
  currentState: EditorState;
  chunks: StoredChunk[];
  viewRef: RefObject<EditorView | null>;
  onChange: (state: EditorState) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const loadedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({ doc: "", extensions: buildExtensions(onChange) }),
    });

    viewRef.current = view;
    return () => view.destroy();
  }, []);

  useEffect(() => {
    if (path === loadedPathRef.current) return;
    viewRef.current?.setState(currentState);
    loadedPathRef.current = path;
  }, [path, currentState]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setChunks.of(chunks) });
  }, [chunks, path]);

  return <div className="min-h-0 flex-1 overflow-hidden bg-editor-bg" ref={hostRef} />;
}
