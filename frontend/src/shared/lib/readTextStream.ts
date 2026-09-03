export async function readTextStream(
  response: Response,
  onChunk: (text: string) => void,
): Promise<void> {
  if (!response.body) throw new Error("response has no body to stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) onChunk(decoder.decode(value, { stream: true }));
  }

  const tail = decoder.decode();
  if (tail) onChunk(tail);
}
