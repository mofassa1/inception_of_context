export async function readJsonLines<TLine>(
  response: Response,
  onLine: (line: TLine) => void,
): Promise<void> {
  if (!response.body) throw new Error("response has no body to stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function emitCompleteLines() {
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const text = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (text) onLine(JSON.parse(text) as TLine);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    emitCompleteLines();
  }

  buffer += decoder.decode();
  const tail = buffer.trim();
  if (tail) onLine(JSON.parse(tail) as TLine);
}
