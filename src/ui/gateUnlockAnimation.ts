import { TIMELINE_STOPS } from "../scene/timeline/timelineConfig";
import { isStopCompleted } from "../scene/timeline/createTimelineStops";

/* ── Configuration ──────────────────────────────────────────── */

const MOTE_COUNT = 6;

/* ── State ──────────────────────────────────────────────────── */

let stylesInjected = false;
let firstTooltipShown = false;
let isPlaying = false;

/* ── Helpers ────────────────────────────────────────────────── */

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getButtonCenter(): { x: number; y: number } {
  const btn = document.getElementById("cv-btn")!;
  const rect = btn.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/* ── Styles ─────────────────────────────────────────────────── */

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const s = document.createElement("style");
  s.id = "gate-unlock-styles";
  s.textContent = `
    .cv-btn-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 35%, rgba(0,229,204,0.35) 0%, rgba(0,229,204,0.12) 70%), #0a0e14;
      border: 1.5px solid rgba(0,229,204,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      font-weight: 800;
      color: #00e5cc;
      font-family: 'Inter', system-ui, sans-serif;
      pointer-events: none;
      animation: cvBadgePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow:
        0 0 0 3px #0a0e14,
        0 0 8px rgba(0,229,204,0.4),
        0 0 20px rgba(0,229,204,0.15),
        inset 0 0 6px rgba(0,229,204,0.1);
      text-shadow: 0 0 6px rgba(0,229,204,0.6);
      overflow: hidden;
    }
    .cv-btn-badge::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
      pointer-events: none;
    }
    .cv-btn-badge::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(
        105deg,
        transparent 40%,
        rgba(255,255,255,0.12) 45%,
        rgba(255,255,255,0.2) 50%,
        rgba(255,255,255,0.12) 55%,
        transparent 60%
      );
      animation: cvBadgeSweep 3s ease-in-out 1s infinite;
      pointer-events: none;
    }
    @keyframes cvBadgeSweep {
      0%, 100% { transform: translateX(-80%) rotate(25deg); }
      50%      { transform: translateX(80%) rotate(25deg); }
    }
    .cv-btn-badge.is-complete {
      border-color: rgba(251, 191, 36, 0.65);
      color: #fbbf24;
      background: radial-gradient(circle at 40% 35%, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.08) 70%), #0a0e14;
      box-shadow:
        0 0 0 3px #0a0e14,
        0 0 10px rgba(251,191,36,0.45),
        0 0 24px rgba(251,191,36,0.15),
        inset 0 0 6px rgba(251,191,36,0.12);
      text-shadow: 0 0 6px rgba(251,191,36,0.6);
      animation: cvBadgePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), cvBadgeGlow 2s ease-in-out infinite;
    }
    @keyframes cvBadgePop {
      0%   { transform: scale(0); opacity: 0; }
      50%  { transform: scale(1.25); }
      70%  { transform: scale(0.92); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes cvBadgeBump {
      0%   { transform: scale(1);    box-shadow: 0 0 0 3px #0a0e14, 0 0 8px rgba(0,229,204,0.4), 0 0 0 0px rgba(0,229,204,0.7); }
      35%  { transform: scale(1.25); box-shadow: 0 0 0 3px #0a0e14, 0 0 18px rgba(0,229,204,0.9), 0 0 0 5px rgba(0,229,204,0.25); }
      65%  { transform: scale(0.93); box-shadow: 0 0 0 3px #0a0e14, 0 0 12px rgba(0,229,204,0.5), 0 0 0 9px rgba(0,229,204,0.07); }
      100% { transform: scale(1);    box-shadow: 0 0 0 3px #0a0e14, 0 0 8px rgba(0,229,204,0.4), 0 0 0 12px rgba(0,229,204,0); }
    }
    .cv-badge-bump { animation: cvBadgeBump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) !important; }
    @keyframes cvBadgeGlow {
      0%, 100% { box-shadow: 0 0 0 3px #0a0e14, 0 0 8px rgba(251,191,36,0.35), 0 0 20px rgba(251,191,36,0.1), inset 0 0 6px rgba(251,191,36,0.08); }
      50%      { box-shadow: 0 0 0 3px #0a0e14, 0 0 14px rgba(251,191,36,0.55), 0 0 32px rgba(251,191,36,0.2), inset 0 0 8px rgba(251,191,36,0.15); }
    }

    #cv-btn.cv-btn-has-unlocks {
      border-color: rgba(0,229,204,0.55);
    }
    #cv-btn.cv-btn-complete {
      border-color: rgba(251,191,36,0.45);
      animation-name: cvBtnComplete;
    }
    @keyframes cvBtnComplete {
      0%, 100% { box-shadow: inset 0 0 0 1px rgba(251,191,36,0.08), 0 0 14px rgba(251,191,36,0.12), 0 0 18px rgba(0,229,204,0.08), 0 2px 12px rgba(0,0,0,0.5); }
      50%       { box-shadow: inset 0 0 0 1px rgba(251,191,36,0.14), 0 0 26px rgba(251,191,36,0.22), 0 0 26px rgba(0,229,204,0.12), 0 2px 12px rgba(0,0,0,0.5); }
    }

    #gate-unlock-tooltip {
      position: fixed;
      z-index: 2002;
      pointer-events: none;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.4s ease, transform 0.4s ease;
      padding: 0.5rem 1rem;
      background: rgba(6, 10, 20, 0.85);
      border: 1px solid rgba(0,229,204,0.22);
      border-radius: 10px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.73rem;
      font-weight: 500;
      color: rgba(0,229,204,0.85);
      white-space: nowrap;
    }
    #gate-unlock-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .unlock-mote {
      position: fixed;
      border-radius: 50%;
      background: radial-gradient(circle, #fff 0%, #00e5cc 40%, rgba(0,229,204,0) 70%);
      box-shadow: 0 0 12px 4px rgba(0,229,204,0.6), 0 0 24px 8px rgba(251,191,36,0.15);
      pointer-events: none;
      z-index: 2050;
    }
    /* Amber motes for discovery (vs cyan for gate) */
    .unlock-mote-discovery {
      background: radial-gradient(circle, #fff 0%, #fbbf24 40%, rgba(251,191,36,0) 70%);
      box-shadow: 0 0 10px 3px rgba(251,191,36,0.7), 0 0 20px 6px rgba(251,191,36,0.2);
    }
    /* About tab "new" indicator */
    .cv-tab-btn-new {
      position: relative;
    }
    .cv-tab-new-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fbbf24;
      box-shadow: 0 0 6px rgba(251,191,36,0.9), 0 0 12px rgba(251,191,36,0.4);
      margin-left: 5px;
      vertical-align: middle;
      animation: tabNewPulse 1.6s ease-in-out infinite;
      flex-shrink: 0;
    }
    @keyframes tabNewPulse {
      0%, 100% { transform: scale(1);    opacity: 0.7; }
      50%       { transform: scale(1.35); opacity: 1; }
    }
    .cv-tab-btn-new {
      color: rgba(255,255,255,0.85) !important;
    }

    .unlock-spark {
      position: fixed;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #00e5cc;
      pointer-events: none;
      z-index: 2051;
    }

    @keyframes unlockBtnPop {
      0%   { transform: translateY(-1px) scale(1); }
      25%  { transform: translateY(-2px) scale(1.18); }
      55%  { transform: translateY(0) scale(0.97); }
      100% { transform: translateY(-1px) scale(1); }
    }
    .cv-btn-absorbing {
      animation: unlockBtnPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
    }

    @keyframes unlockSonar {
      0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }
    .unlock-sonar {
      position: fixed;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 2px solid rgba(0, 229, 204, 0.8);
      pointer-events: none;
      z-index: 2049;
      animation: unlockSonar 0.6s ease-out forwards;
    }

    .unlock-scanline {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      pointer-events: none;
      z-index: 2048;
      background: linear-gradient(to bottom,
        transparent 49.5%,
        rgba(255,255,255,0.08) 49.8%,
        rgba(0,229,204,0.25) 50%,
        rgba(255,255,255,0.08) 50.2%,
        transparent 50.5%
      );
      animation: unlockScanSweep 0.35s ease-in-out forwards;
    }
    @keyframes unlockScanSweep {
      0%   { transform: translateY(-100vh); opacity: 0.8; }
      50%  { opacity: 1; }
      100% { transform: translateY(100vh); opacity: 0; }
    }

    /* ── Game notification toast ── */
    .unlock-toast {
      position: fixed;
      top: calc(4.8rem + env(safe-area-inset-top, 0px));
      right: calc(1.25rem + env(safe-area-inset-right, 0px));
      z-index: 2052;
      display: flex;
      align-items: stretch;
      width: min(308px, calc(100vw - 2rem));
      border-radius: 6px;
      background: rgba(8, 12, 18, 0.97);
      border: 1px solid rgba(0,229,204,0.16);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow:
        0 24px 64px rgba(0,0,0,0.75),
        0 0 0 1px rgba(0,229,204,0.05),
        0 0 48px rgba(0,229,204,0.05);
      overflow: hidden;
      transform: translateX(calc(100% + 2rem)) scale(0.88);
      opacity: 0;
      transition:
        transform 0.52s cubic-bezier(0.16, 1, 0.3, 1),
        opacity 0.32s ease;
    }
    .unlock-toast.visible {
      transform: translateX(0) scale(1);
      opacity: 1;
      box-shadow:
        0 24px 64px rgba(0,0,0,0.75),
        0 0 0 1px rgba(0,229,204,0.1),
        0 0 48px rgba(0,229,204,0.1),
        0 0 96px rgba(0,229,204,0.04);
    }

    /* Icon column */
    .toast-icon-col {
      width: 56px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,229,204,0.08);
      border-right: 1px solid rgba(0,229,204,0.12);
      position: relative;
    }
    .toast-icon-col::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(0,229,204,0.18) 0%, transparent 70%);
      pointer-events: none;
    }
    .toast-icon-glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #00e5cc;
      filter: drop-shadow(0 0 7px rgba(0,229,204,0.95)) drop-shadow(0 0 18px rgba(0,229,204,0.5));
      position: relative;
      z-index: 1;
      animation: toastIconPop 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.18s both;
    }
    @keyframes toastIconPop {
      0%   { transform: scale(0.2) rotate(-20deg); opacity: 0; }
      65%  { transform: scale(1.2) rotate(4deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    /* Body */
    .toast-body {
      flex: 1;
      padding: 0.62rem 1.8rem 0.75rem 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.12rem;
      min-width: 0;
    }
    /* Dismiss button */
    .toast-dismiss {
      position: absolute;
      top: 5px; right: 6px;
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      background: none;
      border: none;
      color: rgba(255,255,255,0.18);
      font-size: 0.85rem;
      line-height: 1;
      cursor: pointer;
      border-radius: 3px;
      padding: 0;
      transition: color 0.15s ease, background 0.15s ease;
      z-index: 2;
    }
    .toast-dismiss:hover { color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.07); }
    .toast-category {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.56rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.55);
      margin-bottom: 0.1rem;
    }
    .unlock-toast-title {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.81rem;
      font-weight: 700;
      color: rgba(255,255,255,0.95);
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .unlock-toast-sub {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.63rem;
      color: rgba(255,255,255,0.38);
      font-weight: 500;
    }
    .toast-hint {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.58rem;
      font-weight: 600;
      color: rgba(0,229,204,0.75);
      margin-top: 5px;
      letter-spacing: 0.02em;
    }

    /* Shimmer sweep — plays once on entry */
    .toast-shimmer {
      position: absolute;
      top: 0; bottom: 0;
      left: 56px; right: 0;
      background: linear-gradient(
        105deg,
        transparent 0%,
        rgba(0,229,204,0.06) 35%,
        rgba(0,229,204,0.18) 50%,
        rgba(0,229,204,0.06) 65%,
        transparent 100%
      );
      animation: toastShimmer 0.85s ease-out 0.4s both;
      pointer-events: none;
    }
    @keyframes toastShimmer {
      from { transform: translateX(-120%); opacity: 1; }
      to   { transform: translateX(200%); opacity: 0; }
    }

    /* Drain bar — shows remaining hold time */
    .toast-drain {
      position: absolute;
      bottom: 0;
      left: 56px;
      right: 0;
      height: 2px;
      background: rgba(255,255,255,0.04);
    }
    .toast-drain-fill {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, rgba(0,229,204,0.15) 0%, #00e5cc 100%);
      transform-origin: left;
      animation: toastDrain var(--hold-ms, 2500ms) linear 0.5s forwards;
    }
    @keyframes toastDrain {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }

    /* ── Clickable state ── */
    .unlock-toast.is-clickable {
      cursor: pointer;
    }
    .unlock-toast.is-clickable:hover {
      transform: translateX(-4px) scale(1.012);
      border-color: rgba(0,229,204,0.32);
      box-shadow:
        0 28px 72px rgba(0,0,0,0.8),
        0 0 0 1px rgba(0,229,204,0.18),
        0 0 56px rgba(0,229,204,0.14),
        0 0 100px rgba(0,229,204,0.05);
    }
    .unlock-toast.is-clickable.is-final:hover {
      border-color: rgba(251,191,36,0.38);
      box-shadow:
        0 28px 72px rgba(0,0,0,0.8),
        0 0 0 1px rgba(251,191,36,0.2),
        0 0 56px rgba(251,191,36,0.18);
    }
    .toast-open-cta {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.5);
      display: flex;
      align-items: center;
      gap: 3px;
      margin-top: 6px;
      transition: color 0.2s ease;
    }
    .unlock-toast.is-clickable:hover .toast-open-cta {
      color: rgba(0,229,204,0.9);
    }
    .unlock-toast.is-final .toast-open-cta {
      color: rgba(251,191,36,0.5);
    }
    .unlock-toast.is-final.is-clickable:hover .toast-open-cta {
      color: rgba(251,191,36,0.9);
    }
    .toast-open-cta-arrow {
      display: inline-block;
      transition: transform 0.2s ease;
    }
    .unlock-toast.is-clickable:hover .toast-open-cta-arrow {
      transform: translateX(3px);
    }

    /* ── Spotlight highlight — applied to target element after toast click ── */
    .cv-toast-spotlight {
      position: relative;
      z-index: 2;
      animation: spotlightGlow 2.8s ease-out forwards;
      overflow: hidden;
    }
    @keyframes spotlightGlow {
      0%   { box-shadow: inset 0 0 0 1.5px rgba(0,229,204,0), 0 0 0 rgba(0,229,204,0); }
      10%  { box-shadow: inset 0 0 0 1.5px rgba(0,229,204,0.55), 0 0 40px rgba(0,229,204,0.18); }
      30%  { box-shadow: inset 0 0 0 1px rgba(0,229,204,0.3), 0 0 24px rgba(0,229,204,0.1); }
      100% { box-shadow: inset 0 0 0 1px rgba(0,229,204,0), 0 0 0 rgba(0,229,204,0); }
    }
    .cv-toast-spotlight-sweep {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 3;
      background: linear-gradient(
        105deg,
        transparent 0%,
        rgba(0,229,204,0.04) 35%,
        rgba(0,229,204,0.14) 50%,
        rgba(0,229,204,0.04) 65%,
        transparent 100%
      );
      animation: spotlightSweep 0.9s ease-in-out 0.15s both;
    }
    @keyframes spotlightSweep {
      from { transform: translateX(-120%); opacity: 1; }
      to   { transform: translateX(200%); opacity: 0; }
    }

    /* ── Final / gold state ── */
    .unlock-toast.is-final {
      border-color: rgba(251,191,36,0.18);
      box-shadow:
        0 24px 64px rgba(0,0,0,0.75),
        0 0 0 1px rgba(251,191,36,0.06),
        0 0 48px rgba(251,191,36,0.06);
    }
    .unlock-toast.is-final.visible {
      box-shadow:
        0 24px 64px rgba(0,0,0,0.75),
        0 0 0 1px rgba(251,191,36,0.12),
        0 0 48px rgba(251,191,36,0.14),
        0 0 96px rgba(251,191,36,0.04);
    }
    .unlock-toast.is-final .toast-icon-col {
      background: rgba(251,191,36,0.1);
      border-right-color: rgba(251,191,36,0.15);
    }
    .unlock-toast.is-final .toast-icon-col::before {
      background: radial-gradient(circle at center, rgba(251,191,36,0.2) 0%, transparent 70%);
    }
    .unlock-toast.is-final .toast-icon-glyph {
      color: #fbbf24;
      filter: drop-shadow(0 0 7px rgba(251,191,36,0.95)) drop-shadow(0 0 18px rgba(251,191,36,0.5));
    }
    .unlock-toast.is-final .toast-category { color: rgba(251,191,36,0.6); }
    .unlock-toast.is-final .toast-shimmer {
      background: linear-gradient(
        105deg,
        transparent 0%,
        rgba(251,191,36,0.06) 35%,
        rgba(251,191,36,0.18) 50%,
        rgba(251,191,36,0.06) 65%,
        transparent 100%
      );
    }
    .unlock-toast.is-final .toast-drain-fill {
      background: linear-gradient(90deg, rgba(251,191,36,0.15) 0%, #fbbf24 100%);
    }

  `;
  document.head.appendChild(s);
}

