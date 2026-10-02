// What the video shows on top of the app, which the app does not draw itself: a mouse cursor,
// a ripple on each click, captions, a timer while a model works, and the title cards.
// installOverlay runs inside the page (page.evaluate), so it may use nothing from outside itself.

export type CardItem = { label: string; value?: string };

export type ShowcaseOverlay = {
  move(x: number, y: number): void;
  glide(path: number[], durationMs: number): Promise<void>;
  ripple(x: number, y: number): void;
  caption(kicker: string, title: string, body: string, holdMs: number): void;
  hideCaption(): void;
  startTimer(label: string): void;
  stopTimer(): void;
  card(kicker: string, title: string, body: string, items: CardItem[]): void;
  hideCard(): void;
};

declare global {
  interface Window {
    __showcase?: ShowcaseOverlay;
  }
}

export function installOverlay() {
  if (window.__showcase) return;

  const style = document.createElement("style");
  style.textContent = `
    .sc-cursor {
      position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
      width: 24px; height: 24px; transform: translate(-100px, -100px);
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.55));
      transition: scale 0.12s ease;
    }
    .sc-cursor.down { scale: 0.86; }
    .sc-ripple {
      position: fixed; z-index: 2147483646; pointer-events: none;
      width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
      border: 2px solid #61afef; background: rgba(97, 175, 239, 0.18);
      animation: sc-ripple 0.55s ease-out forwards;
    }
    @keyframes sc-ripple { from { scale: 0.3; opacity: 1; } to { scale: 1.6; opacity: 0; } }

    .sc-caption {
      position: fixed; left: 28px; bottom: 40px; z-index: 2147483645; pointer-events: none;
      display: grid; grid-template-columns: auto 1fr; column-gap: 11px; row-gap: 3px;
      max-width: min(540px, calc(100vw - 56px)); padding: 11px 16px 12px 11px;
      border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 10px;
      background: rgba(16, 18, 22, 0.7); backdrop-filter: blur(10px);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
      font-family: Inter, -apple-system, "Segoe UI", Ubuntu, system-ui, sans-serif;
      opacity: 0; translate: 0 8px;
      transition: opacity 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), translate 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .sc-caption.show { opacity: 1; translate: 0 0; }
    .sc-step {
      grid-row: 1; align-self: center; padding: 3px 6px; border-radius: 5px;
      background: rgba(97, 175, 239, 0.14); color: #61afef;
      font: 600 11px/1.2 ui-monospace, "SF Mono", "DejaVu Sans Mono", monospace;
      font-variant-numeric: tabular-nums;
    }
    .sc-title {
      grid-column: 2; font-size: 16.5px; font-weight: 600; line-height: 1.3;
      letter-spacing: -0.01em; color: #f4f6f8;
    }
    .sc-body { grid-column: 2; font-size: 13px; line-height: 1.45; color: #aab2bf; }
    .sc-body:empty { display: none; }

    .sc-timer {
      position: fixed; top: 44px; left: 50%; z-index: 2147483645; pointer-events: none;
      display: flex; align-items: center; gap: 9px; padding: 7px 13px 7px 11px;
      border: 1px solid rgba(97, 175, 239, 0.35); border-radius: 8px;
      background: rgba(16, 18, 22, 0.92); color: #dcdfe4;
      font: 500 12.5px Inter, -apple-system, "Segoe UI", Ubuntu, system-ui, sans-serif;
      opacity: 0; translate: -50% -6px;
      transition: opacity 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), translate 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .sc-timer.show { opacity: 1; translate: -50% 0; }
    .sc-timer b {
      font: 600 12px ui-monospace, "SF Mono", "DejaVu Sans Mono", monospace;
      font-variant-numeric: tabular-nums; color: #61afef;
    }
    .sc-spinner {
      width: 10px; height: 10px; border-radius: 50%;
      border: 1.5px solid rgba(97, 175, 239, 0.25); border-top-color: #61afef;
      animation: sc-spin 0.9s linear infinite;
    }
    @keyframes sc-spin { to { rotate: 360deg; } }

    .sc-card {
      position: fixed; inset: 0; z-index: 2147483644; pointer-events: none;
      display: grid; place-items: center;
      background: radial-gradient(1200px 700px at 30% 20%, #23324a 0%, #14171c 55%, #0d0f12 100%);
      font-family: -apple-system, "Segoe UI", Ubuntu, system-ui, sans-serif;
      opacity: 0; transition: opacity 0.6s ease;
    }
    .sc-card.show { opacity: 1; }
    .sc-card-inner { max-width: 900px; padding: 0 48px; }
    .sc-card-kicker {
      font-size: 13px; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase;
      color: #61afef;
    }
    .sc-card-title {
      margin-top: 14px; font-size: 64px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em;
      background: linear-gradient(90deg, #ffffff 0%, #9fc8f5 60%, #61afef 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .sc-card-body { margin-top: 18px; font-size: 21px; line-height: 1.5; color: #aab2bf; }
    .sc-card-items { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
    .sc-card-item {
      padding: 12px 18px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
      background: rgba(255, 255, 255, 0.04); color: #dcdfe4; font-size: 15px;
      opacity: 0; translate: 0 10px; animation: sc-rise 0.5s ease forwards;
    }
    .sc-card-item b { display: block; font-size: 26px; font-weight: 750; color: #ffffff; }
    @keyframes sc-rise { to { opacity: 1; translate: 0 0; } }
  `;
  document.head.appendChild(style);

  const cursor = document.createElement("div");
  cursor.className = "sc-cursor";
  cursor.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M4 2.5 L4 19.5 L8.6 15.4 L11.5 21.8 L14.6 20.4 L11.7 14.1 L17.8 14.1 Z"
      fill="#ffffff" stroke="#111318" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  document.body.appendChild(cursor);

  const caption = document.createElement("div");
  caption.className = "sc-caption";
  caption.innerHTML = `<span class="sc-step"></span><div class="sc-title"></div><div class="sc-body"></div>`;
  document.body.appendChild(caption);

  const timer = document.createElement("div");
  timer.className = "sc-timer";
  timer.innerHTML = `<span class="sc-spinner"></span><span class="sc-timer-label"></span><b>0:00</b>`;
  document.body.appendChild(timer);

  const card = document.createElement("div");
  card.className = "sc-card";
  document.body.appendChild(card);

  let timerInterval: ReturnType<typeof setInterval> | undefined;
  let captionTimeout: ReturnType<typeof setTimeout> | undefined;

  function move(x: number, y: number) {
    cursor.style.transform = `translate(${x - 4}px, ${y - 2.5}px)`;
  }

  // The cursor is drawn by glide(), frame by frame, not by the mouse events: the title bar is a
  // window-drag region that swallows them, and on a busy CPU they arrive in bursts.
  function glide(path: number[], durationMs: number) {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = path;
    const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
    const started = performance.now();
    return new Promise<void>((resolve) => {
      function frame(now: number) {
        const t = Math.min(1, (now - started) / durationMs);
        const e = ease(t);
        const u = 1 - e;
        move(
          u ** 3 * x0 + 3 * u ** 2 * e * x1 + 3 * u * e ** 2 * x2 + e ** 3 * x3,
          u ** 3 * y0 + 3 * u ** 2 * e * y1 + 3 * u * e ** 2 * y2 + e ** 3 * y3,
        );
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }
  document.addEventListener("mousedown", () => cursor.classList.add("down"), true);
  document.addEventListener("mouseup", () => cursor.classList.remove("down"), true);

  function setText(parent: Element, selector: string, text: string) {
    parent.querySelector(selector)!.textContent = text;
  }

  window.__showcase = {
    move,
    glide,

    ripple(x, y) {
      const ring = document.createElement("div");
      ring.className = "sc-ripple";
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 700);
    },

    caption(kicker, title, body, holdMs) {
      // "08 · Chat" shows as its number only: the title already says what the scene is.
      // It leaves once read, so it never hides the screen for the rest of the scene.
      clearTimeout(captionTimeout);
      const apply = () => {
        setText(caption, ".sc-step", kicker.split(" · ")[0]);
        setText(caption, ".sc-title", title);
        setText(caption, ".sc-body", body);
        caption.classList.add("show");
        captionTimeout = setTimeout(() => caption.classList.remove("show"), holdMs);
      };
      // A caption replacing another one fades out first, so its text never swaps in place.
      if (caption.classList.contains("show")) {
        caption.classList.remove("show");
        setTimeout(apply, 200);
      } else {
        apply();
      }
    },

    hideCaption() {
      clearTimeout(captionTimeout);
      caption.classList.remove("show");
    },

    startTimer(label) {
      const started = Date.now();
      setText(timer, ".sc-timer-label", label);
      setText(timer, "b", "0:00");
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - started) / 1000);
        setText(timer, "b", `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`);
      }, 250);
      timer.classList.add("show");
    },

    stopTimer() {
      clearInterval(timerInterval);
      timer.classList.remove("show");
    },

    card(kicker, title, body, items) {
      card.innerHTML = `<div class="sc-card-inner">
        <div class="sc-card-kicker"></div><div class="sc-card-title"></div>
        <div class="sc-card-body"></div><div class="sc-card-items"></div></div>`;
      setText(card, ".sc-card-kicker", kicker);
      setText(card, ".sc-card-title", title);
      setText(card, ".sc-card-body", body);
      items.forEach((item, index) => {
        const chip = document.createElement("div");
        chip.className = "sc-card-item";
        chip.style.animationDelay = `${0.5 + index * 0.18}s`;
        if (item.value) {
          const value = document.createElement("b");
          value.textContent = item.value;
          chip.appendChild(value);
        }
        chip.appendChild(document.createTextNode(item.label));
        card.querySelector(".sc-card-items")!.appendChild(chip);
      });
      card.classList.add("show");
    },

    hideCard() {
      card.classList.remove("show");
    },
  };

  // A native dialog would stop the run and look out of place in the video.
  window.confirm = () => true;
  window.alert = (message) => console.log(`WARNING: alert: ${message}`);
}
