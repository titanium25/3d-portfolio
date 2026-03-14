import { setTouchDirection, setVirtualKey } from "../controls/keyboardController";

// ─────────────────────────────────────────────────────────────────────────────
//  Mobile Controls  —  Virtual joystick + Sprint button + Interact button
//
//  Design:  Tactical HUD aesthetic matching the scene's cyan / amber palette.
//  Layout:  Joystick zone — bottom-left.  Sprint — bottom-right.
//           Interact — above Sprint, appears only near timeline gates.
//  Pattern: Static joystick; entire zone is the touch surface.
// ─────────────────────────────────────────────────────────────────────────────

const JOYSTICK_RADIUS = 52;   // outer ring visual radius (px)
const THUMB_RADIUS    = 22;   // thumb visual radius (px)
const MAX_OFFSET      = JOYSTICK_RADIUS - THUMB_RADIUS - 4; // clamp distance

// ─── Public callbacks (read by onboardingHints) ───────────────────────────────
let _onFirstJoystickMove: (() => void) | null = null;
let _onFirstSprintPress:  (() => void) | null = null;

export function setOnFirstJoystickMove(cb: (() => void) | null): void {
  _onFirstJoystickMove = cb;
}
export function setOnFirstSprintPress(cb: (() => void) | null): void {
  _onFirstSprintPress = cb;
}

/** Returns true on touch-primary devices. */
export function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

// ─── Internal state ───────────────────────────────────────────────────────────
interface JoyState {
  active:  boolean;
  centerX: number;
  centerY: number;
  touchId: number | null;
}

const joy: JoyState = { active: false, centerX: 0, centerY: 0, touchId: null };
let firstMoveFired  = false;
let firstSprintFired = false;

let containerEl:   HTMLDivElement    | null = null;
let joyZoneEl:     HTMLDivElement    | null = null;
let joyBaseEl:     HTMLDivElement    | null = null;
let thumbEl:       HTMLDivElement    | null = null;
let sprintEl:      HTMLButtonElement | null = null;
let sprintLabelEl: HTMLSpanElement   | null = null;
let interactEl:    HTMLButtonElement | null = null;

let _interactCallback: (() => void) | null = null;

let idleTimer: ReturnType<typeof setTimeout> | null = null;

// ─── SVG icons ─────────────────────────────────────────────────────────────
const LIGHTNING_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

// "Enter/explore" icon: log-in arrow pointing right into a frame
const ENTER_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;

