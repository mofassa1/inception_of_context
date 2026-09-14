import type { EditorState } from "@codemirror/state";

export type FileSaveStatus = "saved" | "saving" | "error";

export type EditorTab = {
  path: string;
  state: EditorState;
  status: FileSaveStatus;
  error?: string;
};
