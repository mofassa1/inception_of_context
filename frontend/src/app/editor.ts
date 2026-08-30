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

const MONO_FONT =
  'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

const theme = EditorView.theme(
  {
    "&": { color: "#abb2bf", backgroundColor: "#23272e", height: "100%" },
    ".cm-scroller": {
      fontFamily: MONO_FONT,
      fontSize: "13.5px",
      lineHeight: "1.6",
      overflow: "auto",
    },
    ".cm-content": { padding: "4px 0 40vh 0", caretColor: "#528bff" },
    ".cm-gutters": {
      backgroundColor: "#23272e",
      border: "none",
      color: "#495162",
      paddingRight: "4px",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 12px" },
    ".cm-line": { padding: "0 16px" },
    ".cm-activeLine": { backgroundColor: "#2c313c" },
    ".cm-activeLineGutter": { backgroundColor: "#2c313c", color: "#abb2bf" },
    ".cm-cursor": { borderLeftColor: "#528bff" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(103, 118, 150, 0.38) !important",
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.moduleKeyword,
      t.definitionKeyword,
      t.operatorKeyword,
    ],
    color: "#c678dd",
  },
  {
    tag: [t.string, t.special(t.string), t.regexp, t.attributeValue],
    color: "#98c379",
  },
  { tag: [t.comment, t.meta], color: "#7f848e", fontStyle: "italic" },
  {
    tag: [t.number, t.integer, t.float, t.constant(t.variableName), t.self],
    color: "#d19a66",
  },
  { tag: [t.bool, t.null, t.atom, t.escape], color: "#56b6c2" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "#61afef",
  },
  { tag: [t.typeName, t.className, t.namespace], color: "#e5c07b" },
  { tag: [t.variableName, t.propertyName, t.tagName], color: "#e06c75" },
  { tag: t.attributeName, color: "#d19a66" },
  {
    tag: [t.operator, t.punctuation, t.brace, t.bracket, t.paren],
    color: "#abb2bf",
  },
  { tag: t.heading, color: "#e06c75", fontWeight: "bold" },
  { tag: [t.link, t.url], color: "#61afef" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
]);

function matchName(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower === "makefile" ||
    lower === "gnumakefile" ||
    lower.endsWith(".mk") ||
    lower.endsWith(".mak")
  ) {
    return "recipe.sh";
  }
  if (lower.endsWith(".lock")) return "deps.toml";
  return name;
}

async function languageFor(path: string): Promise<Extension[]> {
  const name = path.split("/").pop() ?? path;
  const desc = LanguageDescription.matchFilename(languages, matchName(name));
  if (!desc) return [];
  try {
    return [await desc.load()];
  } catch {
    return [];
  }
}

export function buildExtensions(
  onChange: (state: EditorState) => void,
): Extension[] {
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

export async function createDocState(
  path: string,
  code: string,
  onChange: (state: EditorState) => void,
): Promise<EditorState> {
  return EditorState.create({
    doc: code,
    extensions: [...buildExtensions(onChange), ...(await languageFor(path))],
  });
}
