export function getBaseName(targetPath: string): string {
  return targetPath.split("/").pop() || targetPath;
}

export function getParentPath(targetPath: string): string {
  const separatorIndex = targetPath.lastIndexOf("/");
  return separatorIndex <= 0 ? "/" : targetPath.slice(0, separatorIndex);
}

export function getRelativePath(targetPath: string, basePath: string): string {
  return targetPath.startsWith(basePath + "/")
    ? targetPath.slice(basePath.length + 1)
    : targetPath;
}

export function isPathInside(targetPath: string, basePath: string): boolean {
  return targetPath === basePath || targetPath.startsWith(basePath + "/");
}

export function replacePathPrefix(
  targetPath: string,
  previousPrefix: string,
  nextPrefix: string,
): string {
  if (targetPath === previousPrefix) return nextPrefix;

  if (targetPath.startsWith(previousPrefix + "/")) {
    return nextPrefix + targetPath.slice(previousPrefix.length);
  }

  return targetPath;
}

export function resolveSibling(entryPath: string, nextName: string): string {
  return getParentPath(entryPath) + "/" + nextName;
}