/* ── Count badge on the Resume button ───────────────────────── */

function getBadgeEl(): HTMLElement | null {
  return document.getElementById("cv-btn-badge");
}

function ensureBadge(): HTMLElement | null {
  const btn = document.getElementById("cv-btn");
  if (!btn) return null;

  let badge = document.getElementById("cv-btn-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "cv-btn-badge";
    badge.className = "cv-btn-badge";
    btn.appendChild(badge);
  }
  return badge;
}

// Tracks discoveries added externally (from discoveryTracker) to include in badge count
let discoveryBadgeCount = 0;

/** Call after each 3D object discovery to bump the Resume button badge. */
export function addDiscoveryToBadge(): void {
  discoveryBadgeCount++;
  refreshProgressDots();
}

export function refreshProgressDots(): void {
  const btn = document.getElementById("cv-btn");
  if (!btn) return;

  const gateCount = TIMELINE_STOPS.filter((s) => isStopCompleted(s.id)).length;
  const total = gateCount + discoveryBadgeCount;

  if (total === 0) {
    getBadgeEl()?.remove();
    btn.classList.remove("cv-btn-has-unlocks");
    return;
  }

  const badge = ensureBadge();
  if (!badge) return;

  const isFull = gateCount === TIMELINE_STOPS.length;
  const newText = isFull ? "✦" : String(total);

  if (badge.textContent !== newText) {
    badge.textContent = newText;
    badge.classList.remove("cv-badge-bump");
    requestAnimationFrame(() => badge.classList.add("cv-badge-bump"));
    badge.addEventListener("animationend", () => badge.classList.remove("cv-badge-bump"), { once: true });
  }

  badge.classList.toggle("is-complete", isFull);
  btn.classList.add("cv-btn-has-unlocks");
}

