// Records the screen with ffmpeg (x11grab): Playwright's own video recording stops an Electron 44
// page from loading at all. The fast x264 preset leaves the CPU to the models; the cut
// (setup/cut_video.py) encodes the final .mp4 properly.

import { spawn, type ChildProcess } from "node:child_process";

const STOP_TIMEOUT_MS = 15_000;

export type Area = { x: number; y: number; width: number; height: number };

export class ScreenRecorder {
  readonly startedAt: number;
  private process: ChildProcess;

  constructor(ffmpeg: string, display: string, area: Area, file: string) {
    this.process = spawn(
      ffmpeg,
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "x11grab", "-draw_mouse", "0", "-framerate", "30",
        "-video_size", `${area.width}x${area.height}`,
        "-i", `${display}+${area.x},${area.y}`,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p",
        file,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    this.startedAt = Date.now();
  }

  // "q" lets ffmpeg close the file properly; a kill would leave it unreadable.
  async stop() {
    if (this.process.exitCode !== null) return;
    const exited = new Promise((resolve) => this.process.once("exit", resolve));
    this.process.stdin?.end("q");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS))]);
    if (this.process.exitCode === null) this.process.kill("SIGINT");
  }
}
