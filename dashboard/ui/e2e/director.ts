// Drives the window the way a person would: the mouse travels on a curve and slows down near
// its target, the keyboard types at an uneven pace and fixes the odd typo, the wheel scrolls in
// small notches. Every pause goes through wait(), so SHOWCASE_SPEED makes the whole film faster
// or slower, and the random numbers come from one seed, so every take moves the same way.

import fs from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { installOverlay, type CardItem } from "./overlay";

type Point = { x: number; y: number };

// Real mouse events per move: enough for hover styles, few enough to never pile up.
const HOVER_EVENTS = 6;
const KEYBOARD_NEIGHBOURS: Record<string, string> = {
  a: "s", b: "v", c: "x", d: "s", e: "w", f: "d", g: "f", h: "g", i: "u", j: "h", k: "j",
  l: "k", m: "n", n: "b", o: "i", p: "o", q: "w", r: "e", s: "a", t: "r", u: "y", v: "c",
  w: "q", x: "z", y: "t", z: "x",
};

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInOut(progress: number) {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

function bezier(start: Point, first: Point, second: Point, end: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u ** 3 * start.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * end.x,
    y: u ** 3 * start.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * end.y,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export type DirectorOptions = {
  speed: number;
  captions: boolean;
  typos: boolean;
  seed: number;
  // When the video began: every chapter time is counted from there, so the cutter can find it.
  startedAt: number;
  // chapters.txt for a person, chapters.json for setup/cut_video.py.
  chaptersFile: string;
  // When set, a screenshot is saved there each time a caption shows, taken by capture():
  // the window's own capture, since a page screenshot crops a zoomed window.
  snapshotsFolder?: string;
  capture?: () => Promise<Buffer>;
};

export class Director {
  private position: Point = { x: 0, y: 0 };
  private random: () => number;
  private chapters: string[] = [];
  private waits: { start: number; end: number; label: string }[] = [];
  // How long the last whileWaiting took, in seconds.
  lastWaitSeconds = 0;

  constructor(
    readonly page: Page,
    private readonly options: DirectorOptions,
  ) {
    this.random = seededRandom(options.seed);
  }

  async install() {
    await this.page.evaluate(installOverlay);
    const size = await this.page.evaluate(() => ({ x: innerWidth, y: innerHeight }));
    this.position = { x: size.x / 2, y: size.y / 2 };
    await this.page.mouse.move(this.position.x, this.position.y);
    await this.page.evaluate(([x, y]) => window.__showcase?.move(x, y), [this.position.x, this.position.y]);
  }

  between(low: number, high: number) {
    return low + (high - low) * this.random();
  }

  // ---------------------------------------------------------------------------
  // Time
  // ---------------------------------------------------------------------------

  wait(ms: number) {
    return sleep(ms / this.options.speed);
  }

  // A short, uneven pause between two actions.
  beat() {
    return this.wait(this.between(350, 700));
  }

  // Long enough for a viewer to read what just appeared.
  read(ms = 2200) {
    return this.wait(ms);
  }

  // ---------------------------------------------------------------------------
  // Mouse
  // ---------------------------------------------------------------------------

  private async pointIn(target: Locator): Promise<Point> {
    await target.waitFor({ state: "visible" });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`no box for ${target}`);
    // Somewhere near the middle, never twice on the exact same pixel.
    const spreadX = Math.min(box.width * 0.18, 30);
    const spreadY = Math.min(box.height * 0.15, 4);
    return {
      x: box.x + box.width / 2 + this.between(-spreadX, spreadX),
      y: box.y + box.height / 2 + this.between(-spreadY, spreadY),
    };
  }

  async moveTo(target: Locator | Point) {
    const end = "x" in target ? target : await this.pointIn(target);
    const start = this.position;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < 2) return;

    // Longer trips take longer, but not proportionally: a hand speeds up on the way.
    const duration = Math.min(950, Math.max(260, 220 + distance * 0.42)) / this.options.speed;
    const normal = { x: -(end.y - start.y) / distance, y: (end.x - start.x) / distance };
    const bend = distance * this.between(-0.12, 0.12);
    const first = {
      x: start.x + (end.x - start.x) * 0.3 + normal.x * bend,
      y: start.y + (end.y - start.y) * 0.3 + normal.y * bend,
    };
    const second = {
      x: start.x + (end.x - start.x) * 0.78 + normal.x * bend * 0.4,
      y: start.y + (end.y - start.y) * 0.78 + normal.y * bend * 0.4,
    };

    // The page draws the cursor along the curve at its own frame rate; a few real mouse
    // events follow the same curve, so hover styles still light up on the way.
    const path = [start, first, second, end].flatMap((point) => [point.x, point.y]);
    const glide = this.page.evaluate(
      ([points, ms]) => window.__showcase?.glide(points as number[], ms as number),
      [path, duration] as const,
    );
    const began = Date.now();
    for (let step = 1; step <= HOVER_EVENTS; step += 1) {
      await sleep(began + (duration * step) / HOVER_EVENTS - Date.now());
      const point = bezier(start, first, second, end, easeInOut(step / HOVER_EVENTS));
      await this.page.mouse.move(point.x, point.y);
    }
    await glide;
    await this.page.mouse.move(end.x, end.y);
    this.position = end;
  }

  async hover(target: Locator) {
    await this.moveTo(target);
    await this.wait(this.between(250, 500));
  }

  async click(target: Locator | Point, options: { button?: "left" | "right" } = {}) {
    await this.moveTo(target);
    await this.wait(this.between(110, 240));
    const { x, y } = this.position;
    await this.page.evaluate(([px, py]) => window.__showcase?.ripple(px, py), [x, y]);
    await this.page.mouse.down({ button: options.button });
    await sleep(this.between(55, 95));
    await this.page.mouse.up({ button: options.button });
    await this.wait(this.between(180, 320));
  }

  // Scrolls by about `distance` pixels in uneven notches, slower at the start and the end.
  async scroll(target: Locator, distance: number) {
    await this.moveTo(target);
    const notches = Math.max(3, Math.round(Math.abs(distance) / 90));
    for (let notch = 0; notch < notches; notch += 1) {
      const middle = 1 - Math.abs(notch / (notches - 1) - 0.5);
      await this.page.mouse.wheel(0, (distance / notches) * (0.7 + 0.6 * middle));
      await this.wait(this.between(45, 85));
    }
    await this.wait(300);
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  async type(text: string, options: { typos?: boolean; pace?: number } = {}) {
    const typos = options.typos ?? this.options.typos;
    const pace = options.pace ?? 1;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const neighbour = KEYBOARD_NEIGHBOURS[character];

      if (typos && neighbour && index > 3 && this.random() < 0.025) {
        await this.page.keyboard.type(neighbour);
        await this.wait(this.between(160, 300) * pace);
        await this.page.keyboard.press("Backspace");
        await this.wait(this.between(90, 160) * pace);
      }

      await this.page.keyboard.type(character);
      let delay = this.between(38, 95);
      if (character === " ") delay += this.between(15, 60);
      if (/[.,:;?!)]/.test(character)) delay += this.between(90, 180);
      if (this.random() < 0.03) delay += this.between(200, 450);
      await this.wait(delay * pace);
    }
  }

  async press(key: string) {
    await this.page.keyboard.press(key);
    await this.wait(this.between(120, 220));
  }

  // ---------------------------------------------------------------------------
  // What the viewer reads
  // ---------------------------------------------------------------------------

  private seconds() {
    return (Date.now() - this.options.startedAt) / 1000;
  }

  private stamp() {
    const seconds = Math.floor(this.seconds());
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  // Every caption becomes a chapter, so a long take can be cut by its timestamps.
  private mark(line: string) {
    this.chapters.push(`${this.stamp()}  ${line}`);
    console.log(`showcase ${this.stamp()} ${line}`);
    fs.writeFileSync(this.options.chaptersFile, this.chapters.join("\n") + "\n");
    fs.writeFileSync(
      this.options.chaptersFile.replace(/\.txt$/, ".json"),
      JSON.stringify({ waits: this.waits }, null, 2) + "\n",
    );
  }

  async caption(kicker: string, title: string, body = "") {
    this.mark(`${kicker}: ${title}`);
    if (this.options.captions) {
      // Long enough to read it twice, then the screen is clear again.
      const holdMs = Math.min(9000, 2200 + 45 * (title.length + body.length)) / this.options.speed;
      await this.page.evaluate(
        ([k, t, b, ms]) => window.__showcase?.caption(k as string, t as string, b as string, ms as number),
        [kicker, title, body, holdMs] as const,
      );
    }
    await this.snapshot(title);
  }

  private snapshotCount = 0;

  private async snapshot(title: string) {
    const folder = this.options.snapshotsFolder;
    if (!folder) return;
    await sleep(450);
    this.snapshotCount += 1;
    const name = `${String(this.snapshotCount).padStart(2, "0")}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.png`;
    fs.mkdirSync(folder, { recursive: true });
    const image = this.options.capture ? await this.options.capture() : await this.page.screenshot();
    fs.writeFileSync(`${folder}/${name}`, image);
  }

  async hideCaption() {
    await this.page.evaluate(() => window.__showcase?.hideCaption());
  }

  // Shows a running clock while a model works; the chapter file marks it as a part to cut.
  async whileWaiting<T>(label: string, work: () => Promise<T>): Promise<T> {
    this.mark(`WAIT start: ${label}`);
    const start = this.seconds();
    await this.page.evaluate((text) => window.__showcase?.startTimer(text), label);
    try {
      return await work();
    } finally {
      await this.page.evaluate(() => window.__showcase?.stopTimer());
      const end = this.seconds();
      this.lastWaitSeconds = end - start;
      this.waits.push({ start, end, label });
      this.mark(`WAIT end: ${label}`);
    }
  }

  async card(kicker: string, title: string, body: string, items: CardItem[], holdMs: number) {
    this.mark(`CARD ${title}`);
    await this.page.evaluate(
      ([k, t, b, i]) => window.__showcase?.card(k, t, b, i),
      [kicker, title, body, items] as const,
    );
    await this.wait(holdMs);
  }

  async hideCard() {
    await this.page.evaluate(() => window.__showcase?.hideCard());
    await sleep(700);
  }
}