/* ── First-unlock tooltip ───────────────────────────────────── */

function showFirstUnlockTooltip(): void {
  if (firstTooltipShown) return;
  firstTooltipShown = true;

  const btn = document.getElementById("cv-btn");
  if (!btn) return;

  const tip = document.createElement("div");
  tip.id = "gate-unlock-tooltip";
  tip.textContent = "Your dossier is building\u2026";
  document.body.appendChild(tip);

  const r = btn.getBoundingClientRect();
  tip.style.top = `${r.bottom + 12}px`;
  tip.style.right = `${window.innerWidth - r.right}px`;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => tip.classList.add("visible")),
  );

  setTimeout(() => {
    tip.classList.remove("visible");
    setTimeout(() => tip.remove(), 450);
  }, 3200);
}

/* ── Phase 0: "The Seal Break" — screen vignette flash ─────── */

function playVignetteFlash(): Promise<void> {
  return new Promise((resolve) => {
    const vignette = document.createElement("div");
    vignette.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 1999;
      box-shadow: inset 0 0 120px 40px rgba(0, 229, 204, 0.12);
      opacity: 0;
      transition: opacity 200ms ease-in;
    `;
    document.body.appendChild(vignette);

    requestAnimationFrame(() => {
      vignette.style.opacity = "1";
      setTimeout(() => {
        vignette.style.transition = "opacity 200ms ease-out";
        vignette.style.opacity = "0";
        setTimeout(() => {
          vignette.remove();
          resolve();
        }, 200);
      }, 200);
    });
  });
}

/* ── Phase 1: "Energy Harvest" — mote burst + bezier travel ── */

function playEnergyHarvest(startX: number, startY: number): Promise<void> {
  return new Promise((resolve) => {
    const btn = document.getElementById("cv-btn");
    if (!btn) {
      resolve();
      return;
    }

    const target = getButtonCenter();

    interface Mote {
      el: HTMLDivElement;
      bx: number;
      by: number;
      cx: number;
      cy: number;
      delay: number;
      duration: number;
      size: number;
      arrived: boolean;
    }

    const motes: Mote[] = [];

    for (let i = 0; i < MOTE_COUNT; i++) {
      const el = document.createElement("div");
      el.className = "unlock-mote";
      const size = 6 + Math.random() * 4;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.opacity = "0";
      document.body.appendChild(el);

      const angle =
        (Math.PI * 2 * i) / MOTE_COUNT + (Math.random() - 0.5) * 0.6;
      const dist = 25 + Math.random() * 40;
      const bx = startX + Math.cos(angle) * dist;
      const by = startY + Math.sin(angle) * dist;

      const mx = (bx + target.x) / 2;
      const my = (by + target.y) / 2;
      const perpAngle =
        Math.atan2(target.y - by, target.x - bx) + Math.PI / 2;
      const arcOff = (Math.random() - 0.5) * 160;
      const cx = mx + Math.cos(perpAngle) * arcOff;
      const cy = my + Math.sin(perpAngle) * arcOff - 40 - Math.random() * 40;

      const delay = i * 50;
      const duration = 500 * (0.85 + Math.random() * 0.3);

      motes.push({ el, bx, by, cx, cy, delay, duration, size, arrived: false });
    }

    const BURST_DUR = 250;
    const t0 = performance.now();
    let arrivedCount = 0;

    function tick(): void {
      const elapsed = performance.now() - t0;
      let allDone = true;

      for (const m of motes) {
        if (m.arrived) continue;
        const localTime = elapsed - m.delay;

        if (localTime < 0) {
          allDone = false;
          continue;
        }

        if (localTime < BURST_DUR) {
          allDone = false;
          const t = localTime / BURST_DUR;
          const e = 1 - (1 - t) ** 3;
          const x = startX + (m.bx - startX) * e;
          const y = startY + (m.by - startY) * e;
          m.el.style.left = `${x - m.size / 2}px`;
          m.el.style.top = `${y - m.size / 2}px`;
          m.el.style.opacity = String(0.3 + t * 0.7);
        } else {
          const travelTime = localTime - BURST_DUR;
          if (travelTime < m.duration) {
            allDone = false;
            const raw = travelTime / m.duration;
            const e =
              raw < 0.5
                ? 2 * raw * raw
                : 1 - (-2 * raw + 2) ** 2 / 2;

            const omt = 1 - e;
            const x =
              omt * omt * m.bx + 2 * omt * e * m.cx + e * e * target.x;
            const y =
              omt * omt * m.by + 2 * omt * e * m.cy + e * e * target.y;
            const scale = 1 - e * 0.4;

            m.el.style.left = `${x - m.size / 2}px`;
            m.el.style.top = `${y - m.size / 2}px`;
            m.el.style.transform = `scale(${scale})`;
            m.el.style.opacity = String(1 - e * 0.2);
          } else if (!m.arrived) {
            m.arrived = true;
            arrivedCount++;
            spawnSparks(target.x, target.y, 3 + Math.floor(Math.random() * 2));
            m.el.remove();
          }
        }
      }

      if (allDone || arrivedCount >= MOTE_COUNT) {
        motes.forEach((m) => m.el.parentNode && m.el.remove());
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  });
}

/* ── Micro-sparks on mote impact ─────────────────────────────── */

function spawnSparks(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const spark = document.createElement("div");
    spark.className = "unlock-spark";
    document.body.appendChild(spark);

    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 80;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed - 30;
    let sx = x;
    let sy = y;
    const t0 = performance.now();
    let lastT = t0;

    function animateSpark(): void {
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      lastT = now;
      const elapsed = now - t0;

      if (elapsed > 300) {
        spark.remove();
        return;
      }

      sx += vx * dt;
      sy += vy * dt;
      vy += 400 * dt;
      vx *= 1 - 2 * dt;

      spark.style.left = `${sx}px`;
      spark.style.top = `${sy}px`;
      spark.style.opacity = String(1 - elapsed / 300);
      requestAnimationFrame(animateSpark);
    }
    requestAnimationFrame(animateSpark);
  }
}

/* ── Phase 2: "The Absorption" — button pop, sonar, dot flash ── */

function playAbsorption(_stopId: string): Promise<void> {
  return new Promise((resolve) => {
    const btn = document.getElementById("cv-btn");
    if (!btn) {
      resolve();
      return;
    }

    btn.classList.add("cv-btn-absorbing");
    setTimeout(() => btn.classList.remove("cv-btn-absorbing"), 500);

    const center = getButtonCenter();
    const sonar = document.createElement("div");
    sonar.className = "unlock-sonar";
    sonar.style.left = `${center.x}px`;
    sonar.style.top = `${center.y}px`;
    document.body.appendChild(sonar);
    setTimeout(() => sonar.remove(), 650);

    // Brief badge flash then update count
    const badge = getBadgeEl();
    if (badge) {
      badge.style.background = "rgba(255,255,255,0.9)";
      badge.style.color = "#000";
      setTimeout(() => {
        badge.style.background = "";
        badge.style.color = "";
        refreshProgressDots();
      }, 150);
    } else {
      refreshProgressDots();
    }

    btn.style.boxShadow =
      "0 0 32px rgba(0,229,204,0.5), 0 0 56px rgba(0,229,204,0.2)";
    btn.style.borderColor = "rgba(0,229,204,0.8)";
    setTimeout(() => {
      btn.style.boxShadow = "";
      btn.style.borderColor = "";
    }, 2500);

    setTimeout(resolve, 450);
  });
}

/* ── Shared game toast ───────────────────────────────────────── */

export interface GameToastOptions {
  icon: string;
  category: string;
  title: string;
  subtitle: string;
  hint?: string;       // optional reward line shown below subtitle in cyan
  isFinal?: boolean;
  holdMs?: number;
  /** If set, clicking the toast opens the CV panel on this tab. */
  tab?: 'journey' | 'about';
  /** Stop or discovery ID — used to scroll-to + spotlight the target element. */
  targetId?: string;
}

let activeToastEl: HTMLElement | null = null;
let activeToastTimer: ReturnType<typeof setTimeout> | null = null;

function spotlightTarget(tab: 'journey' | 'about', targetId: string): void {
  const selector = tab === 'journey'
    ? `#cv-exp-${targetId}`
    : `.cv-interest-card[data-discovery-id="${targetId}"]`;

  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;

  // Find the scrollable tab panel ancestor
  const scrollParent = el.closest('.cv-tab-panel');
  if (scrollParent) {
    const elRect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    const elTopRelative = elRect.top - parentRect.top + scrollParent.scrollTop;
    const centeredScroll = elTopRelative - parentRect.height / 2 + elRect.height / 2;
    scrollParent.scrollTo({ top: Math.max(0, centeredScroll), behavior: 'smooth' });
  }

  // Wait for scroll to settle, then apply spotlight
  setTimeout(() => {
    // Clean up any previous spotlight
    document.querySelectorAll('.cv-toast-spotlight').forEach((prev) => {
      prev.classList.remove('cv-toast-spotlight');
      prev.querySelector('.cv-toast-spotlight-sweep')?.remove();
    });

    el.classList.add('cv-toast-spotlight');
    const sweep = document.createElement('div');
    sweep.className = 'cv-toast-spotlight-sweep';
    el.appendChild(sweep);

    setTimeout(() => {
      el.classList.remove('cv-toast-spotlight');
      sweep.remove();
    }, 3000);
  }, 350);
}

export async function showGameToast(opts: GameToastOptions): Promise<void> {
  injectStyles();

  // Dismiss any existing toast instantly before showing new one
  if (activeToastEl) {
    const prev = activeToastEl;
    activeToastEl = null;
    prev.classList.remove("visible");
    if (activeToastTimer) { clearTimeout(activeToastTimer); activeToastTimer = null; }
    await wait(180);
    prev.remove();
  }

  const holdMs = opts.holdMs ?? 2500;
  const { tab, targetId } = opts;

  const ctaLabel = tab === 'journey' ? 'Open Journey' : 'Open About';

  const toast = document.createElement("div");
  toast.className = `unlock-toast${opts.isFinal ? " is-final" : ""}${tab ? " is-clickable" : ""}`;
  toast.innerHTML = `
    <div class="toast-icon-col">
      <span class="toast-icon-glyph">${opts.icon}</span>
    </div>
    <div class="toast-body">
      <div class="toast-category">${opts.category}</div>
      <div class="unlock-toast-title">${opts.title}</div>
      <div class="unlock-toast-sub">${opts.subtitle}</div>
      ${opts.hint ? `<div class="toast-hint">${opts.hint}</div>` : ""}
      ${tab ? `<div class="toast-open-cta">${ctaLabel} <span class="toast-open-cta-arrow">→</span></div>` : ""}
    </div>
    <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
    <div class="toast-shimmer"></div>
    <div class="toast-drain">
      <div class="toast-drain-fill" style="--hold-ms: ${holdMs}ms"></div>
    </div>
  `;

  toast.querySelector<HTMLButtonElement>('.toast-dismiss')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toast.classList.remove('visible');
    if (activeToastEl === toast) { activeToastEl = null; }
    if (activeToastTimer) { clearTimeout(activeToastTimer); activeToastTimer = null; }
    setTimeout(() => toast.remove(), 420);
  }, { once: true });
  document.body.appendChild(toast);
  activeToastEl = toast;

  if (tab) {
    toast.addEventListener("click", () => {
      // Dismiss toast immediately
      toast.classList.remove("visible");
      if (activeToastEl === toast) { activeToastEl = null; }
      if (activeToastTimer) { clearTimeout(activeToastTimer); activeToastTimer = null; }
      setTimeout(() => toast.remove(), 420);

      // Open CV panel then switch to the target tab, then spotlight
      const cvBtn = document.getElementById("cv-btn") as HTMLButtonElement | null;
      cvBtn?.click();
      setTimeout(() => {
        const tabBtn = document.querySelector(`.cv-tab-btn[data-tab="${tab}"]`) as HTMLButtonElement | null;
        tabBtn?.click();

        if (targetId) {
          setTimeout(() => spotlightTarget(tab, targetId), 120);
        }
      }, 80);
    }, { once: true });
  }

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("visible")));

  await wait(holdMs + 500);

  toast.classList.remove("visible");
  await wait(420);
  if (activeToastEl === toast) { activeToastEl = null; }
  toast.remove();
}

