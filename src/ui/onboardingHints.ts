import { isKeyPressed } from "../controls/keyboardController";

// ─── Step definitions ────────────────────────────────────────────────────────

type StepId = "move" | "sprint" | "click";
type DismissOn = "movement" | "run" | "timeout";

interface Step {
  id: StepId;
  dismissOn: DismissOn;
  timeoutMs: number;
}

const STEPS: Step[] = [
  { id: "move",   dismissOn: "movement", timeoutMs: 25_000 },
  { id: "sprint", dismissOn: "run",      timeoutMs: 12_000 },
  { id: "click",  dismissOn: "timeout",  timeoutMs: 7_000  },
];

// ─── State ───────────────────────────────────────────────────────────────────

let cardEl: HTMLDivElement | null = null;
let dotsEl: HTMLDivElement | null = null;
let currentStep = -1;
let stepElapsed = 0;
let isExiting = false;
let isActive = false;

let clickHandler: ((e: MouseEvent) => void) | null = null;
let lastNudgeTime = 0;
let nudgeTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Styles (injected once) ─────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("ob-styles")) return;
  const s = document.createElement("style");
  s.id = "ob-styles";
  s.textContent = `
    #ob-card {
      position: fixed;
      bottom: 52px;
      left: 50%;
      transform: translateX(-50%) translateY(16px);
      z-index: 900;
      pointer-events: none;

      display: flex;
      align-items: center;
      gap: 0.9rem;

      padding: 0.75rem 1.25rem;
      border-radius: 14px;
      background: rgba(6, 10, 20, 0.78);
      border: 1px solid rgba(0, 229, 204, 0.14);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow:
        0 6px 28px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(0, 229, 204, 0.05) inset;

      opacity: 0;
      transition:
        opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);

      white-space: nowrap;
      max-width: 92vw;
    }

    #ob-card.ob-enter {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    #ob-card.ob-exit {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }

    /* ── Nudge bounce when user clicks canvas during movement step ── */

    @keyframes obNudge {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      12%  { transform: translateX(-50%) translateY(-10px) scale(1.04); }
      28%  { transform: translateX(-50%) translateY(2px) scale(0.99); }
      42%  { transform: translateX(-50%) translateY(-4px); }
      58%  { transform: translateX(-50%) translateY(0); }
    }

    #ob-card.ob-nudge {
      animation: obNudge 0.7s ease-out;
    }

    @keyframes obKeyFlash {
      0%, 100% { background: rgba(0, 229, 204, 0.08); }
      25%  { background: rgba(0, 229, 204, 0.4); border-color: rgba(0, 229, 204, 0.7); }
    }

    #ob-card.ob-nudge .ob-key {
      animation: obKeyFlash 0.7s ease-out;
    }

    .ob-nudge-text {
      position: absolute;
      top: -26px;
      left: 50%;
      transform: translateX(-50%);
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 0.68rem;
      font-weight: 600;
      color: rgba(0, 229, 204, 0.88);
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .ob-nudge-text.ob-nudge-show {
      opacity: 1;
    }

    /* ── Arrow key cluster (2-row grid) ── */

    .ob-arrow-cluster {
      display: grid;
      grid-template-columns: repeat(3, 30px);
      grid-template-rows: repeat(2, 30px);
      gap: 3px;
    }

    .ob-key-up    { grid-column: 2; grid-row: 1; }
    .ob-key-left  { grid-column: 1; grid-row: 2; }
    .ob-key-down  { grid-column: 2; grid-row: 2; }
    .ob-key-right { grid-column: 3; grid-row: 2; }

    /* ── Key badge (shared) ── */

    .ob-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 30px;
      padding: 0 6px;
      border-radius: 6px;
      background: rgba(0, 229, 204, 0.08);
      border: 1px solid rgba(0, 229, 204, 0.3);
      border-bottom: 2.5px solid rgba(0, 229, 204, 0.45);
      font-family: system-ui, -apple-system, 'Segoe UI', monospace;
      font-size: 0.82rem;
      font-weight: 700;
      color: rgba(0, 229, 204, 0.88);
      line-height: 1;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
      transition: background 0.3s, border-color 0.3s;
    }

    .ob-key-wide {
      min-width: 68px;
      font-size: 0.74rem;
    }

    @keyframes obKeyPulse {
      0%, 100% {
        background: rgba(0, 229, 204, 0.08);
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
      }
      50% {
        background: rgba(0, 229, 204, 0.22);
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4), 0 0 14px rgba(0, 229, 204, 0.2);
      }
    }

    .ob-key-pulse {
      animation: obKeyPulse 1.8s ease-in-out infinite;
    }

    /* ── Small inline keys (WASD alternative) ── */

    .ob-key-sm {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 3px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.13);
      font-family: system-ui, monospace;
      font-size: 0.55rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.35);
      line-height: 1;
      vertical-align: middle;
      margin: 0 1px;
    }

    /* ── Layout helpers ── */

    .ob-divider {
      width: 1px;
      height: 28px;
      background: rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }

    .ob-label-main {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 0.8rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.68);
      letter-spacing: 0.01em;
      line-height: 1.35;
    }

    .ob-label-alt {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 0.62rem;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.28);
      margin-top: 3px;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    /* ── Mouse icon (click step) ── */

    .ob-mouse-icon {
      width: 20px;
      height: 30px;
      border: 1.5px solid rgba(0, 229, 204, 0.4);
      border-radius: 10px;
      position: relative;
      flex-shrink: 0;
    }

    .ob-mouse-wheel {
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 2.5px;
      height: 5px;
      border-radius: 1.5px;
      background: rgba(0, 229, 204, 0.55);
    }

    .ob-mouse-btn {
      position: absolute;
      top: 0;
      left: 0;
      width: 50%;
      height: 40%;
      border-radius: 10px 0 0 0;
      background: rgba(0, 229, 204, 0.15);
      animation: obMouseClick 1.6s ease-in-out infinite;
    }

    @keyframes obMouseClick {
      0%, 55%, 100% { opacity: 0.15; }
      8%  { opacity: 0.55; }
      16% { opacity: 0.15; }
    }

    /* ── Step indicator dots ── */

    #ob-dots {
      position: fixed;
      bottom: 36px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 900;
      display: flex;
      gap: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    #ob-dots.ob-dots-visible {
      opacity: 1;
    }

    .ob-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      transition: background 0.3s ease, transform 0.3s ease;
    }

    .ob-dot.ob-dot-active {
      background: rgba(0, 229, 204, 0.65);
      transform: scale(1.3);
    }

    .ob-dot.ob-dot-done {
      background: rgba(0, 229, 204, 0.28);
    }
  `;
  document.body.appendChild(s);
}

