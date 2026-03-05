import { isKeyPressed } from "../controls/keyboardController";

// ─── Hint step definitions ──────────────────────────────────────────────────

type DismissOn = "movement" | "run" | "timeout";

interface HintStep {
  /** Key badge labels — each becomes its own pill */
  keys: string[];
  /** Descriptive text to the right of the keys */
  label: string;
  /** What triggers auto-dismiss */
  dismissOn: DismissOn;
  /** Hard timeout fallback in ms */
  timeoutMs: number;
}

const STEPS: HintStep[] = [
  {
    keys: ["W", "A", "S", "D"],
    label: "to move around",
    dismissOn: "movement",
    timeoutMs: 12000,
  },
  {
    keys: ["⇧ Shift"],
    label: "to run faster",
    dismissOn: "run",
    timeoutMs: 10000,
  },
  {
    keys: ["↑"],
    label: "walk north through the timeline gates",
    dismissOn: "timeout",
    timeoutMs: 7000,
  },
];

// ─── State ───────────────────────────────────────────────────────────────────

let cardEl: HTMLDivElement | null = null;
let currentStep = -1;
let stepElapsed = 0;
let isExiting = false;
let isActive = false;

// ─── Styles (injected once) ──────────────────────────────────────────────────

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
      gap: 0.75rem;

      padding: 0.6rem 1.1rem 0.6rem 0.85rem;
      border-radius: 14px;
      background: rgba(6, 10, 20, 0.72);
      border: 1px solid rgba(0, 229, 204, 0.16);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(0, 229, 204, 0.06) inset;

      opacity: 0;
      transition:
        opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);

      white-space: nowrap;
    }

    #ob-card.ob-enter {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    #ob-card.ob-exit {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }

    .ob-keys {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .ob-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      height: 26px;
      padding: 0 6px;
      border-radius: 6px;
      background: rgba(0, 229, 204, 0.09);
      border: 1px solid rgba(0, 229, 204, 0.35);
      border-bottom: 2px solid rgba(0, 229, 204, 0.5);
      font-family: system-ui, -apple-system, 'Segoe UI', monospace;
      font-size: 0.7rem;
      font-weight: 700;
      color: rgba(0, 229, 204, 0.92);
      letter-spacing: 0.03em;
      line-height: 1;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
    }

    /* wider badge for multi-char labels like "⇧ Shift" */
    .ob-key.ob-key-wide {
      min-width: 52px;
      font-size: 0.68rem;
    }

    /* directional arrow — slightly larger, no border-bottom depth */
    .ob-key.ob-key-arrow {
      font-size: 0.9rem;
      font-weight: 400;
      border-bottom-width: 1px;
      color: rgba(0, 229, 204, 0.75);
    }

    .ob-divider {
      width: 1px;
      height: 18px;
      background: rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }

    .ob-label {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 0.78rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.62);
      letter-spacing: 0.01em;
    }

    /* step indicator dots */
    #ob-dots {
      position: fixed;
      bottom: 38px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 900;
      display: flex;
      gap: 5px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    #ob-dots.ob-dots-visible {
      opacity: 1;
    }

    .ob-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      transition: background 0.3s ease, transform 0.3s ease;
    }

    .ob-dot.ob-dot-active {
      background: rgba(0, 229, 204, 0.7);
      transform: scale(1.2);
    }

    .ob-dot.ob-dot-done {
      background: rgba(0, 229, 204, 0.3);
    }
  `;
  document.body.appendChild(s);
}

// ─── DOM builders ────────────────────────────────────────────────────────────

function buildCard(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "ob-card";
  document.body.appendChild(el);
  return el;
}

let dotsEl: HTMLDivElement | null = null;

function buildDots(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "ob-dots";
  for (let i = 0; i < STEPS.length; i++) {
    const dot = document.createElement("div");
    dot.className = "ob-dot";
    dot.dataset.idx = String(i);
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

function renderStep(step: HintStep): void {
  if (!cardEl) return;

  const keysHtml = step.keys
    .map((k) => {
      const isArrow = k === "↑" || k === "↓" || k === "←" || k === "→";
      const isWide = k.length > 2;
      const cls = isArrow
        ? "ob-key ob-key-arrow"
        : isWide
          ? "ob-key ob-key-wide"
          : "ob-key";
      return `<span class="${cls}">${k}</span>`;
    })
    .join("");

  cardEl.innerHTML = `
    <div class="ob-keys">${keysHtml}</div>
    <div class="ob-divider"></div>
    <div class="ob-label">${step.label}</div>
  `;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Call once when the intro sequence ends. */
export function startOnboarding(): void {
  injectStyles();

  // Hide the legacy controls hint
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

  // Small delay so it feels natural after the intro settles
  setTimeout(() => showStep(0), 800);
}

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

  // Show dots when first step appears
  if (idx === 0) {
    dotsEl.classList.add("ob-dots-visible");
  }
  updateDots(idx);

  // Trigger enter animation (next tick so transition fires)
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

  cardEl?.classList.remove("ob-enter");
  cardEl?.classList.add("ob-exit");

  // Wait for exit animation, then show next
  setTimeout(() => {
    const next = currentStep + 1;
    if (next < STEPS.length) {
      showStep(next);
    } else {
      finishOnboarding();
    }
  }, 500);
}

function finishOnboarding(): void {
  isActive = false;

  // Fade out card
  if (cardEl) {
    cardEl.classList.remove("ob-enter");
    cardEl.classList.add("ob-exit");
    setTimeout(() => {
      cardEl?.remove();
      cardEl = null;
    }, 500);
  }

  // Fade out dots
  if (dotsEl) {
    dotsEl.classList.remove("ob-dots-visible");
    setTimeout(() => {
      dotsEl?.remove();
      dotsEl = null;
    }, 500);
  }
}

/**
 * Call every frame while gameplay is active.
 * @param deltaSec Frame delta in seconds
 */
export function updateOnboarding(deltaSec: number): void {
  if (!isActive || isExiting || currentStep < 0) return;

  const step = STEPS[currentStep];
  if (!step) return;

  stepElapsed += deltaSec * 1000; // convert to ms

  // Check dismiss conditions
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
    // Small grace period so the hint is readable before moving instantly dismisses it
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
