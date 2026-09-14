const CITATION_LINE = /chunks used:\s*(\[\d+\][\s,]*(and\s+)?)+\.?[ \t]*\n?/gi;

export function withoutCitationLine(answer: string): string {
  return answer.replace(CITATION_LINE, "").trim();
}
