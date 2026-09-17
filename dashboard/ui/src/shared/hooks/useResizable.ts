export type ResizeEdge = "leading" | "trailing";

export function useResizable({
  width,
  minWidth,
  maxWidth,
  edge,
  onResize,
}: {
  width: number;
  minWidth: number;
  maxWidth: number;
  edge: ResizeEdge;
  onResize: (width: number) => void;
}) {
  function startResize(event: React.MouseEvent) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = width;

    function handleMove(moveEvent: MouseEvent) {
      const travelled = moveEvent.clientX - startX;
      const nextWidth =
        edge === "trailing" ? startWidth + travelled : startWidth - travelled;

      onResize(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
    }

    function handleUp() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.classList.remove("resizing");
    }

    document.body.classList.add("resizing");
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return { startResize };
}