/* ── Phase 3: "The Revelation" — scanline, toast ──────────────── */

async function playRevelation(
  stopId: string,
  stopCompany: string,
  stopYear: number,
  completedCount: number,
  totalGates: number,
): Promise<void> {
  await wait(200);

  const scanline = document.createElement("div");
  scanline.className = "unlock-scanline";
  document.body.appendChild(scanline);
  setTimeout(() => scanline.remove(), 400);

  await wait(300);

  const isFinal = completedCount === totalGates;
  const holdMs = isFinal ? 4000 : 2500;

  const iconMilestone = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2L13.8 8.2L20.5 8.2L15.2 12.3L17.4 18.8L11 15L4.6 18.8L6.8 12.3L1.5 8.2L8.2 8.2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="rgba(0,229,204,0.12)"/></svg>`;
  const iconFinal     = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2L13.8 8.2L20.5 8.2L15.2 12.3L17.4 18.8L11 15L4.6 18.8L6.8 12.3L1.5 8.2L8.2 8.2Z" fill="currentColor"/></svg>`;

  const toastPromise = showGameToast({
    icon: isFinal ? iconFinal : iconMilestone,
    category: isFinal ? "JOURNEY COMPLETE" : "MILESTONE EXPLORED",
    title: isFinal ? "Journey Complete" : `${stopCompany} ${stopYear} \u2014 Explored`,
    subtitle: isFinal
      ? "Every chapter of the story, experienced firsthand"
      : `${completedCount} of ${totalGates} milestones explored`,
    isFinal,
    holdMs,
    tab: 'journey',
    targetId: stopId,
  });

  // Mark Journey tab as having new content
  markJourneyTabNew();

  if (isFinal) {
    await wait(400);
    playCompletionBonus();
  }

  await toastPromise;

  if (completedCount === 1) {
    showFirstUnlockTooltip();
  }
}