// ─── Styles ───────────────────────────────────────────────────────────────────
function injectStyles(): void {
  if (document.getElementById("mc-styles")) return;
  const s = document.createElement("style");
  s.id = "mc-styles";
  s.textContent = `
    /* ── Container ───────────────────────────────── */
    #mc-container {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 200px;
      pointer-events: none;
      z-index: 800;
      user-select: none;
      -webkit-user-select: none;
      transition: opacity 0.6s ease;
    }

    /* ── Joystick zone (left) ─────────────────────── */
    #mc-joy-zone {
      position: absolute;
      bottom: 18px; left: 18px;
      width: 140px; height: 140px;
      pointer-events: auto;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* ── Joystick base ring ───────────────────────── */
    #mc-joy-base {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: ${JOYSTICK_RADIUS * 2}px;
      height: ${JOYSTICK_RADIUS * 2}px;
      border-radius: 50%;
      background: rgba(0, 229, 204, 0.05);
      border: 1.5px solid rgba(0, 229, 204, 0.2);
      box-shadow:
        0 0 24px rgba(0, 229, 204, 0.06) inset,
        0 2px 12px rgba(0,0,0,0.35);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
      will-change: transform;
    }

    /* Cardinal tick marks */
    #mc-joy-base::before {
      content: '';
      position: absolute;
      inset: 10px;
      border-radius: 50%;
      border: 1px solid rgba(0, 229, 204, 0.09);
    }

    #mc-joy-base.joy-active {
      border-color: rgba(0, 229, 204, 0.5);
      background: rgba(0, 229, 204, 0.09);
      box-shadow: 0 0 28px rgba(0, 229, 204, 0.12) inset, 0 2px 12px rgba(0,0,0,0.35);
    }

    /* Direction ticks at 12/3/6/9 o'clock */
    .mc-tick {
      position: absolute;
      top: 50%; left: 50%;
      width: 3px; height: 6px;
      background: rgba(0, 229, 204, 0.2);
      border-radius: 2px;
      transform-origin: top center;
    }
    .mc-tick-n { transform: translate(-50%, -${JOYSTICK_RADIUS - 4}px) rotate(0deg); }
    .mc-tick-e { transform: translate(${JOYSTICK_RADIUS - 4}px, -50%) rotate(90deg); }
    .mc-tick-s { transform: translate(-50%, ${JOYSTICK_RADIUS - 10}px) rotate(180deg); }
    .mc-tick-w { transform: translate(-${JOYSTICK_RADIUS - 4}px, -50%) rotate(270deg); }

    /* ── Joystick thumb ───────────────────────────── */
    #mc-joy-thumb {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: ${THUMB_RADIUS * 2}px;
      height: ${THUMB_RADIUS * 2}px;
      border-radius: 50%;
      background: radial-gradient(circle at 36% 32%,
        rgba(0, 229, 204, 0.55) 0%,
        rgba(0, 160, 140, 0.28) 60%,
        rgba(0, 80, 70, 0.15) 100%);
      border: 1.5px solid rgba(0, 229, 204, 0.65);
      box-shadow:
        0 2px 14px rgba(0, 229, 204, 0.3),
        0 0 0 5px rgba(0, 229, 204, 0.07);
      will-change: transform;
      pointer-events: none;
    }

    /* Cross reticle */
    #mc-joy-thumb::before,
    #mc-joy-thumb::after {
      content: '';
      position: absolute;
      top: 50%; left: 50%;
      background: rgba(0, 229, 204, 0.7);
      border-radius: 1px;
    }
    #mc-joy-thumb::before {
      width: 10px; height: 1.5px;
      transform: translate(-50%, -50%);
    }
    #mc-joy-thumb::after {
      width: 1.5px; height: 10px;
      transform: translate(-50%, -50%);
    }

    /* ── Idle pulse on base (pre-first-use) ──────── */
    @keyframes joyIdlePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,204,0.15) inset, 0 2px 12px rgba(0,0,0,0.35); }
      50%       { box-shadow: 0 0 28px rgba(0,229,204,0.12) inset, 0 2px 12px rgba(0,0,0,0.35), 0 0 0 6px rgba(0,229,204,0.06); }
    }
    #mc-joy-base.joy-idle-pulse {
      animation: joyIdlePulse 2.4s ease-in-out infinite;
    }

    /* ── Sprint button (right) ───────────────────── */
    #mc-actions {
      position: absolute;
      bottom: 18px; right: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    }

    #mc-sprint {
      position: relative;
      width: 64px; height: 64px;
      border-radius: 50%;
      border: 1.5px solid rgba(255, 165, 50, 0.4);
      background: rgba(255, 145, 30, 0.1);
      color: rgba(255, 185, 80, 0.9);
      box-shadow:
        0 4px 18px rgba(255, 145, 30, 0.18),
        0 0 0 1px rgba(255, 145, 30, 0.06) inset;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      cursor: pointer;
      outline: none;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s, box-shadow 0.15s, background 0.15s, border-color 0.15s;
      will-change: transform;
      user-select: none;
      -webkit-user-select: none;
    }

    #mc-sprint .mc-btn-label {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.44rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: rgba(255, 185, 80, 0.65);
      text-transform: uppercase;
      transition: color 0.15s;
    }

    #mc-sprint.mc-sprint-active {
      background: rgba(255, 145, 30, 0.22);
      border-color: rgba(255, 185, 80, 0.65);
      color: rgba(255, 210, 120, 1);
      box-shadow:
        0 4px 24px rgba(255, 145, 30, 0.4),
        0 0 18px rgba(255, 165, 50, 0.2) inset;
      transform: scale(0.94);
    }

    #mc-sprint.mc-sprint-active .mc-btn-label {
      color: rgba(255, 210, 120, 1);
      letter-spacing: 0.05em;
    }

    /* Sonar ring on sprint activate */
    #mc-sprint::after {
      content: '';
      position: absolute;
      inset: -1px;
      border-radius: 50%;
      border: 1.5px solid rgba(255, 165, 50, 0.6);
      opacity: 0;
      transform: scale(1);
      pointer-events: none;
    }

    #mc-sprint.mc-sprint-active::after {
      animation: sprintSonar 0.55s ease-out;
    }

    @keyframes sprintSonar {
      from { opacity: 0.7; transform: scale(1); }
      to   { opacity: 0;   transform: scale(1.7); }
    }

    /* Idle pulsing ring before first sprint use */
    #mc-sprint.mc-sprint-hint::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 1.5px solid rgba(255, 165, 50, 0.55);
      pointer-events: none;
      animation: sprintIdleRing 2.5s ease-out infinite;
    }

    @keyframes sprintIdleRing {
      0%   { transform: scale(1);    opacity: 0.65; }
      65%  { transform: scale(1.6);  opacity: 0; }
      100% { transform: scale(1.6);  opacity: 0; }
    }

    /* ── Interact button (above Sprint, gate proximity) ── */
    #mc-interact {
      position: absolute;
      bottom: calc(18px + 64px + 10px);
      right: 18px;
      width: 64px; height: 64px;
      border-radius: 50%;
      border: 1.5px solid rgba(0, 229, 204, 0.5);
      background: rgba(0, 229, 204, 0.1);
      color: rgba(0, 229, 204, 0.9);
      box-shadow:
        0 4px 18px rgba(0, 229, 204, 0.18),
        0 0 0 1px rgba(0, 229, 204, 0.06) inset;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      cursor: pointer;
      outline: none;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      pointer-events: none;
      transform: scale(0);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      will-change: transform;
      user-select: none;
      -webkit-user-select: none;
    }

    #mc-interact.mc-interact-visible {
      pointer-events: auto;
      transform: scale(1);
    }

    #mc-interact:active {
      transform: scale(0.92) !important;
      background: rgba(0, 229, 204, 0.22);
    }

    #mc-interact .mc-btn-label {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.44rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: rgba(0, 229, 204, 0.65);
      text-transform: uppercase;
    }

    /* ── Idle fade-out (after 5s no input) ─────── */
    #mc-container.mc-faded {
      opacity: 0.3;
    }
    #mc-container.mc-focused {
      opacity: 1 !important;
    }

    /* ── Directional arrow hint (first few seconds) */
    #mc-dir-arrow {
      position: absolute;
      bottom: 170px; left: 0; right: 0;
      display: flex;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease;
    }
    #mc-dir-arrow.mc-arrow-show {
      opacity: 1;
    }
    #mc-dir-arrow span {
      font-family: system-ui, sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      color: rgba(0, 229, 204, 0.5);
      letter-spacing: 0.04em;
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      background: rgba(0, 229, 204, 0.06);
      border: 1px solid rgba(0, 229, 204, 0.12);
    }
  `;
  document.head.appendChild(s);
}

