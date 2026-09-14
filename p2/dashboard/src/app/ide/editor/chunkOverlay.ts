import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import type { StoredChunk } from "@/shared/types/chunk";

export const setChunks = StateEffect.define<StoredChunk[]>();

const CHUNK_HUES = [
  "#61afef",
  "#98c379",
  "#c678dd",
  "#e5c07b",
  "#56b6c2",
  "#e06c75",
];

const MAX_RAIL_DEPTH = 3;
const RAIL_WIDTH_PX = 2;
const RAIL_STEP_PX = 5;

type PlacedChunk = StoredChunk & { index: number; depth: number };

function hueFor(index: number): string {
  return CHUNK_HUES[index % CHUNK_HUES.length];
}

function withDepth(chunks: StoredChunk[]): PlacedChunk[] {
  return chunks.map((chunk, index) => {
    const depth = chunks.filter(
      (other) =>
        other !== chunk &&
        other.metadata.start_line <= chunk.metadata.start_line &&
        other.metadata.end_line >= chunk.metadata.end_line &&
        other.metadata.end_line - other.metadata.start_line >
          chunk.metadata.end_line - chunk.metadata.start_line,
    ).length;

    return { ...chunk, index, depth };
  });
}

class ChunkBandWidget extends WidgetType {
  constructor(private readonly chunk: PlacedChunk) {
    super();
  }

  eq(other: ChunkBandWidget): boolean {
    return (
      other.chunk.id === this.chunk.id &&
      other.chunk.index === this.chunk.index &&
      other.chunk.metadata.start_line === this.chunk.metadata.start_line
    );
  }

  toDOM(): HTMLElement {
    const band = document.createElement("div");
    band.className = "cm-chunk-band";
    band.style.setProperty("--chunk-hue", hueFor(this.chunk.index));
    band.style.marginLeft = `${this.chunk.depth * RAIL_STEP_PX}px`;

    const label = document.createElement("span");
    label.className = "cm-chunk-band-label";

    const parts = [`chunk #${this.chunk.index + 1}`, `starts on line ${this.chunk.metadata.start_line}`];
    const detail = [this.chunk.metadata.kind, this.chunk.metadata.qualified_name].filter(Boolean);
    label.textContent = parts.join(" — ") + (detail.length ? ` · ${detail.join(" · ")}` : "");

    band.appendChild(label);
    return band;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildDecorations(state: EditorState, chunks: StoredChunk[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  if (chunks.length === 0) return builder.finish();

  const placed = withDepth(chunks);
  const totalLines = state.doc.lines;

  const bandByLine = new Map<number, PlacedChunk>();
  for (const chunk of placed) {
    if (chunk.metadata.start_line >= 1 && chunk.metadata.start_line <= totalLines) {
      bandByLine.set(chunk.metadata.start_line, chunk);
    }
  }

  for (let lineNumber = 1; lineNumber <= totalLines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);

    const band = bandByLine.get(lineNumber);
    if (band) {
      builder.add(
        line.from,
        line.from,
        Decoration.widget({
          widget: new ChunkBandWidget(band),
          block: true,
          side: -1,
        }),
      );
    }

    const covering = placed
      .filter(
        (chunk) =>
          chunk.metadata.start_line <= lineNumber && chunk.metadata.end_line >= lineNumber,
      )
      .sort((left, right) => left.depth - right.depth)
      .slice(0, MAX_RAIL_DEPTH);

    if (covering.length === 0) continue;

    const shadows = covering
      .map((chunk, position) => {
        const offset = position * RAIL_STEP_PX;
        return `inset ${offset + RAIL_WIDTH_PX}px 0 0 -${offset}px ${hueFor(chunk.index)}`;
      })
      .join(", ");

    builder.add(
      line.from,
      line.from,
      Decoration.line({
        attributes: { class: "cm-chunk-line", style: `box-shadow: ${shadows}` },
      }),
    );
  }

  return builder.finish();
}

type ChunkState = {
  chunks: StoredChunk[];
  decorations: DecorationSet;
};

export const chunkField = StateField.define<ChunkState>({
  create() {
    return { chunks: [], decorations: Decoration.none };
  },

  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setChunks)) {
        return {
          chunks: effect.value,
          decorations: buildDecorations(transaction.state, effect.value),
        };
      }
    }

    if (transaction.docChanged) {
      return {
        chunks: value.chunks,
        decorations: value.decorations.map(transaction.changes),
      };
    }

    return value;
  },

  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});

export function chunkOverlay() {
  return [chunkField];
}