/* ── Phase 4: 4/4 Completion Bonus ────────────────────────────── */

function playCompletionBonus(): void {
  const btn = document.getElementById("cv-btn");
  if (!btn) return;

  const center = getButtonCenter();

  const sonar1 = document.createElement("div");
  sonar1.className = "unlock-sonar";
  sonar1.style.left = `${center.x}px`;
  sonar1.style.top = `${center.y}px`;
  document.body.appendChild(sonar1);
  setTimeout(() => sonar1.remove(), 650);

  setTimeout(() => {
    const sonar2 = document.createElement("div");
    sonar2.className = "unlock-sonar";
    sonar2.style.left = `${center.x}px`;
    sonar2.style.top = `${center.y}px`;
    document.body.appendChild(sonar2);
    setTimeout(() => sonar2.remove(), 650);
  }, 150);

  // Update badge to complete star and apply gold accent
  refreshProgressDots();

  btn.classList.add("cv-btn-complete");
}

/* ── Main cinematic pipeline ──────────────────────────────────── */

export async function playCinematicUnlock(
  gateScreenX: number,
  gateScreenY: number,
  stopId: string,
  stopYear: number,
  stopCompany: string,
  completedCount: number,
  totalGates: number,
): Promise<void> {
  if (isPlaying) return;
  isPlaying = true;

  try {
    // Phase 0: "The Seal Break"
    await playVignetteFlash();

    // Phase 1: "Energy Harvest"
    await playEnergyHarvest(gateScreenX, gateScreenY);

    // Phase 2: "The Absorption"
    await playAbsorption(stopId);

    // Phase 3: "The Revelation"
    await playRevelation(stopId, stopCompany, stopYear, completedCount, totalGates);
  } finally {
    isPlaying = false;
  }
}

