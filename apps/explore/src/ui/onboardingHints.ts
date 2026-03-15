import { isKeyPressed } from "../controls/keyboardController";
import { isTouchDevice } from "./mobileControls";

// ─── Mobile callbacks (set by startOnboarding, fired by mobileControls) ──────
// These are set as side-effects on the exported objects in mobileControls.ts.
// We import the module and assign after init.
import { setOnFirstJoystickMove, setOnFirstSprintPress } from "./mobileControls";

// ─────────────────────────────────────────────────────────────────────────────
//  Onboarding Hints  —  Adaptive tutorial for desktop + mobile
//
//  Desktop:  Arrow key cluster  →  Shift sprint  →  Click objects
//  Mobile:   Joystick drag      →  Sprint button  →  Tap objects
//
//  Design:   Tactical terminal-aesthetic card. Scanline entry animation.
//            Progress represented as numbered steps with connector line.
// ─────────────────────────────────────────────────────────────────────────────

type StepId  = "move" | "sprint" | "tap";
type Dismiss = "movement" | "run" | "timeout";

interface Step {
  id:        StepId;
  dismissOn: Dismiss;
  timeoutMs: number;
}

// ─── Steps (same IDs, different renders for mobile vs desktop) ───────────────
const STEPS: Step[] = [
  { id: "move",   dismissOn: "movement", timeoutMs: 28_000 },
  { id: "sprint", dismissOn: "run",      timeoutMs: 14_000 },
  { id: "tap",    dismissOn: "timeout",  timeoutMs: 8_000  },
];

// ─── State ────────────────────────────────────────────────────────────────────
let cardEl:    HTMLDivElement | null = null;
let stepsEl:   HTMLDivElement | null = null;
let currentStep  = -1;
let stepElapsed  = 0;
let isExiting    = false;
let isActive     = false;
let isMobile     = false;

// For keyboard nudge
let clickHandler:  ((e: MouseEvent) => void) | null = null;
let lastNudgeTime  = 0;
let nudgeTimer:    ReturnType<typeof setTimeout> | null = null;

// For mobile dismissal
let touchMoveDetected  = false;
let touchSprintDetected = false;

