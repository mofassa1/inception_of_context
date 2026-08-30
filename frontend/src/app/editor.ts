import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  HighlightStyle,
  syntaxHighlighting,
  indentUnit,
  LanguageDescription,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

const theme = EditorView.theme(
  {
    "&": { color: "#dbe4f3", backgroundColor: "transparent", height: "100%" },
    ".cm-scroller": {
      fontFamily:
        "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "13px",
      lineHeight: "1.7",
      overflow: "auto",
    },
    ".cm-content": { padding: "14px 0 60vh 0", caretColor: "#36b6ff" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "#46506a",
      paddingRight: "4px",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 12px" },
    ".cm-line": { padding: "0 16px" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.035)" },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#8a97b8",
    },
    ".cm-cursor": { borderLeftColor: "#36b6ff" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(54,182,255,0.22) !important",
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "#8aa6ff" },
  { tag: [t.controlKeyword, t.moduleKeyword], color: "#c79bff" },
  { tag: [t.string, t.special(t.string)], color: "#86e0a8" },
  { tag: t.comment, color: "#5b6680", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#f3ab73" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "#62c9ff",
  },
  { tag: [t.typeName, t.className], color: "#5fd6d0" },
  { tag: t.propertyName, color: "#9fb3d6" },
  { tag: t.tagName, color: "#8aa6ff" },
  { tag: t.attributeName, color: "#86e0a8" },
  { tag: t.operator, color: "#9fb3d6" },
  { tag: t.variableName, color: "#dbe4f3" },
  { tag: [t.brace, t.bracket, t.paren, t.punctuation], color: "#7d8aab" },
]);

async function languageFor(path: string): Promise<Extension[]> {
  const name = path.split("/").pop() ?? path;
  const desc = LanguageDescription.matchFilename(languages, name);
  if (!desc) return [];
  try {
    return [await desc.load()];
  } catch {
    return [];
  }
}

function sharedExtensions(onChange: (state: EditorState) => void): Extension[] {
  return [
    lineNumbers(),
    history(),
    highlightActiveLine(),
    indentUnit.of("  "),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    syntaxHighlighting(highlight),
    theme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.state);
    }),
  ];
}

export type Editor = {
  view: EditorView;
  open(state: EditorState): void;
  destroy(): void;
};

export function createEditor(
  parent: HTMLElement,
  onChange: (state: EditorState) => void,
): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: "",
      extensions: sharedExtensions(onChange),
    }),
  });

  return {
    view,
    open: (state) => view.setState(state),
    destroy: () => view.destroy(),
  };
}

export async function createFileState(
  path: string,
  code: string,
  onChange: (state: EditorState) => void,
): Promise<EditorState> {
  return EditorState.create({
    doc: code,
    extensions: [...sharedExtensions(onChange), ...(await languageFor(path))],
  });
}
