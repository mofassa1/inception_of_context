import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const REPOSITORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// One long test, one window: the film is a story, so nothing runs in parallel or is retried.
export default defineConfig({
  testDir: ".",
  testMatch: "showcase.spec.ts",
  outputDir: path.join(REPOSITORY, ".showcase/test-results"),
  workers: 1,
  retries: 0,
  timeout: 0,
  reporter: [["list"]],
  expect: { timeout: 15_000 },
});
