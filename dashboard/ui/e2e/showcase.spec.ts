// The showcase: one take through every feature of the app, driven like a person would,
// on a fresh copy of demo/. It is a film and a test at once: each scene checks what it shows.
//
//   make showcase                         start everything and play it
//   SHOWCASE_SPEED=1.5 make showcase      faster; 0.8 is slower
//   SHOWCASE_RECORD=1 make showcase       also record the screen, then cut it into an .mp4
//   SHOWCASE_HEADLESS=1 make showcase     play it off-screen, a dry run
//   SHOWCASE_SNAPSHOTS=1 make showcase    a screenshot at every caption, in .showcase/snapshots
//   SHOWCASE_SCENES=9-11 make showcase    rehearse some scenes only (1-13, the cards always play)
//
// The model answers are real, so their waits are long on a CPU. Each one shows a clock, and is
// written to .showcase/chapters.json, so setup/cut_video.py can speed it up in the .mp4.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, expect, test, type Locator, type Page } from "@playwright/test";
import { deleteConversations, getStatus, setModels, waitUntilIndexed } from "./bridge";
import { Director } from "./director";
import { removeModel } from "./ollama";
import { ScreenRecorder } from "./recorder";

const UI_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY = path.resolve(UI_FOLDER, "../..");
const OUTPUT_FOLDER = path.join(REPOSITORY, ".showcase");

const FOLDER = process.env.SHOWCASE_FOLDER ?? "";
const SPEED = Number(process.env.SHOWCASE_SPEED || 1);
const ZOOM = Number(process.env.SHOWCASE_ZOOM || 1.25);
const SEED = Number(process.env.SHOWCASE_SEED || 42);
const CAPTIONS = process.env.SHOWCASE_CAPTIONS !== "0";
const TYPOS = process.env.SHOWCASE_TYPOS !== "0";
const FULLSCREEN = process.env.SHOWCASE_FULLSCREEN !== "0";
const RECORD = process.env.SHOWCASE_RECORD === "1";
const HEADLESS = process.env.SHOWCASE_HEADLESS === "1";
const SNAPSHOTS = process.env.SHOWCASE_SNAPSHOTS === "1";
const FFMPEG = process.env.SHOWCASE_FFMPEG ?? "";
const ROLLBACK_SCENE = process.env.SHOWCASE_ROLLBACK !== "0";
const SCENES = parseScenes(process.env.SHOWCASE_SCENES || "1-13");
const [VIDEO_WIDTH, VIDEO_HEIGHT] = (process.env.SHOWCASE_SIZE || "1920x1080").split("x").map(Number);

// Installed on camera in scene 09; small, so the download takes seconds.
const PULL_MODEL = process.env.SHOWCASE_PULL_MODEL || "qwen2.5:0.5b";

// What the agent is asked. A 3B model writes new files reliably; an edit of an existing file
// may take it a second attempt, which the Patch tab shows in the open.
const REQUESTS = {
  create:
    "Create tasks/export.py with a function to_csv(tasks) that returns the tasks as CSV text: a header line id,title,priority,done, then one line per task.",
  test: 'Create tests/test_export.py. Its first lines must be "import unittest", "from tasks.export import to_csv" and "from tasks.service import TaskService". Then a unittest.TestCase that creates two tasks with TaskService, calls to_csv(service.list_tasks()), and checks that the first line is id,title,priority,done and that there are 3 lines.',
  edit: "In tasks/storage.py, add a method count(self) to TaskStore that returns how many tasks are stored. Keep every other line as it is.",
  breaking:
    'In tasks/service.py, make TaskService.create accept an empty title and save the task as "Untitled" instead of raising an error.',
};

const INDEX_TIMEOUT_MS = 10 * 60_000;
const MODEL_TIMEOUT_MS = 20 * 60_000;
const AGENT_RESULT = /^\d+ files? changed ·|^Rolled back, nothing changed|^No files changed/;

type Outcome = "kept" | "rolled back" | "refused";
type AgentResult = { outcome: Outcome; paths: string[] };

let recorder: ScreenRecorder | null = null;

// A take that fails halfway still leaves a readable recording, and no ffmpeg behind.
test.afterEach(async () => {
  await recorder?.stop();
});