/* ── Discovery motes + About tab indicator ───────────────────── */

let aboutTabNewPending = false;

/** Add pulsing "new" indicator to the About tab. Call once per discovery. */
export function markAboutTabNew(): void {
  aboutTabNewPending = true;
  applyAboutTabNewToDom();
}

/** Remove indicator — call when user clicks the About tab. */
export function clearAboutTabNew(): void {
  aboutTabNewPending = false;
  document.querySelectorAll(".cv-tab-new-dot").forEach((el) => el.remove());
  const aboutBtn = document.querySelector<HTMLElement>('.cv-tab-btn[data-tab="about"]');
  if (aboutBtn) aboutBtn.classList.remove("cv-tab-btn-new");
}

/** Should be called on CV panel open — applies indicator if still pending. */
export function applyAboutTabNewToDom(): void {
  if (!aboutTabNewPending) return;
  const aboutBtn = document.querySelector<HTMLElement>('.cv-tab-btn[data-tab="about"]');
  if (!aboutBtn) return;
  aboutBtn.classList.add("cv-tab-btn-new");
  if (!aboutBtn.querySelector(".cv-tab-new-dot")) {
    const dot = document.createElement("span");
    dot.className = "cv-tab-new-dot";
    aboutBtn.appendChild(dot);
  }
}

