import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { buildExtensions } from "./codemirror";

export function Editor({
  path,
  currentState,
  onChange,
}: {
  path: string;
  currentState: EditorState;
  onChange: (state: EditorState) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
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

  return <div className="editor-host" ref={hostRef} />;
}