test("showcase: every feature, one take", async () => {
  expect(FOLDER, "SHOWCASE_FOLDER is set by make showcase").not.toBe("");
  expect(RECORD && HEADLESS, "the recording films the screen: SHOWCASE_RECORD needs the window on screen").toBe(false);
  expect(!RECORD || FFMPEG !== "", "SHOWCASE_FFMPEG is set by setup/run.py from imageio-ffmpeg").toBe(true);
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });

  // A clean take: no conversation left from the last one, and the model of scene 09 not
  // installed yet, so its download shows. Never the model the project is running on.
  await deleteConversations(FOLDER);
  const original = await getStatus();
  const showsDownload = ![original.ask_model, original.code_model].includes(PULL_MODEL);
  if (SCENES.has(9) && showsDownload) await removeModel(PULL_MODEL);

  const environment = { ...process.env } as Record<string, string>;
  delete environment.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    args: HEADLESS ? ["--ozone-platform=headless", ".", FOLDER] : [".", FOLDER],
    cwd: UI_FOLDER,
    env: environment,
  });

  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  const screenArea = await app.evaluate(
    ({ BrowserWindow, screen }, { headless, fullscreen, width, height, zoom }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (headless) window.setBounds({ x: 0, y: 0, width, height });
      else if (fullscreen) window.setFullScreen(true);
      else window.maximize();
      window.webContents.setZoomFactor(zoom);
      const display = screen.getPrimaryDisplay();
      const scale = display.scaleFactor;
      return {
        x: Math.round(display.bounds.x * scale),
        y: Math.round(display.bounds.y * scale),
        width: Math.round(display.bounds.width * scale),
        height: Math.round(display.bounds.height * scale),
      };
    },
    { headless: HEADLESS, fullscreen: FULLSCREEN, width: VIDEO_WIDTH, height: VIDEO_HEIGHT, zoom: ZOOM },
  );
  // Let the window settle into fullscreen before the camera rolls.
  await page.waitForTimeout(1200);

  if (RECORD) {
    const name = `showcase-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.mkv`;
    fs.mkdirSync(path.join(OUTPUT_FOLDER, "videos"), { recursive: true });
    recorder = new ScreenRecorder(FFMPEG, process.env.DISPLAY || ":0", screenArea, path.join(OUTPUT_FOLDER, "videos", name));
    console.log(`showcase recording: .showcase/videos/${name}`);
  }
  const videoStartedAt = recorder?.startedAt ?? Date.now();

  const d = new Director(page, {
    speed: SPEED,
    captions: CAPTIONS,
    typos: TYPOS,
    seed: SEED,
    startedAt: videoStartedAt,
    chaptersFile: path.join(OUTPUT_FOLDER, "chapters.txt"),
    snapshotsFolder: SNAPSHOTS ? path.join(OUTPUT_FOLDER, "snapshots") : undefined,
    capture: async () => {
      const png = await app.evaluate(async ({ BrowserWindow }) => {
        const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage();
        return image.toPNG().toString("base64");
      });
      return Buffer.from(png, "base64");
    },
  });
  await page.waitForTimeout(800);
  await d.install();

  const ui = locators(page);
  const tally = { questions: 0, kept: 0, rolledBack: 0, models: new Set<string>() };
  let firstAnswerSeconds = 0;

  // -------------------------------------------------------------------------
  // Opening card, shown while the AI agent finishes its index
  // -------------------------------------------------------------------------

  await test.step("opening card", async () => {
    await d.card(
      "Inception of Context",
      "A coding agent that never leaves your laptop",
      "It indexes a codebase, answers questions about it, and writes patches it validates, or rolls back.",
      [
        { value: "3B", label: "local models, through Ollama" },
        { value: "CPU", label: "no GPU needed" },
        { value: "0", label: "calls to a cloud API" },
      ],
      5500,
    );
    await waitUntilIndexed(INDEX_TIMEOUT_MS);
    await expect(ui.sidebar.getByText("demo", { exact: true })).toBeVisible();
    await d.hideCard();
  });

  const status = await getStatus();

  // -------------------------------------------------------------------------
  // 01–02 · The project, folder by folder, and how it is chunked
  // -------------------------------------------------------------------------

  await scene([1, 2], "01 the project", async () => {
    await d.caption(
      "01 · The project",
      "A small full-stack app, opened in the IDE",
      "A Python API, a vanilla JS frontend and unit tests. Every file was indexed at start-up.",
    );
    await d.read(1500);
    await expandFolders(d, ui, [
      ["tasks", "service.py"],
      ["web", "app.js"],
      ["tests", "test_api.py"],
    ]);
    await d.read(1200);

    await d.click(ui.treeItem("service.py"));
    await expect(page.locator(".cm-chunk-band").first()).toBeVisible();
    await d.caption(
      "02 · Index",
      "Every function is its own chunk",
      "Python is cut with its AST: one chunk per method and class, each embedded with MiniLM and stored in ChromaDB.",
    );
    await d.read(2500);
    await d.scroll(ui.editor, 420);
    await d.read(2000);
    await d.scroll(ui.editor, -420);

    await d.click(ui.chunkToggle);
    await d.read(1300);
    await d.click(ui.chunkToggle);
    await d.read(1000);

    await d.click(ui.treeItem("app.js"));
    await d.caption(
      "02 · Index",
      "Not only Python",
      "JavaScript is cut on its functions too. HTML, CSS and YAML are indexed as well.",
    );
    await d.read(1500);
    await d.scroll(ui.editor, 360);
    await d.read(1800);
    await d.hideCaption();
  });

  // -------------------------------------------------------------------------
  // 03 · Overview
  // -------------------------------------------------------------------------

  await scene([3], "03 overview", async () => {
    await d.click(ui.view("Overview"));
    await expect(page.getByText("Chunks indexed")).toBeVisible();
    await d.caption(
      "03 · Overview",
      "What the index holds, at a glance",
      `${status.chunks_indexed} chunks from ${status.files.length} files, the models in use, and a live feed of the watcher.`,
    );
    await d.hover(page.getByText("Chunks indexed"));
    await d.read(1500);
    await d.hover(page.getByText("Ask model"));
    await d.hover(page.getByText("Code model"));
    await d.read(1200);
    await d.scroll(ui.overview, 380);
    await d.read(2500);
    await d.scroll(ui.overview, -380);
  });

  // -------------------------------------------------------------------------
  // 04 · A live edit, re-indexed by the watcher
  // -------------------------------------------------------------------------

  await scene([4], "04 live edit", async () => {
    await d.click(ui.view("Editor"));
    await expandFolders(d, ui, [["tasks", "models.py"]]);
    await d.click(ui.treeItem("models.py"));
    await d.caption(
      "04 · Watch",
      "Edit a file, the index follows",
      "Add a 'critical' priority. Autosave writes it, and the watcher re-embeds the chunks of this one file.",
    );
    await d.read(1200);
    await d.click(page.locator(".cm-line", { hasText: "PRIORITIES = (" }));
    await d.press("End");
    await d.press("ArrowLeft");
    await d.type(', "critical"', { typos: false });
    await d.wait(900);
    await expect(page.getByText("saved", { exact: true })).toBeVisible();
    await d.read(1200);

    await d.click(ui.view("Overview"));
    await d.scroll(ui.overview, 900);
    await expect(ui.activity.getByText(/tasks\/models\.py/).first()).toBeVisible({ timeout: 30_000 });
    await d.caption(
      "04 · Watch",
      "Re-indexed in a moment",
      "Only models.py was embedded again: a full re-index on every save would not scale.",
    );
    await d.hover(ui.activity.getByText(/tasks\/models\.py/).first());
    await d.read(2500);
  });

  // -------------------------------------------------------------------------
  // 05 · Files: create, write, rename, delete
  // -------------------------------------------------------------------------

  await scene([5], "05 files", async () => {
    await d.click(ui.view("Editor"));
    await expandFolders(d, ui, [["tasks"], ["web"], ["tests"]]);
    await d.caption(
      "05 · Files",
      "A real editor around the agent",
      "Create, write, rename, delete: every change reaches the index on its own.",
    );
    await d.hover(ui.sidebar.getByText("demo", { exact: true }));
    await d.click(page.getByRole("button", { name: "New file in the root folder" }));
    await d.type("ideas.md", { typos: false });
    await d.press("Enter");
    await d.click(ui.treeItem("ideas.md"));
    await d.click(ui.editor);
    await d.type("# Ideas\n\nDue dates, a dark mode, and a weekly summary email.");
    await d.wait(900);
    await expect(page.getByText("saved", { exact: true })).toBeVisible();
    await d.read(1200);

    await d.click(ui.treeItem("ideas.md"), { button: "right" });
    await d.click(page.getByText("Rename", { exact: true }));
    await d.type("roadmap.md", { typos: false });
    await d.press("Enter");
    await expect(ui.treeItem("roadmap.md")).toBeVisible();
    await d.read(1400);

    await d.click(ui.treeItem("roadmap.md"), { button: "right" });
    await d.click(page.getByText("Delete", { exact: true }));
    await expect(ui.treeItem("roadmap.md")).toHaveCount(0);
    await d.read(1000);

    await d.click(ui.view("Overview"));
    await d.scroll(ui.overview, 900);
    await expect(ui.activity.getByText(/roadmap\.md/).first()).toBeVisible({ timeout: 30_000 });
    await d.hover(ui.activity.getByText(/roadmap\.md/).first());
    await d.read(2200);
    await d.hideCaption();
  });

  // -------------------------------------------------------------------------
  // 06 · ChromaDB explorer
  // -------------------------------------------------------------------------

  await scene([6], "06 chromadb", async () => {
    await d.click(ui.view("ChromaDB"));
    await expect(page.getByText(/of \d+ chunks/)).toBeVisible();
    await d.caption(
      "06 · ChromaDB",
      "Every chunk, exactly as it was embedded",
      "Its kind, qualified name, line span and text, page by page.",
    );
    const rows = page.locator("article > button");
    await d.click(rows.nth(1));
    await d.read(2600);
    await d.click(rows.nth(1));
    await d.click(page.getByRole("button", { name: "Next" }));
    await d.read(1200);
    await d.click(rows.nth(3));
    await d.read(2600);
    await d.click(page.getByRole("button", { name: "Next" }));
    await d.read(1000);
    await d.click(page.getByRole("button", { name: "Previous" }));
    await d.read(1000);
    await d.hideCaption();
  });

  // -------------------------------------------------------------------------
  // 07 · Retrieve, then ask
  // -------------------------------------------------------------------------

  await scene([7], "07 ask and retrieve", async () => {
    await d.click(ui.view("Ask"));
    const region = page.getByRole("region", { name: "Ask and Retrieve" });
    await d.caption(
      "07 · Retrieve",
      "Search by meaning, not by name",
      "Retrieve embeds the question and returns the k closest chunks with their cosine similarity. No model involved.",
    );
    await d.click(region.locator("textarea"));
    await d.type("How does the frontend talk to the backend API?");
    await d.beat();

    const k = region.locator("select");
    await d.hover(k);
    await k.focus();
    await d.press("ArrowDown");
    await expect(k).toHaveValue("8");
    await d.beat();

    await d.click(region.getByRole("button", { name: "Retrieve" }));
    await expect(region.getByTitle(/cosine similarity/)).toHaveCount(8);
    await d.read(1800);
    await d.hover(region.getByTitle(/cosine similarity/).first());
    await d.read(1500);

    await d.caption(
      "07 · Ask",
      "Retrieve, then generate",
      `The chunks go to ${status.ask_model}, running locally in Ollama. The answer streams in, next to what it was given.`,
    );
    await d.click(region.getByRole("button", { name: "Ask LLM" }));
    await d.whileWaiting(`${status.ask_model} is answering, on the CPU`, () =>
      untilIdle(region.getByRole("button", { name: "Answering…" }), region.getByRole("button", { name: "Ask LLM" })),
    );
    tally.questions += 1;
    tally.models.add(status.ask_model);
    await expect(region.getByText("Chunks the answer used")).toBeVisible();
    await d.read(4000);
    await d.click(region.locator("button[aria-expanded=false]").first());
    await d.read(2500);
    await d.hideCaption();
  });

  // -------------------------------------------------------------------------
  // 08 · Chat with the codebase
  // -------------------------------------------------------------------------

  await scene([8], "08 chat", async () => {
    await d.click(ui.view("Editor"));
    await openChat(d, page);
    await d.click(ui.chatMode("Ask"));
    await d.caption(
      "08 · Chat",
      "Talk to the codebase",
      "Conversations are kept per folder, and the last answers go with every new question.",
    );
    await d.read(1200);

    await ask(d, ui, "Which priorities can a task have?", status.ask_model);
    firstAnswerSeconds = d.lastWaitSeconds;
    tally.questions += 1;
    tally.models.add(status.ask_model);
    const knowsTheEdit = (await ui.chat.getByText(/critical/i).count()) > 0;
    await d.caption(
      "08 · Chat",
      knowsTheEdit ? "It already knows about the edit from a minute ago" : "Every answer shows its sources",
      knowsTheEdit
        ? "The watcher re-embedded models.py, so the new 'critical' priority is part of the answer."
        : "The chunks the model was given are listed under the answer.",
    );
    await d.read(3000);

    await d.click(ui.chat.getByRole("button", { name: /chunks? used/ }).last());
    await d.read(1200);
    await d.click(ui.chat.getByRole("button", { name: "Show chunk" }).first());
    await d.read(2500);
    await d.click(ui.chat.getByTitle(/^Open /).first());
    await d.read(2000);

    await ask(d, ui, "What happens when someone creates a task with an empty title?", status.ask_model);
    tally.questions += 1;
    await d.caption("08 · Chat", "Grounded in the code it retrieved", "The answer is built from the chunks listed under it, nothing else.");
    await d.read(4500);

    await d.caption("08 · Chat", "Asking about something that does not exist", "");
    await ask(d, ui, "Is there a function called archive_task in this project?", status.ask_model);
    tally.questions += 1;
    const lastAnswer = (await ui.chat.locator(".markdown").last().textContent()) ?? "";
    if (/\b(no|not|doesn't|isn't)\b/i.test(lastAnswer)) {
      await d.caption("08 · Chat", "No invented function", "Nothing in the index matches, and the answer says so instead of making one up.");
    }
    await d.read(4500);
    await d.hideCaption();
  });

  // -------------------------------------------------------------------------
  // 09 · Models: install one from the window, answer with it, switch back
  // -------------------------------------------------------------------------

  await scene([9], "09 models", async () => {
    try {
      await d.click(ui.view("Editor"));
      await openChat(d, page);
      await d.click(ui.chatMode("Ask"));
      const picker = page.getByTitle("Model that answers questions");
      const choice = (name: string) =>
        page.getByRole("listbox").getByRole("option", { name: new RegExp(`^${escapeRegExp(name)} `) });

      await d.caption(
        "09 · Models",
        "Install a model from the window",
        showsDownload
          ? `${PULL_MODEL} is not on this machine yet. One click downloads it through Ollama, while the project runs.`
          : "Every model Ollama has, and the ones it can download, one click away.",
      );
      await d.click(picker);
      await d.read(1500);
      await d.hover(choice(PULL_MODEL));
      await d.read(1200);
      await d.click(choice(PULL_MODEL));
      await d.whileWaiting(`downloading ${PULL_MODEL} through Ollama`, () =>
        expect(picker).toHaveText(PULL_MODEL, { timeout: MODEL_TIMEOUT_MS }),
      );
      await d.read(1500);

      await d.caption("09 · Models", `Now ${PULL_MODEL} answers`, "The same question as before, to a model six times smaller.");
      await ask(d, ui, "Which priorities can a task have?", PULL_MODEL);
      const smallSeconds = d.lastWaitSeconds;
      tally.questions += 1;
      tally.models.add(PULL_MODEL);
      await d.caption(
        "09 · Models",
        "Small is fast, big knows more",
        firstAnswerSeconds > 0
          ? `${PULL_MODEL}: ${Math.round(smallSeconds)} s. ${status.ask_model}: ${Math.round(firstAnswerSeconds)} s. Pick one per task, no restart.`
          : `${PULL_MODEL} answered in ${Math.round(smallSeconds)} s. Pick one per task, no restart.`,
      );
      await d.read(4000);

      await d.click(picker);
      await d.read(1000);
      await d.click(choice(status.ask_model));
      await expect(picker).toHaveText(status.ask_model);
      await d.read(1000);

      await d.click(ui.chatMode("Agent"));
      await d.caption(
        "09 · Models",
        "Each mode keeps its own model",
        `${status.ask_model} answers questions, ${status.code_model} writes the patches.`,
      );
      await d.click(page.getByTitle("Model that writes patches"));
      await d.read(1800);
      await d.press("Escape");
      await d.hideCaption();
    } finally {
      // Whatever happened on camera, models.mk keeps the models it had.
      await setModels(status.ask_model, status.code_model);
    }
  });

  // -------------------------------------------------------------------------
  // 10 · Agent mode: intent in, validated patch out
  // -------------------------------------------------------------------------

  await scene([10], "10 agent", async () => {
    await d.click(ui.view("Editor"));
    await openChat(d, page);
    await closeAllTabs(d, page);
    await expandFolders(d, ui, [["tasks"], ["tests"]]);
    await d.click(ui.chatMode("Agent"));
    await d.caption(
      "10 · Agent",
      "From intent to a validated patch",
      `${status.code_model} answers a JSON patch, whole files, never a diff. It is applied, then the project's tests decide.`,
    );
    tally.models.add(status.code_model);

    const first = await runAgent(d, ui, REQUESTS.create, status.code_model);
    expect.soft(first.outcome, "tasks/export.py is kept").toBe("kept");
    await captionOutcome(d, "10 · Agent", first.outcome);
    if (first.outcome === "kept") {
      tally.kept += 1;
      await showPatchedFile(d, ui, first.paths);

      const second = await runAgent(d, ui, REQUESTS.test, status.code_model);
      expect.soft(second.outcome, "tests/test_export.py is kept").toBe("kept");
      if (second.outcome === "kept") tally.kept += 1;
      if (second.outcome === "rolled back") tally.rolledBack += 1;
      if (second.outcome === "kept" && second.paths.some((path) => path.startsWith("tests/test_"))) {
        await d.caption("10 · Agent", "It writes its own tests too", "And the new test has to pass, with all the others, before anything is kept.");
      } else {
        await captionOutcome(d, "10 · Agent", second.outcome);
      }
      if (second.outcome === "kept") await showPatchedFile(d, ui, second.paths);
    }
    if (first.outcome === "rolled back") tally.rolledBack += 1;
    await d.hideCaption();
  });

  // -------------------------------------------------------------------------
  // 11 · The patch loop, every attempt in the open
  // -------------------------------------------------------------------------

  await scene([11], "11 patch loop", async () => {
    await d.click(ui.view("Patch"));
    const region = page.getByRole("region", { name: "Patch Loop" });
    await d.caption(
      "11 · Patch loop",
      "Every attempt, in the open",
      "Generate, sanity-check, write atomically, validate. Up to three tries, then a byte-for-byte rollback.",
    );
    await d.click(region.locator("textarea"));
    await d.type(REQUESTS.edit);
    await d.beat();
    await d.click(region.getByRole("button", { name: "Run patch loop" }));
    await d.whileWaiting(`${status.code_model} is writing the patch`, () =>
      untilIdle(region.getByRole("button", { name: "Running loop…" }), region.getByRole("button", { name: "Run patch loop" })),
    );

    const banner = region.getByText(/^(Validation passed|Rolled back to the pre-loop state|Gave up without applying anything)$/);
    await expect(banner).toBeVisible();
    const outcome = (await banner.textContent()) ?? "";
    expect.soft(outcome, "TaskStore.count is kept").toBe("Validation passed");
    if (outcome === "Validation passed") tally.kept += 1;
    if (outcome.startsWith("Rolled back")) tally.rolledBack += 1;

    await d.hover(banner);
    const attempts = await region.locator("article").count();
    if (outcome === "Validation passed" && attempts > 1) {
      await d.caption(
        "11 · Patch loop",
        `Red, then green, in ${attempts} attempts`,
        "A failed attempt goes back to the model with the test output and a diff of what it changed. It fixed itself.",
      );
    }
    await d.read(2500);
    const results = region.locator("div.overflow-y-auto");
    await d.scroll(results, 450);
    await d.read(3000);
    await d.scroll(results, 700);
    await d.caption("11 · Patch loop", "The validation output, kept with each attempt", "Compiled, then every test of the project, run by the command in ioc.config.yml.");
    await d.read(4000);
    await d.hideCaption();
  });

  // -------------------------------------------------------------------------
  // 12 · Guardrails: the tests are off limits, the patch cannot cheat
  // -------------------------------------------------------------------------

  if (ROLLBACK_SCENE) {
    await scene([12], "12 guardrails", async () => {
      await d.click(ui.view("Editor"));
      await openChat(d, page);
      await closeAllTabs(d, page);
      await expandFolders(d, ui, [["tasks"], ["tests"]]);
      await d.click(ui.chatMode("Agent"));
      await d.caption(
        "12 · Guardrails",
        "A patch that breaks the tests never stays",
        "A new conversation, with tests/ switched off: the agent can neither read nor touch it.",
      );
      await d.click(page.getByRole("button", { name: "New conversation" }));
      await expect(ui.chat.getByText("Hey — how can I help?")).toBeVisible();
      await d.read(1000);
      await d.click(ui.sidebar.getByRole("checkbox", { name: "Ignore tests" }));
      await expect(ui.sidebar.getByRole("checkbox", { name: "Include tests in the index" })).toBeVisible();
      await d.read(1800);

      const { outcome: result } = await runAgent(d, ui, REQUESTS.breaking, status.code_model);
      if (result === "rolled back") {
        tally.rolledBack += 1;
        await d.caption(
          "12 · Guardrails",
          "Rolled back, byte for byte",
          "Each attempt broke a test the agent could not edit. Every file is back as it was: content, mode and mtime.",
        );
        await d.read(3000);
        await d.click(ui.treeItem("service.py"));
        await d.hover(page.locator(".cm-line", { hasText: 'raise ValueError("a task needs a title")' }));
        await d.read(3000);
      } else {
        if (result === "kept") tally.kept += 1;
        await captionOutcome(d, "12 · Guardrails", result);
      }

      await d.caption("12 · Guardrails", "Nothing is lost", "The first conversation is still there, with its questions and its patches.");
      await d.hover(page.getByLabel("Switch conversation"));
      await page.getByLabel("Switch conversation").selectOption({ index: 2 });
      await expect(ui.chat.getByText("Which priorities can a task have?").first()).toBeAttached();
      await d.read(1500);
      await d.scroll(ui.chatList, -2500);
      await expect(ui.chat.getByText("Which priorities can a task have?").first()).toBeInViewport();
      await d.read(2500);
      await d.hideCaption();
    });
  }

  // -------------------------------------------------------------------------
  // 13 · Everything that happened, live
  // -------------------------------------------------------------------------

  await scene([13], "13 live activity", async () => {
    await d.click(ui.view("Overview"));
    await d.caption(
      "13 · Overview",
      "Everything that happened, as it happened",
      "Edits, new files, deletions and every patched file, pushed to the window over Server-Sent Events.",
    );
    await d.scroll(ui.overview, 900);
    await d.read(3500);
  });

  const final = await getStatus();
  await test.step("closing card", async () => {
    await d.hideCaption();
    const models = [...tally.models];
    await d.card(
      "Inception of Context",
      "Index. Ask. Patch. Validate.",
      `All of it on this laptop, with ${models.length > 0 ? models.join(", ") : `${final.ask_model} and ${final.code_model}`}.`,
      [
        { value: String(final.chunks_indexed), label: "chunks in ChromaDB" },
        { value: String(tally.questions), label: "questions answered" },
        { value: String(tally.kept), label: "patches validated and kept" },
        { value: String(tally.rolledBack), label: "rolled back, byte for byte" },
        { value: "0", label: "tokens sent to the cloud" },
      ],
      7000,
    );
  });

  await recorder?.stop();
  recorder = null;
  await app.close();
});