export function shouldShowAboutTabNew(): boolean {
  return aboutTabNewPending;
}

// ── Journey tab "New" indicator ─────────────────────────────────────────────
let journeyTabNewPending = false;

/** Call after a gate is completed to put a pulsing dot on the Journey tab. */
export function markJourneyTabNew(): void {
  journeyTabNewPending = true;
  applyJourneyTabNewToDom();
}

/** Remove the dot — call when user clicks the Journey tab. */
export function clearJourneyTabNew(): void {
  journeyTabNewPending = false;
  document.querySelectorAll(".cv-tab-journey-new-dot").forEach((el) => el.remove());
  const btn = document.querySelector<HTMLElement>('.cv-tab-btn[data-tab="journey"]');
  if (btn) btn.classList.remove("cv-tab-btn-new");
}

/** Apply the indicator if still pending — call on CV panel open. */
export function applyJourneyTabNewToDom(): void {
  if (!journeyTabNewPending) return;
  const btn = document.querySelector<HTMLElement>('.cv-tab-btn[data-tab="journey"]');
  if (!btn) return;
  btn.classList.add("cv-tab-btn-new");
  if (!btn.querySelector(".cv-tab-journey-new-dot")) {
    const dot = document.createElement("span");
    dot.className = "cv-tab-new-dot cv-tab-journey-new-dot";
    btn.appendChild(dot);
  }
}

