export const DEFAULT_IGNORE_NAMES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "venv",
  ".venv",
  "__pycache__",
  "chroma_db",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".next",
  ".cache",
  "coverage",
] as const;

export const IGNORE_PATHS_KEY = "not-vscode:ignore-paths";