// ---------------------------------------------------------------------------
// Which scenes play: "1-13", "8,9", "4-6,10"
// ---------------------------------------------------------------------------

function parseScenes(text: string) {
  const scenes = new Set<number>();
  for (const part of text.split(",")) {
    const [first, last] = part.split("-").map((value) => Number(value.trim()));
    for (let number = first; number <= (last || first); number += 1) scenes.add(number);
  }
  return scenes;
}

async function scene(numbers: number[], title: string, body: () => Promise<void>) {
  if (!numbers.some((number) => SCENES.has(number))) return;
  await test.step(title, body);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Where things are in the window
// ---------------------------------------------------------------------------

function locators(page: Page) {
  const sidebar = page.locator('[class~="group/sidebar"]');
  return {
    sidebar,
    chat: page.getByRole("complementary", { name: "Chat" }),
    editor: page.locator(".cm-scroller"),
    overview: page.locator("div.overflow-y-auto", { has: page.getByText("Indexed files") }).first(),
    chatList: page.getByRole("complementary", { name: "Chat" }).locator("div.overflow-y-auto").first(),
    composer: page.getByPlaceholder(/Ask about this codebase|Describe a change/),
    chunkToggle: page.getByTitle(/chunk overlay/),
    activity: page.locator("section", { hasText: "Live activity" }),
    treeItem: (name: string) => sidebar.getByText(name, { exact: true }),
    folder: (name: string) =>
      sidebar.locator("div[aria-expanded]").filter({ has: page.getByText(name, { exact: true }) }).first(),
    chatMode: (name: "Ask" | "Agent") =>
      page.getByRole("tablist", { name: "Chat mode" }).getByRole("tab", { name, exact: true }),
    view: (name: string) =>
      page.getByRole("tablist", { name: "Workspace view" }).getByRole("tab", { name, exact: true }),
  };
}

type Ui = ReturnType<typeof locators>;

// ---------------------------------------------------------------------------
// The moves the scenes repeat
// ---------------------------------------------------------------------------

// Opens each folder that is still closed, and lets the eye land on one file inside it.
// An open folder stays open for the rest of the film.
async function expandFolders(d: Director, ui: Ui, folders: [string, string?][]) {
  for (const [name, inside] of folders) {
    const folder = ui.folder(name);
    if ((await folder.getAttribute("aria-expanded")) === "true") continue;
    await d.click(folder);
    await expect(folder).toHaveAttribute("aria-expanded", "true");
    await d.read(900);
    if (inside) {
      await d.hover(ui.treeItem(inside));
      await d.read(600);
    }
  }
}

// A busy control replaces the idle one while a model works. Wait for the swap both ways,
// so a fast answer is not mistaken for one that never started.
async function untilIdle(busy: Locator, idle: Locator) {
  await busy.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  await expect(idle).toBeVisible({ timeout: MODEL_TIMEOUT_MS });
}

async function sendChat(d: Director, ui: Ui, text: string) {
  await d.click(ui.composer);
  await d.type(text);
  await d.beat();
  await d.click(ui.chat.getByRole("button", { name: "Send message" }));
}

async function ask(d: Director, ui: Ui, question: string, model: string) {
  const sourcesBefore = await ui.chat.getByRole("button", { name: /chunks? used/ }).count();
  await sendChat(d, ui, question);
  await d.whileWaiting(`${model} is answering, on the CPU`, () =>
    untilIdle(ui.chat.getByRole("button", { name: "Stop" }), ui.chat.getByRole("button", { name: "Send message" })),
  );
  await expect(ui.chat.getByRole("button", { name: /chunks? used/ })).toHaveCount(sourcesBefore + 1);
  await d.read(1500);
}

// Sends a request in Agent mode and returns what became of it, read from its result card:
// the outcome, and the paths the kept patch changed.
async function runAgent(d: Director, ui: Ui, request: string, model: string): Promise<AgentResult> {
  const cards = ui.chat.getByText(AGENT_RESULT);
  const cardsBefore = await cards.count();
  await sendChat(d, ui, request);
  await d.whileWaiting(`${model} writes, applies and validates the patch`, () =>
    untilIdle(ui.chat.getByRole("button", { name: "Stop" }), ui.chat.getByRole("button", { name: "Send message" })),
  );
  await expect(cards).toHaveCount(cardsBefore + 1);
  const header = ((await cards.last().textContent()) ?? "").trim();
  const card = ui.chat.getByRole("group", { name: "Agent result" }).last();
  const paths = await card.locator("button[title]").evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("title") ?? ""),
  );
  await d.hover(cards.last());
  await d.read(2500);
  if (/^\d+ files? changed/.test(header)) return { outcome: "kept", paths };
  if (/^Rolled back/.test(header)) return { outcome: "rolled back", paths: [] };
  return { outcome: "refused", paths: [] };
}

