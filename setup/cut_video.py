"""Cuts a showcase recording into an .mp4 ready to post.

    python setup/cut_video.py                 the newest recording in .showcase/videos
    python setup/cut_video.py <video.mkv>

Every wait for a model (the "waits" of .showcase/chapters.json, written by the take) is sped
up so it lasts SHOWCASE_WAIT_SECONDS at most, and at least 4 times faster; the rest plays at
its real pace. The clock the film shows during a wait keeps the real time, so the cut stays
honest. The chapters belong to the last take, so cut a video right after it was recorded.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

REPO = Path(__file__).resolve().parent.parent
SHOWCASE = REPO / ".showcase"
CHAPTERS = SHOWCASE / "chapters.json"
WAIT_SECONDS = float(os.environ.get("SHOWCASE_WAIT_SECONDS", 6))
MIN_SPEEDUP = 4
SHORTEST_WAIT = 1.0
FPS = 30


def newest_video():
    recordings = [*(SHOWCASE / "videos").glob("*.mkv"), *(SHOWCASE / "videos").glob("*.webm")]
    videos = sorted(recordings, key=lambda path: path.stat().st_mtime)
    return videos[-1] if videos else None


def segments(waits, duration):
    # (start, end, speed-up) pieces that cover the whole video, in order.
    pieces = []
    cursor = 0.0
    for wait in sorted(waits, key=lambda wait: wait["start"]):
        start = max(wait["start"], cursor)
        end = min(wait["end"], duration)
        if end - start < SHORTEST_WAIT:
            continue
        if start > cursor:
            pieces.append((cursor, start, 1.0))
        pieces.append((start, end, max(MIN_SPEEDUP, (end - start) / WAIT_SECONDS)))
        cursor = end
    if cursor < duration:
        pieces.append((cursor, duration, 1.0))
    return pieces


def filter_graph(pieces):
    parts = []
    for index, (start, end, speedup) in enumerate(pieces):
        parts.append(
            f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=(PTS-STARTPTS)/{speedup:.3f}[v{index}]"
        )
    inputs = "".join(f"[v{index}]" for index in range(len(pieces)))
    parts.append(f"{inputs}concat=n={len(pieces)}:v=1:a=0,fps={FPS},format=yuv420p[out]")
    return ";".join(parts)


def main():
    video = Path(sys.argv[1]) if len(sys.argv) > 1 else newest_video()
    if video is None or not video.is_file():
        print("no video to cut: record one with SHOWCASE_RECORD=1 make showcase")
        return 1

    waits = json.loads(CHAPTERS.read_text(encoding="utf-8"))["waits"] if CHAPTERS.is_file() else []
    _, duration = imageio_ffmpeg.count_frames_and_secs(str(video))
    pieces = segments(waits, duration)
    output = video.with_suffix(".mp4")

    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-loglevel", "error",
        "-i", str(video),
        "-filter_complex", filter_graph(pieces),
        "-map", "[out]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-movflags", "+faststart",
        str(output),
    ]
    result = subprocess.run(command)
    if result.returncode != 0:
        print(f"ffmpeg failed on {video}")
        return result.returncode

    _, cut = imageio_ffmpeg.count_frames_and_secs(str(output))
    sped_up = sum(1 for piece in pieces if piece[2] > 1)
    print(f"{output.relative_to(REPO)}: {duration:.0f} s cut to {cut:.0f} s, {sped_up} waits sped up")
    return 0


if __name__ == "__main__":
    sys.exit(main())