// ─── DOM builders ─────────────────────────────────────────────────────────────
function buildDOM(): void {
  containerEl = document.createElement("div");
  containerEl.id = "mc-container";

  // ── Joystick zone ──────────────────────────────────────────────────────────
  joyZoneEl = document.createElement("div");
  joyZoneEl.id = "mc-joy-zone";

  joyBaseEl = document.createElement("div");
  joyBaseEl.id = "mc-joy-base";
  joyBaseEl.classList.add("joy-idle-pulse");

  // Direction ticks
  ["n","e","s","w"].forEach((dir) => {
    const t = document.createElement("div");
    t.className = `mc-tick mc-tick-${dir}`;
    joyBaseEl!.appendChild(t);
  });

  thumbEl = document.createElement("div");
  thumbEl.id = "mc-joy-thumb";

  joyBaseEl.appendChild(thumbEl);
  joyZoneEl.appendChild(joyBaseEl);

  // ── Sprint button ──────────────────────────────────────────────────────────
  const actionsEl = document.createElement("div");
  actionsEl.id = "mc-actions";

  sprintEl = document.createElement("button");
  sprintEl.id = "mc-sprint";
  sprintEl.type = "button";
  sprintEl.classList.add("mc-sprint-hint"); // idle hint ring until first use

  sprintLabelEl = document.createElement("span");
  sprintLabelEl.className = "mc-btn-label";
  sprintLabelEl.textContent = "HOLD";

  sprintEl.innerHTML = LIGHTNING_SVG;
  sprintEl.appendChild(sprintLabelEl);

  actionsEl.appendChild(sprintEl);

  // ── Interact button (above sprint, hidden until near a gate) ───────────────
  interactEl = document.createElement("button");
  interactEl.id = "mc-interact";
  interactEl.type = "button";

  const interactLabel = document.createElement("span");
  interactLabel.className = "mc-btn-label";
  interactLabel.textContent = "EXPLORE";

  interactEl.innerHTML = ENTER_SVG;
  interactEl.appendChild(interactLabel);

  containerEl.appendChild(joyZoneEl);
  containerEl.appendChild(actionsEl);
  containerEl.appendChild(interactEl);
  document.body.appendChild(containerEl);
}