// ─── Per-step renderers ──────────────────────────────────────────────────────

function renderStep(step: Step): void {
  if (!cardEl) return;

  switch (step.id) {
    case "move":
      cardEl.innerHTML = `
        <div class="ob-arrow-cluster">
          <span class="ob-key ob-key-up ob-key-pulse">↑</span>
          <span class="ob-key ob-key-left">←</span>
          <span class="ob-key ob-key-down">↓</span>
          <span class="ob-key ob-key-right">→</span>
        </div>
        <div class="ob-divider"></div>
        <div>
          <div class="ob-label-main">Use arrow keys to walk</div>
          <div class="ob-label-alt">or
            <span class="ob-key-sm">W</span>
            <span class="ob-key-sm">A</span>
            <span class="ob-key-sm">S</span>
            <span class="ob-key-sm">D</span>
          </div>
        </div>
        <span class="ob-nudge-text" id="ob-nudge-text">↓ Use your keyboard</span>
      `;
      attachClickInterceptor();
      break;

    case "sprint":
      removeClickInterceptor();
      cardEl.innerHTML = `
        <span class="ob-key ob-key-wide ob-key-pulse">⇧ Shift</span>
        <div class="ob-divider"></div>
        <div class="ob-label-main">Hold to run faster</div>
      `;
      break;

    case "click":
      cardEl.innerHTML = `
        <div class="ob-mouse-icon">
          <div class="ob-mouse-btn"></div>
          <div class="ob-mouse-wheel"></div>
        </div>
        <div class="ob-divider"></div>
        <div>
          <div class="ob-label-main">Click on glowing objects</div>
          <div class="ob-label-alt">to discover more</div>
        </div>
      `;
      break;
  }
}

// ─── Click interceptor (movement step only) ──────────────────────────────────
// Non-gamers instinctively click the screen. When they do, bounce the card and
// flash "Use your keyboard" so they learn without feeling scolded.

function attachClickInterceptor(): void {
  if (clickHandler) return;

  clickHandler = (e: MouseEvent) => {
    if (currentStep !== 0 || !cardEl || isExiting) return;

    const target = e.target as HTMLElement;
    if (target.closest("#cv-btn, #cv-overlay, .unlock-toast, #ob-card")) return;

    const now = Date.now();
    if (now - lastNudgeTime < 3000) return;
    lastNudgeTime = now;

    // Bounce the card
    cardEl.classList.remove("ob-nudge");
    void cardEl.offsetWidth; // reflow to restart animation
    cardEl.classList.add("ob-nudge");

    // Show nudge text
    const nudgeText = document.getElementById("ob-nudge-text");
    if (nudgeText) {
      nudgeText.classList.add("ob-nudge-show");
      if (nudgeTimer) clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(() => {
        nudgeText?.classList.remove("ob-nudge-show");
      }, 2500);
    }

    setTimeout(() => cardEl?.classList.remove("ob-nudge"), 700);
  };

  document.addEventListener("mousedown", clickHandler);
}

function removeClickInterceptor(): void {
  if (clickHandler) {
    document.removeEventListener("mousedown", clickHandler);
    clickHandler = null;
  }
  if (nudgeTimer) {
    clearTimeout(nudgeTimer);
    nudgeTimer = null;
  }
}

// ─── DOM builders ────────────────────────────────────────────────────────────

function buildCard(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "ob-card";
  document.body.appendChild(el);
  return el;
}