// ─── SVG icons ────────────────────────────────────────────────────────────────
const SVG_LIGHTNING = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
const SVG_FINGER    = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M6 14v-3a2 2 0 0 0-2-2"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8 2 2 0 1 1 4 0"/></svg>`;
const SVG_MOUSE     = `<svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="1.5" width="15" height="19" rx="7.5"/><line x1="9" y1="5.5" x2="9" y2="9.5"/><line x1="7" y1="1.5" x2="7" y2="8" stroke-width="0"/><path d="M1.5 8 H7.5" stroke-dasharray="0"/></svg>`;

// ─── Styles ───────────────────────────────────────────────────────────────────
function injectStyles(): void {
  if (document.getElementById("ob-styles")) return;
  const s = document.createElement("style");
  s.id = "ob-styles";
  s.textContent = `
    /* ── Card wrapper ──────────────────────────── */
    #ob-card {
      position: fixed;
      bottom: 52px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      z-index: 900;
      pointer-events: none;

      display: flex;
      align-items: center;
      gap: 1rem;

      padding: 0.8rem 1.4rem;
      border-radius: 12px;

      background: rgba(5, 9, 18, 0.82);
      border: 1px solid rgba(0, 229, 204, 0.16);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(0, 229, 204, 0.05) inset,
        0 0 48px rgba(0, 229, 204, 0.03);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);

      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      opacity: 0;
      white-space: nowrap;
      max-width: 94vw;

      transition:
        opacity  0.42s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Scanline overlay on card */
    #ob-card::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 229, 204, 0.012) 2px,
        rgba(0, 229, 204, 0.012) 4px
      );
      pointer-events: none;
    }

    #ob-card.ob-enter {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    #ob-card.ob-exit {
      opacity: 0;
      transform: translateX(-50%) translateY(-12px);
    }

    /* ── Nudge animation (desktop click attempt) ─ */
    @keyframes obNudge {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      15%  { transform: translateX(-50%) translateY(-12px) scale(1.03); }
      32%  { transform: translateX(-50%) translateY(2px) scale(0.99); }
      48%  { transform: translateX(-50%) translateY(-5px); }
      64%  { transform: translateX(-50%) translateY(0); }
    }
    #ob-card.ob-nudge { animation: obNudge 0.65s ease-out; }

    @keyframes obKeyFlash {
      0%, 100% { background: rgba(0, 229, 204, 0.08); }
      28%  { background: rgba(0, 229, 204, 0.38); border-color: rgba(0, 229, 204, 0.65); }
    }
    #ob-card.ob-nudge .ob-key { animation: obKeyFlash 0.65s ease-out; }

    .ob-nudge-text {
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.66rem;
      font-weight: 600;
      color: rgba(0, 229, 204, 0.9);
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.28s ease;
      pointer-events: none;
      background: rgba(5, 9, 18, 0.75);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      border: 1px solid rgba(0, 229, 204, 0.18);
    }
    .ob-nudge-text.ob-nudge-show { opacity: 1; }

    /* ── Arrow key cluster ──────────────────────── */
    .ob-arrow-cluster {
      display: grid;
      grid-template-columns: repeat(3, 28px);
      grid-template-rows: repeat(2, 28px);
      gap: 3px;
      flex-shrink: 0;
    }
    .ob-key-up    { grid-column: 2; grid-row: 1; }
    .ob-key-left  { grid-column: 1; grid-row: 2; }
    .ob-key-down  { grid-column: 2; grid-row: 2; }
    .ob-key-right { grid-column: 3; grid-row: 2; }

    /* ── Key badge ──────────────────────────────── */
    .ob-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 5px;
      border-radius: 5px;
      background: rgba(0, 229, 204, 0.07);
      border: 1px solid rgba(0, 229, 204, 0.28);
      border-bottom: 2px solid rgba(0, 229, 204, 0.42);
      font-family: system-ui, monospace;
      font-size: 0.8rem;
      font-weight: 700;
      color: rgba(0, 229, 204, 0.88);
      line-height: 1;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
      transition: background 0.28s, border-color 0.28s;
    }
    .ob-key-wide {
      min-width: 66px;
      font-size: 0.72rem;
    }

    @keyframes obKeyPulse {
      0%, 100% { background: rgba(0, 229, 204, 0.07); box-shadow: 0 1px 0 rgba(0,0,0,0.4); }
      50%  { background: rgba(0, 229, 204, 0.2); box-shadow: 0 1px 0 rgba(0,0,0,0.4), 0 0 12px rgba(0,229,204,0.18); }
    }
    .ob-key-pulse { animation: obKeyPulse 1.9s ease-in-out infinite; }

    /* ── Small alt-key badges ───────────────────── */
    .ob-key-sm {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 14px; height: 14px; padding: 0 2px;
      border-radius: 3px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.12);
      font-family: system-ui, monospace; font-size: 0.52rem; font-weight: 700;
      color: rgba(255,255,255,0.32); line-height: 1;
      vertical-align: middle; margin: 0 1px;
    }

    /* ── Mobile joystick mini-illustration ──────── */
    .ob-joy-mini {
      position: relative;
      width: 52px; height: 52px;
      flex-shrink: 0;
    }
    .ob-joy-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1.5px solid rgba(0, 229, 204, 0.3);
      background: rgba(0, 229, 204, 0.05);
    }
    .ob-joy-thumb-mini {
      position: absolute;
      top: 50%; left: 50%;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 32%, rgba(0,229,204,0.6), rgba(0,140,120,0.25));
      border: 1.5px solid rgba(0, 229, 204, 0.65);
      box-shadow: 0 0 8px rgba(0,229,204,0.3);
      transform: translate(-50%, -50%);
      animation: obJoyDrag 2.4s ease-in-out infinite;
    }
    @keyframes obJoyDrag {
      0%   { transform: translate(-50%, -50%); }
      20%  { transform: translate(calc(-50% + 12px), calc(-50% - 8px)); }
      45%  { transform: translate(calc(-50% + 8px), calc(-50% + 11px)); }
      70%  { transform: translate(calc(-50% - 12px), calc(-50% + 6px)); }
      88%  { transform: translate(calc(-50% - 6px), calc(-50% - 10px)); }
      100% { transform: translate(-50%, -50%); }
    }

    /* ── Mobile sprint button mini ──────────────── */
    .ob-sprint-mini {
      width: 46px; height: 46px;
      border-radius: 50%;
      border: 1.5px solid rgba(255, 165, 50, 0.5);
      background: rgba(255, 145, 30, 0.12);
      color: rgba(255, 185, 80, 0.9);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      animation: obSprintPulse 1.6s ease-in-out infinite;
    }
    @keyframes obSprintPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,165,50,0.2); }
      50%  { box-shadow: 0 0 0 7px rgba(255,165,50,0); }
    }

    /* ── Finger tap icon (mobile click step) ────── */
    .ob-tap-icon {
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(0, 229, 204, 0.75);
      flex-shrink: 0;
      animation: obTapAnim 1.8s ease-in-out infinite;
    }
    @keyframes obTapAnim {
      0%, 60%, 100% { transform: scale(1); opacity: 1; }
      30% { transform: scale(0.88); opacity: 0.75; }
    }

    /* ── Mouse icon (desktop click step) ────────── */
    .ob-mouse-wrap {
      color: rgba(0, 229, 204, 0.75);
      flex-shrink: 0;
      animation: obMouseClick 1.7s ease-in-out infinite;
    }
    @keyframes obMouseClick {
      0%, 55%, 100% { opacity: 0.75; }
      10% { opacity: 1; }
      20% { opacity: 0.75; }
    }

    /* ── Text helpers ───────────────────────────── */
    .ob-divider {
      width: 1px; height: 26px;
      background: rgba(255, 255, 255, 0.07);
      flex-shrink: 0;
    }
    .ob-label-main {
      font-size: 0.8rem; font-weight: 500;
      color: rgba(255, 255, 255, 0.72);
      letter-spacing: 0.01em; line-height: 1.35;
    }
    .ob-label-alt {
      font-size: 0.6rem; font-weight: 400;
      color: rgba(255, 255, 255, 0.3);
      margin-top: 3px;
      display: flex; align-items: center; gap: 3px;
    }

    /* ── Step indicator ─────────────────────────── */
    #ob-steps {
      position: fixed;
      bottom: 36px; left: 50%;
      transform: translateX(-50%);
      z-index: 900;
      display: flex;
      align-items: center;
      gap: 0;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s ease;
    }
    #ob-steps.ob-steps-show { opacity: 1; }

    .ob-step-pip {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      transition: background 0.3s, transform 0.3s, width 0.3s;
    }
    .ob-step-pip.ob-pip-done {
      background: rgba(0, 229, 204, 0.28);
    }
    .ob-step-pip.ob-pip-active {
      background: rgba(0, 229, 204, 0.72);
      transform: scale(1.35);
      width: 14px;
      border-radius: 3px;
    }
    .ob-step-line {
      width: 16px; height: 1px;
      background: rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }
    .ob-step-line.ob-line-done {
      background: rgba(0, 229, 204, 0.22);
    }
  `;
  document.body.appendChild(s);
}

// ─── Per-step HTML renderers ──────────────────────────────────────────────────
function renderStep(step: Step): void {
  if (!cardEl) return;

  if (isMobile) {
    renderMobileStep(step);
  } else {
    renderDesktopStep(step);
  }
}

function renderMobileStep(step: Step): void {
  if (!cardEl) return;

  switch (step.id) {
    case "move":
      cardEl.innerHTML = `
        <div class="ob-joy-mini" aria-hidden="true">
          <div class="ob-joy-ring"></div>
          <div class="ob-joy-thumb-mini"></div>
        </div>
        <div class="ob-divider"></div>
        <div>
          <div class="ob-label-main">Drag joystick to walk</div>
          <div class="ob-label-alt">bottom-left corner</div>
        </div>
      `;
      break;

    case "sprint":
      cardEl.innerHTML = `
        <div class="ob-sprint-mini" aria-hidden="true">${SVG_LIGHTNING}</div>
        <div class="ob-divider"></div>
        <div class="ob-label-main">Hold Sprint to run</div>
      `;
      break;

    case "tap":
      cardEl.innerHTML = `
        <div class="ob-tap-icon" aria-hidden="true">${SVG_FINGER}</div>
        <div class="ob-divider"></div>
        <div>
          <div class="ob-label-main">Tap glowing objects</div>
          <div class="ob-label-alt">to discover more</div>
        </div>
      `;
      break;
  }
}

function renderDesktopStep(step: Step): void {
  if (!cardEl) return;

  switch (step.id) {
    case "move":
      cardEl.innerHTML = `
        <div class="ob-arrow-cluster" aria-label="Arrow keys">
          <span class="ob-key ob-key-up ob-key-pulse" aria-hidden="true">↑</span>
          <span class="ob-key ob-key-left" aria-hidden="true">←</span>
          <span class="ob-key ob-key-down" aria-hidden="true">↓</span>
          <span class="ob-key ob-key-right" aria-hidden="true">→</span>
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
        <span class="ob-nudge-text" id="ob-nudge-text">Use your keyboard</span>
      `;
      attachClickInterceptor();
      break;

    case "sprint":
      removeClickInterceptor();
      cardEl.innerHTML = `
        <span class="ob-key ob-key-wide ob-key-pulse" aria-label="Shift key">⇧ Shift</span>
        <div class="ob-divider"></div>
        <div class="ob-label-main">Hold to run faster</div>
      `;
      break;

    case "tap":
      cardEl.innerHTML = `
        <div class="ob-mouse-wrap" aria-hidden="true">${SVG_MOUSE}</div>
        <div class="ob-divider"></div>
        <div>
          <div class="ob-label-main">Click on glowing objects</div>
          <div class="ob-label-alt">to discover more</div>
        </div>
      `;
      break;
  }
}

// ─── Desktop click interceptor ────────────────────────────────────────────────
function attachClickInterceptor(): void {
  if (clickHandler) return;
  clickHandler = (e: MouseEvent) => {
    if (currentStep !== 0 || !cardEl || isExiting) return;
    const target = e.target as HTMLElement;
    if (target.closest("#cv-btn, #cv-overlay, .unlock-toast, #ob-card")) return;

    const now = Date.now();
    if (now - lastNudgeTime < 3000) return;
    lastNudgeTime = now;

    cardEl.classList.remove("ob-nudge");
    void cardEl.offsetWidth;
    cardEl.classList.add("ob-nudge");

    const nudgeText = document.getElementById("ob-nudge-text");
    if (nudgeText) {
      nudgeText.classList.add("ob-nudge-show");
      if (nudgeTimer) clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(() => nudgeText?.classList.remove("ob-nudge-show"), 2500);
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
  if (nudgeTimer) { clearTimeout(nudgeTimer); nudgeTimer = null; }
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function buildStepsEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "ob-steps";
  STEPS.forEach((_, i) => {
    if (i > 0) {
      const line = document.createElement("div");
      line.className = "ob-step-line";
      el.appendChild(line);
    }
    const pip = document.createElement("div");
    pip.className = "ob-step-pip";
    el.appendChild(pip);
  });
  document.body.appendChild(el);
  return el;
}

function updateSteps(activeIdx: number): void {
  if (!stepsEl) return;
  const pips  = stepsEl.querySelectorAll<HTMLDivElement>(".ob-step-pip");
  const lines = stepsEl.querySelectorAll<HTMLDivElement>(".ob-step-line");

  pips.forEach((pip, i) => {
    pip.className = "ob-step-pip";
    if (i < activeIdx)      pip.classList.add("ob-pip-done");
    else if (i === activeIdx) pip.classList.add("ob-pip-active");
  });
  lines.forEach((line, i) => {
    line.className = "ob-step-line";
    if (i < activeIdx) line.classList.add("ob-line-done");
  });
}

// ─── Step lifecycle ───────────────────────────────────────────────────────────
function showStep(idx: number): void {
  if (idx >= STEPS.length) { finishOnboarding(); return; }

  const step = STEPS[idx];
  if (!step || !cardEl || !stepsEl) return;

  currentStep  = idx;
  stepElapsed  = 0;
  isExiting    = false;
  touchMoveDetected  = false;
  touchSprintDetected = false;

  renderStep(step);

  if (idx === 0) stepsEl.classList.add("ob-steps-show");
  updateSteps(idx);

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

  if (!isMobile && currentStep === 0) removeClickInterceptor();

  cardEl?.classList.remove("ob-enter");
  cardEl?.classList.add("ob-exit");

  setTimeout(() => {
    const next = currentStep + 1;
    if (next < STEPS.length) showStep(next);
    else finishOnboarding();
  }, 420);
}

function finishOnboarding(): void {
  isActive = false;
  removeClickInterceptor();

  if (cardEl) {
    cardEl.classList.remove("ob-enter");
    cardEl.classList.add("ob-exit");
    setTimeout(() => { cardEl?.remove(); cardEl = null; }, 480);
  }
  if (stepsEl) {
    stepsEl.classList.remove("ob-steps-show");
    setTimeout(() => { stepsEl?.remove(); stepsEl = null; }, 480);
  }

  setTimeout(() => showDirectionalHint(), 700);
}

// ─── Post-onboarding directional hint ────────────────────────────────────────
function showDirectionalHint(): void {
  const el = document.createElement("div");
  el.id = "ob-direction";
  el.style.cssText = `
    position: fixed;
    bottom: 52px; left: 50%;
    transform: translateX(-50%) translateY(10px);
    z-index: 900; pointer-events: none;
    padding: 0.5rem 1.1rem;
    border-radius: 20px;
    background: rgba(5, 9, 18, 0.6);
    border: 1px solid rgba(0, 229, 204, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 0.76rem; font-weight: 500;
    color: rgba(0, 229, 204, 0.52);
    text-align: center;
    opacity: 0;
    transition: opacity 0.55s ease, transform 0.55s ease;
    letter-spacing: 0.03em;
    white-space: nowrap;
  `;
  el.textContent = "↑  Walk toward the glowing portals ahead";
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity    = "1";
      el.style.transform  = "translateX(-50%) translateY(0)";
    });
  });

  setTimeout(() => {
    el.style.opacity    = "0";
    el.style.transform  = "translateX(-50%) translateY(-10px)";
    setTimeout(() => el.remove(), 600);
  }, 5500);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Call once when the intro sequence ends. */
export function startOnboarding(): void {
  isMobile = isTouchDevice();
  injectStyles();

  const legacy = document.getElementById("controls-hint");
  if (legacy) {
    legacy.style.transition  = "opacity 0.4s ease";
    legacy.style.opacity     = "0";
    legacy.style.pointerEvents = "none";
  }

  cardEl  = document.createElement("div");
  cardEl.id = "ob-card";
  document.body.appendChild(cardEl);

  stepsEl = buildStepsEl();

  isActive     = true;
  isExiting    = false;
  currentStep  = -1;
  stepElapsed  = 0;
  lastNudgeTime = 0;

  // Wire mobile callbacks for joystick + sprint dismissal
  if (isMobile) {
    setOnFirstJoystickMove(() => { touchMoveDetected = true; });
    setOnFirstSprintPress(() => { touchSprintDetected = true; });
  }

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

  let shouldDismiss = false;

  if (isMobile) {
    // Mobile dismissal
    if (step.dismissOn === "movement" && touchMoveDetected) {
      shouldDismiss = stepElapsed > 500;
    } else if (step.dismissOn === "run" && touchSprintDetected) {
      shouldDismiss = true;
    } else if (stepElapsed >= step.timeoutMs) {
      shouldDismiss = true;
    }
  } else {
    // Desktop keyboard dismissal
    const movementPressed =
      isKeyPressed("KeyW")      || isKeyPressed("KeyS") ||
      isKeyPressed("KeyA")      || isKeyPressed("KeyD") ||
      isKeyPressed("ArrowUp")   || isKeyPressed("ArrowDown") ||
      isKeyPressed("ArrowLeft") || isKeyPressed("ArrowRight");

    const runPressed =
      movementPressed && (isKeyPressed("ShiftLeft") || isKeyPressed("ShiftRight"));

    if (step.dismissOn === "movement" && movementPressed) {
      shouldDismiss = stepElapsed > 600;
    } else if (step.dismissOn === "run" && runPressed) {
      shouldDismiss = true;
    } else if (stepElapsed >= step.timeoutMs) {
      shouldDismiss = true;
    }
  }

  if (shouldDismiss) dismissStep();
}

/** Whether the onboarding system is currently showing hints. */
export function isOnboardingActive(): boolean {
  return isActive;
}
