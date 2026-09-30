import type { IgnoreRuleDTO } from "@/shared/types/dto";
import { getBaseName, getParentPath, isPathInside } from "./path";

export function isPathIgnored(
  path: string,
  directory: string,
  rules: IgnoreRuleDTO[],
): boolean {
  const pathRules = new Map<string, boolean>();
  const nameRules = new Map<string, boolean>();

  for (const rule of rules) {
    if (rule.pattern.startsWith("/")) pathRules.set(rule.pattern, rule.isIgnored);
    else nameRules.set(rule.pattern, rule.isIgnored);
  }

  let current = path;

  while (current !== directory && isPathInside(current, directory)) {
    const pathRule = pathRules.get(current);
    if (pathRule !== undefined) return pathRule;

    const nameRule = nameRules.get(getBaseName(current));
    if (nameRule !== undefined) return nameRule;

    current = getParentPath(current);
  }

  return false;
}