/**
 * Lightweight discovery mote burst: 3 amber motes fly from the 3D object's
 * screen position to the Resume button, then pulse the button and mark the
 * About tab as new.
 */
export function playDiscoveryMotes(fromX: number, fromY: number): void {
  injectStyles();

  const btn = document.getElementById("cv-btn");
  if (!btn) return;

  const target = getButtonCenter();
  const DISC_MOTE_COUNT = 3;

  interface DMote {
    el: HTMLDivElement;
    bx: number; by: number;
    cx: number; cy: number;
    delay: number; duration: number;
    size: number; arrived: boolean;
  }

  const motes: DMote[] = [];

  for (let i = 0; i < DISC_MOTE_COUNT; i++) {
    const el = document.createElement("div");
    el.className = "unlock-mote unlock-mote-discovery";
    const size = 5 + Math.random() * 3;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.opacity = "0";
    document.body.appendChild(el);

    const angle = (Math.PI * 2 * i) / DISC_MOTE_COUNT + (Math.random() - 0.5) * 0.8;
    const dist = 20 + Math.random() * 30;
    const bx = fromX + Math.cos(angle) * dist;
    const by = fromY + Math.sin(angle) * dist;

    const mx = (bx + target.x) / 2;
    const my = (by + target.y) / 2;
    const perpAngle = Math.atan2(target.y - by, target.x - bx) + Math.PI / 2;
    const arcOff = (Math.random() - 0.5) * 120;
    const cx = mx + Math.cos(perpAngle) * arcOff;
    const cy = my + Math.sin(perpAngle) * arcOff - 30 - Math.random() * 30;

    motes.push({
      el, bx, by, cx, cy,
      delay: i * 70,
      duration: 480 * (0.85 + Math.random() * 0.3),
      size,
      arrived: false,
    });
  }

  const BURST_DUR = 200;
  const t0 = performance.now();
  let arrivedCount = 0;

  function tick(): void {
    const elapsed = performance.now() - t0;
    let allDone = true;

    for (const m of motes) {
      if (m.arrived) continue;
      const localTime = elapsed - m.delay;
      if (localTime < 0) { allDone = false; continue; }

      if (localTime < BURST_DUR) {
        allDone = false;
        const t = localTime / BURST_DUR;
        const e = 1 - (1 - t) ** 3;
        m.el.style.left = `${fromX + (m.bx - fromX) * e - m.size / 2}px`;
        m.el.style.top  = `${fromY + (m.by - fromY) * e - m.size / 2}px`;
        m.el.style.opacity = String(0.3 + t * 0.7);
      } else {
        const travelTime = localTime - BURST_DUR;
        if (travelTime < m.duration) {
          allDone = false;
          const raw = travelTime / m.duration;
          const e = raw < 0.5 ? 2 * raw * raw : 1 - (-2 * raw + 2) ** 2 / 2;
          const omt = 1 - e;
          m.el.style.left = `${omt * omt * m.bx + 2 * omt * e * m.cx + e * e * target.x - m.size / 2}px`;
          m.el.style.top  = `${omt * omt * m.by + 2 * omt * e * m.cy + e * e * target.y - m.size / 2}px`;
          m.el.style.transform = `scale(${1 - e * 0.4})`;
          m.el.style.opacity = String(1 - e * 0.25);
        } else if (!m.arrived) {
          m.arrived = true;
          arrivedCount++;
          spawnSparks(target.x, target.y, 2);
          m.el.remove();

          // Last mote lands → pulse button + mark About tab
          if (arrivedCount === DISC_MOTE_COUNT) {
            btn?.classList.add("cv-btn-absorbing");
            setTimeout(() => btn?.classList.remove("cv-btn-absorbing"), 450);

            // Small sonar ring in amber
            const sonar = document.createElement("div");
            sonar.className = "unlock-sonar";
            sonar.style.cssText = `left:${target.x}px;top:${target.y}px;border-color:rgba(251,191,36,0.7);`;
            document.body.appendChild(sonar);
            setTimeout(() => sonar.remove(), 650);

            markAboutTabNew();
          }
        }
      }
    }

    if (!allDone && arrivedCount < DISC_MOTE_COUNT) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/* ── Init (call once during app setup) ──────────────────────── */

export function initGateUnlockAnimation(): void {
  injectStyles();
  setTimeout(() => {
    refreshProgressDots();
  }, 200);
}