// ─── Joystick thumb positioning ───────────────────────────────────────────────
function moveThumb(clientX: number, clientY: number): void {
  if (!joyZoneEl || !thumbEl || !joyBaseEl) return;

  const rect    = joyZoneEl.getBoundingClientRect();
  const centerX = rect.left + rect.width  / 2;
  const centerY = rect.top  + rect.height / 2;

  let dx = clientX - centerX;
  let dy = clientY - centerY;

  const dist = Math.hypot(dx, dy);
  if (dist > MAX_OFFSET) {
    dx = (dx / dist) * MAX_OFFSET;
    dy = (dy / dist) * MAX_OFFSET;
  }

  thumbEl.style.transition = "none";
  thumbEl.style.transform  = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

  // Normalize to -1..1; Z axis: up = negative Z in Three.js world
  const dirX =  dx / MAX_OFFSET;
  const dirZ =  dy / MAX_OFFSET;
  setTouchDirection(dirX, dirZ);

  if (!firstMoveFired && (Math.abs(dirX) > 0.15 || Math.abs(dirZ) > 0.15)) {
    firstMoveFired = true;
    _onFirstJoystickMove?.();
  }
}

function snapThumb(): void {
  if (!thumbEl) return;
  thumbEl.style.transition = "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)";
  thumbEl.style.transform  = "translate(-50%, -50%)";
  setTouchDirection(0, 0);
}

// ─── Idle fade ────────────────────────────────────────────────────────────────
function resetIdleTimer(): void {
  containerEl?.classList.remove("mc-faded");
  containerEl?.classList.add("mc-focused");
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    containerEl?.classList.remove("mc-focused");
    containerEl?.classList.add("mc-faded");
  }, 5000);
}

// ─── Touch event handlers ─────────────────────────────────────────────────────
function onJoyTouchStart(e: TouchEvent): void {
  e.preventDefault();
  if (joy.active) return;

  resetIdleTimer();
  const t = e.changedTouches[0];
  joy.active  = true;
  joy.touchId = t.identifier;
  joyBaseEl?.classList.remove("joy-idle-pulse");
  joyBaseEl?.classList.add("joy-active");
  moveThumb(t.clientX, t.clientY);
  if (navigator.vibrate) navigator.vibrate(8);
}