function buildDots(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "ob-dots";
  for (let i = 0; i < STEPS.length; i++) {
    const dot = document.createElement("div");
    dot.className = "ob-dot";
    el.appendChild(dot);
  }
  document.body.appendChild(el);
  return el;
}

function updateDots(activeIdx: number): void {
  if (!dotsEl) return;
  const dots = dotsEl.querySelectorAll<HTMLDivElement>(".ob-dot");
  dots.forEach((dot, i) => {
    dot.className = "ob-dot";
    if (i < activeIdx) dot.classList.add("ob-dot-done");
    else if (i === activeIdx) dot.classList.add("ob-dot-active");
  });
}

// ─── Step lifecycle ──────────────────────────────────────────────────────────

function showStep(idx: number): void {
  if (idx >= STEPS.length) {
    finishOnboarding();
    return;
  }

  const step = STEPS[idx];
  if (!step || !cardEl || !dotsEl) return;

  currentStep = idx;
  stepElapsed = 0;
  isExiting = false;

  renderStep(step);

  if (idx === 0) dotsEl.classList.add("ob-dots-visible");
  updateDots(idx);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cardEl?.classList.remove("ob-exit");
      cardEl?.classList.add("ob-enter");
    });
  });
}

function dismissStep(): void {
  if (isExiting) return;
  isExiting = true;

  if (currentStep === 0) removeClickInterceptor();

  cardEl?.classList.remove("ob-enter");
  cardEl?.classList.add("ob-exit");

  setTimeout(() => {
    const next = currentStep + 1;
    if (next < STEPS.length) showStep(next);
    else finishOnboarding();
  }, 450);
}

function finishOnboarding(): void {
  isActive = false;
  removeClickInterceptor();

  if (cardEl) {
    cardEl.classList.remove("ob-enter");
    cardEl.classList.add("ob-exit");
    setTimeout(() => {
      cardEl?.remove();
      cardEl = null;
    }, 500);
  }

  if (dotsEl) {
    dotsEl.classList.remove("ob-dots-visible");
    setTimeout(() => {
      dotsEl?.remove();
      dotsEl = null;
    }, 500);
  }

  setTimeout(() => showDirectionalHint(), 600);
}

// ─── Post-onboarding directional hint ────────────────────────────────────────

function showDirectionalHint(): void {
  const el = document.createElement("div");
  el.id = "ob-direction";
  el.style.cssText = `
    position: fixed;
    bottom: 52px;
    left: 50%;
    transform: translateX(-50%) translateY(8px);
    z-index: 900;
    pointer-events: none;
    padding: 0.55rem 1.2rem;
    border-radius: 12px;
    background: rgba(6, 10, 20, 0.6);
    border: 1px solid rgba(0, 229, 204, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 0.78rem;
    font-weight: 500;
    color: rgba(0, 229, 204, 0.55);
    text-align: center;
    opacity: 0;
    transition: opacity 0.6s ease, transform 0.6s ease;
    letter-spacing: 0.02em;
    white-space: nowrap;
  `;
  el.textContent = "\u2191  Walk toward the glowing portals ahead";
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
    });
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(-8px)";
    setTimeout(() => el.remove(), 600);
  }, 5000);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Call once when the intro sequence ends. */
export function startOnboarding(): void {
  injectStyles();

  const legacy = document.getElementById("controls-hint");
  if (legacy) {
    legacy.style.transition = "opacity 0.4s ease";
    legacy.style.opacity = "0";
    legacy.style.pointerEvents = "none";
  }

  cardEl = buildCard();
  dotsEl = buildDots();

  isActive = true;
  isExiting = false;
  currentStep = -1;
  stepElapsed = 0;
  lastNudgeTime = 0;

  setTimeout(() => showStep(0), 800);
}

/**
 * Call every frame while gameplay is active.
 * @param deltaSec Frame delta in seconds
 */
export function updateOnboarding(deltaSec: number): void {
  if (!isActive || isExiting || currentStep < 0) return;

  const step = STEPS[currentStep];
  if (!step) return;

  stepElapsed += deltaSec * 1000;

  const movementPressed =
    isKeyPressed("KeyW") ||
    isKeyPressed("KeyS") ||
    isKeyPressed("KeyA") ||
    isKeyPressed("KeyD") ||
    isKeyPressed("ArrowUp") ||
    isKeyPressed("ArrowDown") ||
    isKeyPressed("ArrowLeft") ||
    isKeyPressed("ArrowRight");

  const runPressed =
    movementPressed &&
    (isKeyPressed("ShiftLeft") || isKeyPressed("ShiftRight"));

  let shouldDismiss = false;

  if (step.dismissOn === "movement" && movementPressed) {
    shouldDismiss = stepElapsed > 600;
  } else if (step.dismissOn === "run" && runPressed) {
    shouldDismiss = true;
  } else if (stepElapsed >= step.timeoutMs) {
    shouldDismiss = true;
  }

  if (shouldDismiss) {
    dismissStep();
  }
}

/** Whether the onboarding system is currently showing hints. */
export function isOnboardingActive(): boolean {
  return isActive;
}