async function captionOutcome(d: Director, kicker: string, outcome: Outcome) {
  if (outcome === "kept") {
    await d.caption(kicker, "Validated and kept", "The validation command of ioc.config.yml ran the whole test suite: green.");
  } else if (outcome === "rolled back") {
    await d.caption(kicker, "Three red test runs, so nothing stays", "The project is back as it was before the request, byte for byte.");
  } else {
    await d.caption(kicker, "Refused before anything was written", "The sanity checks stopped every attempt.");
  }
  await d.read(3000);
}

// Shows the first file a kept patch changed: in the tree, then opened from the result card, at
// its end, where the new code usually is. Only presentation: whatever the agent changed, a
// step that cannot be shown is logged and the take goes on.
async function showPatchedFile(d: Director, ui: Ui, paths: string[]) {
  const target = paths[0];
  if (!target) return;
  const parts = target.split("/");
  const name = parts[parts.length - 1];
  const visible = (locator: Locator) =>
    locator.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false);

  try {
    if (parts.length > 1) await expandFolders(d, ui, [[parts[parts.length - 2]]]);
    if (await visible(ui.treeItem(name))) {
      await d.hover(ui.treeItem(name));
      await d.read(800);
    }
    const fileButton = ui.chat
      .getByRole("group", { name: "Agent result" })
      .last()
      .locator(`button[title="${target}"]`);
    if (!(await visible(fileButton))) return;
    await d.click(fileButton);
    await expect(d.page.getByRole("button", { name: `Close tab ${name}` })).toBeVisible({ timeout: 5000 });
    await d.click(ui.editor);
    await d.press("Control+End");
    await d.read(4000);
    await d.scroll(ui.editor, -300);
    await d.read(2500);
  } catch (error) {
    console.log(`WARNING: could not show ${target}: ${String(error).split("\n")[0]}`);
  }
}

async function openChat(d: Director, page: Page) {
  const toggle = page.getByRole("button", { name: "Toggle chat" });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await d.click(toggle);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await d.wait(400);
}

// A file the agent is about to rewrite must not stay open with its old content.
async function closeAllTabs(d: Director, page: Page) {
  const closers = page.getByRole("button", { name: /^Close tab / });
  while ((await closers.count()) > 0) {
    await d.click(closers.last());
  }
  await d.beat();
}