function onJoyTouchMove(e: TouchEvent): void {
  e.preventDefault();
  for (const t of Array.from(e.changedTouches)) {
    if (t.identifier === joy.touchId) {
      moveThumb(t.clientX, t.clientY);
      return;
    }
  }
}

function onJoyTouchEnd(e: TouchEvent): void {
  e.preventDefault();
  for (const t of Array.from(e.changedTouches)) {
    if (t.identifier === joy.touchId) {
      joy.active  = false;
      joy.touchId = null;
      joyBaseEl?.classList.remove("joy-active");
      snapThumb();
      resetIdleTimer();
      return;
    }
  }
}

function onSprintTouchStart(e: TouchEvent): void {
  e.preventDefault();
  resetIdleTimer();
  setVirtualKey("ShiftLeft", true);
  sprintEl?.classList.add("mc-sprint-active");
  if (sprintLabelEl) sprintLabelEl.textContent = "RUNNING";
  if (navigator.vibrate) navigator.vibrate(12);

  if (!firstSprintFired) {
    firstSprintFired = true;
    sprintEl?.classList.remove("mc-sprint-hint");
    _onFirstSprintPress?.();
  }
}

function onSprintTouchEnd(e: TouchEvent): void {
  e.preventDefault();
  setVirtualKey("ShiftLeft", false);
  sprintEl?.classList.remove("mc-sprint-active");
  if (sprintLabelEl) sprintLabelEl.textContent = "HOLD";
  resetIdleTimer();
}

function onInteractTouchStart(e: TouchEvent): void {
  e.preventDefault();
  resetIdleTimer();
  if (navigator.vibrate) navigator.vibrate(15);
  _interactCallback?.();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Initialise mobile controls. No-ops on non-touch devices. */
export function initMobileControls(): void {
  if (!isTouchDevice()) return;

  injectStyles();
  buildDOM();

  // Joystick events
  joyZoneEl!.addEventListener("touchstart",  onJoyTouchStart,  { passive: false });
  joyZoneEl!.addEventListener("touchmove",   onJoyTouchMove,   { passive: false });
  joyZoneEl!.addEventListener("touchend",    onJoyTouchEnd,    { passive: false });
  joyZoneEl!.addEventListener("touchcancel", onJoyTouchEnd,    { passive: false });

  // Sprint events
  sprintEl!.addEventListener("touchstart",  onSprintTouchStart, { passive: false });
  sprintEl!.addEventListener("touchend",    onSprintTouchEnd,   { passive: false });
  sprintEl!.addEventListener("touchcancel", onSprintTouchEnd,   { passive: false });

  // Interact events
  interactEl!.addEventListener("touchstart", onInteractTouchStart, { passive: false });
  interactEl!.addEventListener("touchend",   (e) => e.preventDefault(), { passive: false });

  // Start idle-fade timer
  resetIdleTimer();
}

/** Hide controls while an overlay (CV panel, gate panel) is open. */
export function setMobileControlsVisible(visible: boolean): void {
  if (!containerEl) return;
  containerEl.style.display = visible ? "" : "none";
}

/**
 * Show the contextual gate interact button above the sprint zone.
 * Pass the callback to invoke when the user taps it.
 * No-op on non-touch devices (button was never created).
 */
export function showMobileInteract(callback: () => void): void {
  if (!interactEl) return;
  _interactCallback = callback;
  interactEl.classList.add("mc-interact-visible");
}

/**
 * Hide the gate interact button.
 * No-op on non-touch devices.
 */
export function hideMobileInteract(): void {
  if (!interactEl) return;
  interactEl.classList.remove("mc-interact-visible");
}
