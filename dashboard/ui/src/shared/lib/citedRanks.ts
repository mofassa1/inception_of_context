export function citedRanks(answer: string): Set<number> {
  return new Set(
    [...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])),
  );
}
