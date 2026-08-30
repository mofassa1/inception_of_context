import { useEffect, useRef } from "react";
import type { EditorState } from "@codemirror/state";
import { createEditor, type Editor } from "./editor.js";

export function EditorPane({
  currentState,
  onChange,
}: {
  currentState: EditorState | null;
  onChange: (state: EditorState) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    const editor = createEditor(hostRef.current!, onChange);
    editorRef.current = editor;
    return () => editor.destroy();
  }, []);

  useEffect(() => {
    if (currentState) editorRef.current?.open(currentState);
  }, [currentState]);

  return <div className="editor-host" ref={hostRef} />;
}
