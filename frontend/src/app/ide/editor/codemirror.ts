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
import { tags } from "@lezer/highlight";
import { getBaseName } from "@/shared/lib/path";

const MONO_FONT =
  'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

const editorTheme = EditorView.theme(
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

const highlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.moduleKeyword,
      tags.definitionKeyword,
      tags.operatorKeyword,
    ],
    color: "#c678dd",
  },
  {
    tag: [
      tags.string,
      tags.special(tags.string),
      tags.regexp,
      tags.attributeValue,
    ],
    color: "#98c379",
  },
  { tag: [tags.comment, tags.meta], color: "#7f848e", fontStyle: "italic" },
  {
    tag: [
      tags.number,
      tags.integer,
      tags.float,
      tags.constant(tags.variableName),
      tags.self,
    ],
    color: "#d19a66",
  },
  { tag: [tags.bool, tags.null, tags.atom, tags.escape], color: "#56b6c2" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "#61afef",
  },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#e5c07b" },
  {
    tag: [tags.variableName, tags.propertyName, tags.tagName],
    color: "#e06c75",
  },
  { tag: tags.attributeName, color: "#d19a66" },
  {
    tag: [
      tags.operator,
      tags.punctuation,
      tags.brace,
      tags.bracket,
      tags.paren,
    ],
    color: "#abb2bf",
  },
  { tag: tags.heading, color: "#e06c75", fontWeight: "bold" },
  { tag: [tags.link, tags.url], color: "#61afef" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
]);

function toMatchableName(fileName: string): string {
  const lower = fileName.toLowerCase();

  if (
    lower === "makefile" ||
    lower === "gnumakefile" ||
    lower.endsWith(".mk") ||
    lower.endsWith(".mak")
  ) {
    return "recipe.sh";
  }

  if (lower.endsWith(".lock")) return "deps.toml";

  return fileName;
}

async function loadLanguage(filePath: string): Promise<Extension[]> {
  const description = LanguageDescription.matchFilename(
    languages,
    toMatchableName(getBaseName(filePath)),
  );

  if (!description) return [];

  try {
    return [await description.load()];
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
    syntaxHighlighting(highlightStyle),
    editorTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state);
    }),
  ];
}

export async function createDocumentState(
  filePath: string,
  content: string,
  onChange: (state: EditorState) => void,
): Promise<EditorState> {
  return EditorState.create({
    doc: content,
    extensions: [
      ...buildExtensions(onChange),
      ...(await loadLanguage(filePath)),
    ],
  });
}
