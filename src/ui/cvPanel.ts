import { TIMELINE_STOPS } from "../scene/timeline/timelineConfig";
import { isStopCompleted } from "../scene/timeline/createTimelineStops";
import { initPhotoLightbox, attachZoomHint } from "./photoLightbox";
import { highlight, injectHighlightStyles } from "./highlightUtils";
import { refreshProgressDots } from "./gateUnlockAnimation";

let panelEl: HTMLDivElement | null = null;
let isOpen = false;

// Track which unlocks the user has already seen (for shimmer animation)
const seenUnlocks = new Set<string>();

// ── Fonts ────────────────────────────────────────────────────────────────────

function loadFont(): void {
  if (document.getElementById("cv-font")) return;
  const link = document.createElement("link");
  link.id = "cv-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

// ── Styles ───────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("cv-styles")) return;
  const s = document.createElement("style");
  s.id = "cv-styles";
  s.textContent = `
    #cv-overlay, #cv-btn { font-family: 'Inter', system-ui, -apple-system, sans-serif; }

    /* ── Button ── */
    #cv-btn {
      position: fixed;
      top: 1.1rem;
      right: 1.25rem;
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.48rem 1rem 0.48rem 0.75rem;
      background: rgba(0,229,204,0.08);
      border: 1px solid rgba(0,229,204,0.35);
      border-radius: 24px;
      color: #00e5cc;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.03em;
      box-shadow: 0 0 16px rgba(0,229,204,0.1);
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.15s;
      animation: cvBtnPulse 3.5s ease-in-out infinite;
    }
    #cv-btn:hover {
      background: rgba(0,229,204,0.16);
      border-color: rgba(0,229,204,0.65);
      box-shadow: 0 0 24px rgba(0,229,204,0.22);
      transform: translateY(-1px);
      animation: none;
    }
    #cv-btn:active { transform: translateY(0) scale(0.97); animation: none; }
    @keyframes cvBtnPulse {
      0%, 100% { box-shadow: 0 0 12px rgba(0,229,204,0.1); }
      50%       { box-shadow: 0 0 22px rgba(0,229,204,0.28); }
    }

    /* ── Overlay ── */
    #cv-overlay {
      position: fixed;
      inset: 0;
      z-index: 2001;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(4,6,16,0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 1.25rem 1rem;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    #cv-overlay.cv-visible { opacity: 1; }

    /* ── Panel shell ── */
    #cv-panel {
      position: relative;
      display: flex;
      flex-direction: column;
      background: linear-gradient(160deg, #0d1117 0%, #111827 60%, #0a0e1a 100%);
      border: 1px solid rgba(0,229,204,0.14);
      border-radius: 20px;
      max-width: 660px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      color: #fff;
      box-shadow:
        0 32px 80px rgba(0,0,0,0.75),
        0 0 0 1px rgba(0,229,204,0.05),
        inset 0 1px 0 rgba(255,255,255,0.04);
      transform: scale(0.96) translateY(16px);
      transition: transform 0.38s cubic-bezier(0.16,1,0.3,1), opacity 0.38s ease;
      opacity: 0;
    }
    #cv-overlay.cv-visible #cv-panel {
      transform: scale(1) translateY(0);
      opacity: 1;
    }

    /* ── Top bar ── */
    #cv-topbar {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      padding: 0.75rem 0.85rem 0 0.85rem;
      background: linear-gradient(to bottom, #0d1117 60%, transparent);
      position: relative;
      z-index: 10;
    }
    #cv-close {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.28rem 0.6rem 0.28rem 0.45rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      color: rgba(255,255,255,0.45);
      font-size: 0.68rem;
      font-weight: 500;
      font-family: 'Inter', system-ui, sans-serif;
      cursor: pointer;
      transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
    }
    #cv-close:hover {
      background: rgba(0,229,204,0.1);
      border-color: rgba(0,229,204,0.35);
      color: #fff;
      transform: scale(1.03);
    }
    #cv-close .cv-esc {
      padding: 1px 5px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.15);
      border-bottom: 2px solid rgba(255,255,255,0.22);
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      font-family: system-ui, monospace;
      color: rgba(255,255,255,0.6);
      line-height: 1.4;
    }

    /* ── Tab bar ── */
    #cv-tabs {
      flex-shrink: 0;
      display: flex;
      gap: 0;
      padding: 0 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      position: relative;
      z-index: 5;
    }
    .cv-tab-btn {
      flex: 1;
      padding: 0.7rem 0.4rem 0.6rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: rgba(255,255,255,0.35);
      font-size: 0.7rem;
      font-weight: 600;
      font-family: 'Inter', system-ui, sans-serif;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: color 0.2s, border-color 0.3s;
      white-space: nowrap;
    }
    .cv-tab-btn:hover { color: rgba(255,255,255,0.65); }
    .cv-tab-btn.active {
      color: #00e5cc;
      border-bottom-color: #00e5cc;
    }

    /* ── Tab content panels ── */
    .cv-tab-panel {
      display: none;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,229,204,0.15) transparent;
      animation: cvTabFade 0.28s ease-out;
    }
    .cv-tab-panel::-webkit-scrollbar { width: 4px; }
    .cv-tab-panel::-webkit-scrollbar-track { background: transparent; }
    .cv-tab-panel::-webkit-scrollbar-thumb { background: rgba(0,229,204,0.18); border-radius: 4px; }
    .cv-tab-panel.active { display: block; }
    @keyframes cvTabFade {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Hero ── */
    #cv-hero {
      position: relative;
      padding: 0 2rem 1.6rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
    }
    #cv-hero-cover {
      position: absolute;
      inset: 0;
      background-image: url('/img/alex-office.png');
      background-size: cover;
      background-position: center 30%;
      opacity: 0.22;
      pointer-events: none;
    }
    #cv-hero-cover-fade {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom,
        rgba(13,17,23,0.15) 0%,
        rgba(13,17,23,0.6) 40%,
        rgba(13,17,23,0.92) 75%,
        rgba(13,17,23,1) 100%);
      pointer-events: none;
    }
    #cv-hero-row {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 1.2rem;
      padding-top: 0.5rem;
    }
    #cv-hero-info { flex: 1; min-width: 0; }
    #cv-name {
      font-size: 1.55rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #fff;
      margin: 0 0 0.15rem;
      line-height: 1.1;
    }
    #cv-title {
      font-size: 0.76rem;
      font-weight: 600;
      color: #00e5cc;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 0.45rem;
    }

    /* ── Availability badge ── */
    #cv-availability {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.22rem 0.7rem 0.22rem 0.5rem;
      background: rgba(74,222,128,0.08);
      border: 1px solid rgba(74,222,128,0.22);
      border-radius: 20px;
      font-size: 0.66rem;
      font-weight: 600;
      color: rgba(74,222,128,0.9);
      margin-bottom: 0.75rem;
    }
    #cv-availability-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 8px rgba(74,222,128,0.6);
      animation: cvAvailPulse 2.5s ease-in-out infinite;
    }
    @keyframes cvAvailPulse {
      0%, 100% { box-shadow: 0 0 6px rgba(74,222,128,0.4); }
      50%       { box-shadow: 0 0 14px rgba(74,222,128,0.8); }
    }

    #cv-summary {
      font-size: 0.8rem;
      line-height: 1.68;
      color: rgba(255,255,255,0.55);
      margin: 0 0 1rem;
    }

    /* ── Signature skills ── */
    #cv-sig-skills {
      margin-bottom: 1rem;
    }
    #cv-sig-skills-label {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.45);
      margin: 0 0 0.4rem;
    }
    #cv-sig-skills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .cv-sig-chip {
      padding: 0.24rem 0.72rem;
      background: rgba(0,229,204,0.08);
      border: 1px solid rgba(0,229,204,0.24);
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
      color: rgba(255,255,255,0.85);
      transition: background 0.15s, border-color 0.15s;
    }
    .cv-sig-chip:hover {
      background: rgba(0,229,204,0.15);
      border-color: rgba(0,229,204,0.45);
      color: #fff;
    }

    /* ── Contact row ── */
    #cv-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      align-items: center;
      margin-bottom: 1.2rem;
    }
    .cv-action-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.36rem 0.8rem;
      border-radius: 8px;
      font-size: 0.72rem;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
      border: 1px solid;
      white-space: nowrap;
    }
    .cv-action-link.secondary {
      color: rgba(255,255,255,0.55);
      border-color: rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.04);
    }
    .cv-action-link.secondary:hover {
      color: #fff;
      border-color: rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.09);
    }
    .cv-action-link.primary {
      color: #00e5cc;
      border-color: rgba(0,229,204,0.35);
      background: rgba(0,229,204,0.08);
      font-weight: 700;
    }
    .cv-action-link.primary:hover {
      background: rgba(0,229,204,0.18);
      border-color: rgba(0,229,204,0.65);
      box-shadow: 0 0 12px rgba(0,229,204,0.2);
    }

    /* ── Journey progress indicator ── */
    #cv-progress {
      position: relative;
      padding: 1rem 0 0.2rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    #cv-progress-label {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.45);
      margin: 0 0 0.7rem;
    }
    #cv-progress-gates {
      display: flex;
      align-items: center;
      gap: 0;
    }
    .cv-pg-gate {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      flex-shrink: 0;
    }
    .cv-pg-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.03);
      transition: all 0.3s ease;
    }
    .cv-pg-gate.completed .cv-pg-dot {
      border-color: #00e5cc;
      background: rgba(0,229,204,0.25);
      box-shadow: 0 0 10px rgba(0,229,204,0.4);
    }
    .cv-pg-year {
      font-size: 0.58rem;
      font-weight: 600;
      color: rgba(255,255,255,0.22);
      letter-spacing: 0.04em;
    }
    .cv-pg-gate.completed .cv-pg-year { color: rgba(0,229,204,0.7); }
    .cv-pg-connector {
      flex: 1;
      height: 2px;
      background: rgba(255,255,255,0.06);
      min-width: 28px;
      margin: 0 0.3rem;
      margin-bottom: 1.2rem;
      transition: background 0.3s;
    }
    .cv-pg-connector.completed { background: rgba(0,229,204,0.35); }
    #cv-progress-count {
      margin-top: 0.6rem;
      font-size: 0.68rem;
      color: rgba(255,255,255,0.3);
      font-weight: 500;
    }
    #cv-progress-count span { color: #00e5cc; font-weight: 700; }

    /* ── Avatar ── */
    #cv-avatar-wrap {
      position: relative;
      flex-shrink: 0;
      width: 78px;
      height: 78px;
      border-radius: 50%;
    }
    #cv-avatar {
      width: 78px;
      height: 78px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center top;
      border: 2.5px solid rgba(0,229,204,0.45);
      box-shadow: 0 0 20px rgba(0,229,204,0.2), 0 4px 16px rgba(0,0,0,0.5);
      display: block;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s, border-color 0.25s;
      pointer-events: none;
      user-select: none;
    }
    #cv-avatar-wrap:hover #cv-avatar {
      transform: scale(1.07);
      border-color: rgba(0,229,204,0.8);
      box-shadow: 0 0 32px rgba(0,229,204,0.38), 0 4px 20px rgba(0,0,0,0.6);
    }

    /* ── Sections ── */
    .cv-section { padding: 1.4rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .cv-section:last-child { border-bottom: none; }
    .cv-section-label {
      font-size: 0.59rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.5);
      margin: 0 0 0.9rem;
    }

    /* ── Experience entries ── */
    .cv-exp-list { display: flex; flex-direction: column; gap: 0; }
    .cv-exp-entry {
      display: grid;
      grid-template-columns: 3px 1fr;
      gap: 0 1rem;
      padding-bottom: 1.75rem;
      position: relative;
      transition: opacity 0.4s, filter 0.4s;
    }
    .cv-exp-entry:last-child { padding-bottom: 0; }

    /* Locked (unexplored) state */
    .cv-exp-entry.cv-locked .cv-exp-body {
      opacity: 0.35;
      filter: saturate(0.2);
    }
    .cv-exp-entry.cv-locked .cv-exp-line { opacity: 0.4; }
    .cv-lock-hint {
      display: none;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.5rem;
      padding: 0.45rem 0.7rem;
      background: rgba(0,229,204,0.04);
      border: 1px dashed rgba(0,229,204,0.18);
      border-radius: 8px;
      font-size: 0.68rem;
      font-style: italic;
      color: rgba(0,229,204,0.6);
      line-height: 1.5;
    }
    .cv-exp-entry.cv-locked .cv-lock-hint { display: flex; }
    .cv-lock-hint svg {
      flex-shrink: 0;
      opacity: 0.7;
    }

    /* Unlock shimmer animation */
    @keyframes cvShimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    .cv-exp-entry.cv-shimmer {
      background: linear-gradient(90deg, transparent 30%, rgba(0,229,204,0.06) 50%, transparent 70%);
      background-size: 200% 100%;
      animation: cvShimmer 1.4s ease-out 1;
      border-radius: 8px;
    }

    .cv-exp-line {
      width: 3px;
      background: rgba(255,255,255,0.07);
      border-radius: 3px;
      position: relative;
      margin-top: 5px;
    }
    .cv-exp-line.active { background: #00e5cc; box-shadow: 0 0 8px rgba(0,229,204,0.45); }
    .cv-exp-line::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15);
      background: #0d1117;
    }
    .cv-exp-line.active::before { border-color: #00e5cc; box-shadow: 0 0 8px rgba(0,229,204,0.55); }

    .cv-exp-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.28rem;
    }
    .cv-exp-period {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
    }
    .cv-exp-period.active { color: #00e5cc; }
    .cv-exp-logo-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 5px;
      padding: 2px 7px;
      height: 22px;
    }
    .cv-exp-logo {
      height: 14px;
      width: auto;
      max-width: 68px;
      object-fit: contain;
    }
    .cv-exp-title { font-size: 0.96rem; font-weight: 700; color: #fff; margin: 0 0 0.12rem; line-height: 1.3; }
    .cv-exp-sub { font-size: 0.7rem; color: rgba(255,255,255,0.36); margin: 0 0 0.65rem; }
    .cv-exp-bullets {
      list-style: none; padding: 0; margin: 0 0 0.7rem;
      display: flex; flex-direction: column; gap: 0.22rem;
    }
    .cv-exp-bullets li {
      font-size: 0.76rem; color: rgba(255,255,255,0.6);
      padding-left: 1rem; position: relative; line-height: 1.58;
    }
    .cv-exp-bullets li::before {
      content: '▸'; position: absolute; left: 0;
      color: rgba(0,229,204,0.55); font-size: 0.65rem; top: 0.08em;
    }
    .cv-exp-skills { display: flex; flex-wrap: wrap; gap: 0.28rem; }
    .cv-exp-skill {
      padding: 0.15rem 0.48rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px;
      font-size: 0.63rem;
      color: rgba(255,255,255,0.46);
    }

    /* ── ASML pivot narrative ── */
    .cv-pivot-note {
      margin-top: 0.65rem;
      padding: 0.5rem 0.7rem;
      border-left: 2px solid rgba(251,191,36,0.3);
      background: rgba(251,191,36,0.03);
      border-radius: 0 6px 6px 0;
      font-size: 0.72rem;
      font-style: italic;
      color: rgba(255,255,255,0.42);
      line-height: 1.6;
    }
    .cv-pivot-note span { color: rgba(251,191,36,0.8); font-weight: 600; }

    /* ── Dot nav (Journey tab left edge) ── */
    .cv-dot-nav {
      position: sticky;
      top: 0;
      float: left;
      width: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      padding: 1.6rem 0 1rem;
      margin-left: 0.5rem;
      z-index: 5;
    }
    .cv-dot-nav-item {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      border: 1.5px solid rgba(255,255,255,0.12);
      cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
    }
    .cv-dot-nav-item:hover {
      background: rgba(0,229,204,0.2);
      border-color: rgba(0,229,204,0.5);
      transform: scale(1.3);
    }
    .cv-dot-nav-item.active {
      background: rgba(0,229,204,0.35);
      border-color: #00e5cc;
      box-shadow: 0 0 8px rgba(0,229,204,0.4);
    }
    .cv-dot-nav-item.completed {
      border-color: rgba(0,229,204,0.3);
    }

    /* ── Stack tab: competency cards ── */
    .cv-competency-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .cv-competency-card {
      padding: 0.9rem 1rem;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-left: 3px solid rgba(0,229,204,0.25);
      border-radius: 0 10px 10px 0;
      transition: border-color 0.2s, background 0.2s;
    }
    .cv-competency-card:hover {
      border-left-color: rgba(0,229,204,0.55);
      background: rgba(255,255,255,0.03);
    }
    .cv-competency-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.55rem;
    }
    .cv-competency-card-label {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.45);
    }
    .cv-competency-card-context {
      font-size: 0.58rem;
      color: rgba(255,255,255,0.2);
      font-style: italic;
    }
    .cv-competency-card-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .cv-competency-chip {
      padding: 0.2rem 0.6rem;
      background: rgba(0,229,204,0.05);
      border: 1px solid rgba(0,229,204,0.16);
      border-radius: 20px;
      font-size: 0.66rem;
      font-weight: 500;
      color: rgba(255,255,255,0.72);
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .cv-competency-chip:hover {
      background: rgba(0,229,204,0.12);
      border-color: rgba(0,229,204,0.38);
      color: #fff;
    }
    .cv-competency-chip.core {
      background: rgba(0,229,204,0.1);
      border-color: rgba(0,229,204,0.3);
      color: rgba(255,255,255,0.9);
      font-weight: 600;
    }

    /* ── About tab ── */
    .cv-about-section {
      padding: 1.4rem 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .cv-about-section:last-child { border-bottom: none; }
    .cv-working-with-me {
      font-size: 0.82rem;
      line-height: 1.72;
      color: rgba(255,255,255,0.6);
      padding: 0.8rem 1rem;
      background: rgba(0,229,204,0.03);
      border: 1px solid rgba(0,229,204,0.1);
      border-radius: 10px;
      position: relative;
    }
    .cv-working-with-me::before {
      content: '"';
      position: absolute;
      top: -0.2rem;
      left: 0.6rem;
      font-size: 2.5rem;
      color: rgba(0,229,204,0.15);
      font-family: Georgia, serif;
      line-height: 1;
    }
    .cv-working-with-me strong { color: rgba(255,255,255,0.85); font-weight: 600; }

    /* Education */
    .cv-edu-row {
      display: grid;
      grid-template-columns: 3px 1fr;
      gap: 0 1rem;
    }
    .cv-edu-line {
      width: 3px;
      background: rgba(255,255,255,0.07);
      border-radius: 3px;
      position: relative;
      margin-top: 5px;
    }
    .cv-edu-line::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 10px; height: 10px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15);
      background: #0d1117;
    }
    #cv-edu-title { font-size: 0.93rem; font-weight: 700; color: #fff; margin: 0 0 0.12rem; }
    #cv-edu-sub { font-size: 0.74rem; color: rgba(255,255,255,0.38); margin: 0; }

    /* Interests */
    .cv-interests-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.3rem;
    }
    .cv-interest-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.65rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      font-size: 0.68rem;
      color: rgba(255,255,255,0.5);
    }

    /* ── Footer ── */
    #cv-footer {
      flex-shrink: 0;
      padding: 0.9rem 2rem 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      background: rgba(0,229,204,0.025);
      border-top: 1px solid rgba(0,229,204,0.08);
    }
    #cv-footer-dl {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 1.3rem;
      background: rgba(0,229,204,0.1);
      border: 1px solid rgba(0,229,204,0.38);
      border-radius: 10px;
      color: #00e5cc;
      text-decoration: none;
      font-size: 0.79rem;
      font-weight: 700;
      font-family: 'Inter', system-ui, sans-serif;
      letter-spacing: 0.03em;
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    #cv-footer-dl:hover {
      background: rgba(0,229,204,0.2);
      border-color: rgba(0,229,204,0.65);
      box-shadow: 0 0 16px rgba(0,229,204,0.2);
    }

    /* ── Inline experience photo ── */
    .cv-exp-photo {
      margin-top: 0.6rem;
      border-radius: 8px;
      overflow: hidden;
      max-width: 180px;
      border: 1px solid rgba(255,255,255,0.08);
      transition: border-color 0.2s;
    }
    .cv-exp-photo:hover { border-color: rgba(0,229,204,0.3); }
    .cv-exp-photo img {
      width: 100%;
      display: block;
    }
    .cv-exp-photo-caption {
      font-size: 0.6rem;
      color: rgba(255,255,255,0.32);
      padding: 0.3rem 0.5rem;
      font-style: italic;
      background: rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(s);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SIGNATURE_SKILLS = ["React", "TypeScript", "Node / NestJS", "Nx Monorepo", "Redis", "Microservices"];

const SKILL_CATEGORIES: { label: string; context: string; skills: { name: string; core?: boolean }[] }[] = [
  {
    label: "Frontend",
    context: "Used across all roles since 2022",
    skills: [
      { name: "React", core: true },
      { name: "TypeScript", core: true },
      { name: "Vue.js" },
      { name: "Redux" },
      { name: "React Query", core: true },
      { name: "MUI" },
      { name: "Storybook" },
      { name: "HTML / CSS" },
      { name: "Responsive Design" },
    ],
  },
  {
    label: "Backend",
    context: "Node.js primary since 2023, PHP/Laravel at Restigo & Triolla",
    skills: [
      { name: "Node.js", core: true },
      { name: "NestJS", core: true },
      { name: "PHP" },
      { name: "Laravel" },
      { name: "Express.js" },
      { name: "REST APIs" },
      { name: "Microservices", core: true },
      { name: "GraphQL" },
    ],
  },
  {
    label: "Data & Storage",
    context: "MySQL at Restigo, Redis + Mongo at Triolla/The5ers",
    skills: [
      { name: "MySQL" },
      { name: "MongoDB" },
      { name: "Redis", core: true },
      { name: "PostgreSQL" },
      { name: "SQL Optimization" },
    ],
  },
  {
    label: "DevOps & Infra",
    context: "CI/CD pipelines, Docker, Nx Monorepo at The5ers",
    skills: [
      { name: "AWS" },
      { name: "Docker" },
      { name: "CI/CD" },
      { name: "Git" },
      { name: "GitHub Actions" },
      { name: "Nx Monorepo", core: true },
      { name: "Linux / Unix" },
    ],
  },
  {
    label: "Engineering & Leadership",
    context: "Led teams at Restigo, trained 6 teams at The5ers",
    skills: [
      { name: "System Design" },
      { name: "Team Leadership", core: true },
      { name: "Agile / Scrum" },
      { name: "Code Review" },
      { name: "Technical Training" },
      { name: "Figma" },
      { name: "API Integration" },
      { name: "Performance Optimization" },
    ],
  },
];

function getCompletedCount(): number {
  return TIMELINE_STOPS.filter((s) => isStopCompleted(s.id)).length;
}

// ── DOM ──────────────────────────────────────────────────────────────────────

function createCVPanel(): void {
  loadFont();
  injectStyles();
  injectHighlightStyles();

  // Button
  const btn = document.createElement("button");
  btn.id = "cv-btn";
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="#00e5cc" stroke-width="1.4"/>
      <path d="M4 5h6M4 7.5h6M4 10h4" stroke="#00e5cc" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    Resume
  `;
  btn.onclick = openCVPanel;
  document.body.appendChild(btn);

  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "cv-overlay";
  overlay.onclick = (e) => { if (e.target === overlay) closeCVPanel(); };

  // Panel
  const panel = document.createElement("div");
  panel.id = "cv-panel";

  // ── Top bar ────────────────────────────────────────────────────────────────
  const topbar = document.createElement("div");
  topbar.id = "cv-topbar";
  topbar.innerHTML = `
    <button id="cv-close">
      <span class="cv-esc">ESC</span>
      <span>Close</span>
      <span style="font-size:1rem;line-height:1;color:rgba(255,255,255,0.35);">&times;</span>
    </button>
  `;
  topbar.querySelector("#cv-close")!.addEventListener("click", closeCVPanel);
  panel.appendChild(topbar);

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const tabs = document.createElement("div");
  tabs.id = "cv-tabs";
  const tabDefs = [
    { id: "overview", label: "Overview" },
    { id: "journey", label: "Journey" },
    { id: "stack", label: "Stack" },
    { id: "about", label: "About" },
  ];
  tabDefs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = `cv-tab-btn${t.id === "overview" ? " active" : ""}`;
    btn.dataset.tab = t.id;
    btn.textContent = t.label;
    btn.onclick = () => switchTab(t.id);
    tabs.appendChild(btn);
  });
  panel.appendChild(tabs);

  // ── Tab content wrapper ────────────────────────────────────────────────────
  const contentWrap = document.createElement("div");
  contentWrap.id = "cv-tab-content";
  contentWrap.style.cssText = "flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;";

  contentWrap.appendChild(buildOverviewTab());
  contentWrap.appendChild(buildJourneyTab());
  contentWrap.appendChild(buildStackTab());
  contentWrap.appendChild(buildAboutTab());

  panel.appendChild(contentWrap);

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footer = document.createElement("div");
  footer.id = "cv-footer";
  footer.innerHTML = `
    <a id="cv-footer-dl" href="/AL_CV_TH5_v1.pdf" download="Alexander_Lazarovich_CV.pdf">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v8M4 7l3 3 3-3M1 12h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Download Full CV
    </a>
  `;
  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  panelEl = overlay;

  // ── Headshot zoom ──────────────────────────────────────────────────────────
  initPhotoLightbox();
  const avatarWrap = panel.querySelector<HTMLDivElement>("#cv-avatar-wrap")!;
  attachZoomHint(
    avatarWrap,
    () => "/img/alex-headshot.png",
    { shape: "circle", caption: "Alexander Lazarovich · Full Stack Engineer", hintSize: 18 },
  );

  // ── Setup dot-nav scroll tracking ──────────────────────────────────────────
  setupDotNav();

  const the5ersPhotoEl = document.getElementById("cv-the5ers-photo");
  if (the5ersPhotoEl) {
    attachZoomHint(
      the5ersPhotoEl,
      () => "/img/alex-teaching.png",
      { shape: "rect", caption: "Architecture training session — The5ers, 2024", hintSize: 16 },
    );
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && isOpen) closeCVPanel();
  });
}

// ── Tab builders ─────────────────────────────────────────────────────────────

function buildOverviewTab(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "cv-tab-panel active";
  panel.id = "cv-tab-overview";

  // Hero
  const hero = document.createElement("div");
  hero.id = "cv-hero";
  hero.innerHTML = `
    <div id="cv-hero-cover"></div>
    <div id="cv-hero-cover-fade"></div>
    <div id="cv-hero-row">
      <div id="cv-avatar-wrap">
        <img id="cv-avatar" src="/img/alex-headshot.png" alt="Alexander Lazarovich" draggable="false" />
      </div>
      <div id="cv-hero-info">
        <h1 id="cv-name">Alexander Lazarovich</h1>
        <p id="cv-title">Full Stack Engineer &nbsp;·&nbsp; 5+ Years</p>
        <div id="cv-availability">
          <div id="cv-availability-dot"></div>
          Open to opportunities &nbsp;·&nbsp; Full-time / Contract
        </div>
        <p id="cv-summary">
          Full-stack engineer across semiconductor (<span class="hl-key">ASML/Intel</span>), <span class="hl-key">B2B SaaS</span>, and <span class="hl-key">proprietary trading</span>.
          <span class="hl-key">Led teams</span>, shipped <span class="hl-key">AI platforms</span>, and architected microservices serving <span class="hl-metric">100K+ active users</span>.
          Deep <span class="hl-key">React &amp; TypeScript</span> expertise paired with strong backend and cloud infra.
        </p>
        <div id="cv-sig-skills">
          <p id="cv-sig-skills-label">Signature Stack</p>
          <div id="cv-sig-skills-row">
            ${SIGNATURE_SKILLS.map((s) => `<span class="cv-sig-chip">${s}</span>`).join("")}
          </div>
        </div>
        <div id="cv-actions">
          <a class="cv-action-link secondary" href="https://www.linkedin.com/in/alexander-lazarovich/"
            target="_blank" rel="noopener">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
            </svg>
            LinkedIn
          </a>
          <a class="cv-action-link secondary" href="mailto:alex.lazarovichh@gmail.com">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z"/>
            </svg>
            Email
          </a>
          <a class="cv-action-link secondary" href="tel:+972544567302">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
            </svg>
            +972 544 567 302
          </a>
          <a class="cv-action-link primary" href="/AL_CV_TH5_v1.pdf" download="Alexander_Lazarovich_CV.pdf">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 7l3 3 3-3M1 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download CV
          </a>
        </div>
      </div>
    </div>
  `;
  panel.appendChild(hero);

  // Journey progress indicator
  const progress = document.createElement("div");
  progress.id = "cv-progress";
  progress.style.padding = "1.2rem 2rem 1rem";
  progress.innerHTML = buildProgressHTML();
  panel.appendChild(progress);

  return panel;
}

function buildProgressHTML(): string {
  const count = getCompletedCount();
  const total = TIMELINE_STOPS.length;

  let gatesHtml = "";
  TIMELINE_STOPS.forEach((stop, i) => {
    const completed = isStopCompleted(stop.id);
    if (i > 0) {
      const connectorDone = isStopCompleted(TIMELINE_STOPS[i - 1].id) && completed;
      gatesHtml += `<div class="cv-pg-connector${connectorDone ? " completed" : ""}"></div>`;
    }
    gatesHtml += `
      <div class="cv-pg-gate${completed ? " completed" : ""}">
        <div class="cv-pg-dot"></div>
        <span class="cv-pg-year">${stop.year}</span>
      </div>
    `;
  });

  return `
    <p id="cv-progress-label">Journey Progress</p>
    <div id="cv-progress-gates">${gatesHtml}</div>
    <p id="cv-progress-count"><span>${count}</span> of ${total} milestones explored</p>
  `;
}

function buildJourneyTab(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "cv-tab-panel";
  panel.id = "cv-tab-journey";

  // Dot nav
  const dotNav = document.createElement("div");
  dotNav.className = "cv-dot-nav";
  dotNav.id = "cv-journey-dots";

  const expSection = document.createElement("div");
  expSection.className = "cv-section";
  expSection.style.position = "relative";
  expSection.innerHTML = `<p class="cv-section-label">Experience</p>`;

  const expList = document.createElement("div");
  expList.className = "cv-exp-list";

  [...TIMELINE_STOPS].reverse().forEach((stop, i) => {
    const isLatest = i === 0;
    const dashIdx = stop.title.indexOf(" — ");
    const company = dashIdx >= 0 ? stop.title.slice(0, dashIdx) : stop.title;
    const role    = dashIdx >= 0 ? stop.title.slice(dashIdx + 3) : "";

    const periodMatch = stop.subtitle.match(/([A-Z][a-z]{2}\s\d{4})\s[–-]\s([A-Z][a-z]{2}\s\d{4}|Present)/);
    const period = periodMatch
      ? `${periodMatch[1]} – ${periodMatch[2]}`
      : (stop.subtitle.split("·")[1]?.trim() ?? String(stop.year));

    const subParts = stop.subtitle.split("·").slice(2).map((p) => p.trim()).filter(Boolean);
    const subLine  = subParts.join(" · ");

    const logoHtml = stop.logo
      ? `<span class="cv-exp-logo-wrap"><img class="cv-exp-logo" src="${stop.logo}" alt="${company}" /></span>`
      : "";

    // ASML career pivot narrative
    const pivotHtml = stop.id === "asml"
      ? `<div class="cv-pivot-note">
          The discipline of debugging <span>million-dollar lithography machines under fab-uptime pressure</span> shaped an engineering mindset
          that carries into every system I build today — <span>methodical root-cause analysis</span>, documentation-first, and zero tolerance for flaky systems.
        </div>`
      : "";

    const photoHtml = stop.id === "the5ers"
      ? `<div class="cv-exp-photo" id="cv-the5ers-photo">
           <img src="/img/alex-teaching.png" alt="Architecture training session" />
           <div class="cv-exp-photo-caption">Architecture training session — The5ers, 2024</div>
         </div>`
      : "";

    const entry = document.createElement("div");
    entry.className = "cv-exp-entry";
    entry.dataset.stopId = stop.id;
    entry.id = `cv-exp-${stop.id}`;
    entry.innerHTML = `
      <div class="cv-exp-line${isLatest ? " active" : ""}"></div>
      <div class="cv-exp-body">
        <div class="cv-exp-meta">
          <span class="cv-exp-period${isLatest ? " active" : ""}">${period}</span>
          ${logoHtml}
        </div>
        <div class="cv-exp-title">${company}</div>
        <div class="cv-exp-sub">${role}${subLine ? ` · ${subLine}` : ""}</div>
        <ul class="cv-exp-bullets">
          ${stop.bullets.map((b) => `<li>${highlight(b)}</li>`).join("")}
        </ul>
        <div class="cv-exp-skills">
          ${(stop.skills ?? []).map((s) => `<span class="cv-exp-skill">${s}</span>`).join("")}
        </div>
        ${photoHtml}
        ${pivotHtml}
        <div class="cv-lock-hint">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
            <rect x="3" y="7" width="10" height="7" rx="1.5"/>
          </svg>
          Walk through the ${stop.year} gate to see this story come alive
        </div>
      </div>
    `;
    expList.appendChild(entry);

    // Dot nav item
    const dot = document.createElement("div");
    dot.className = "cv-dot-nav-item";
    dot.dataset.stopId = stop.id;
    dot.title = `${stop.year} · ${company}`;
    dot.onclick = () => {
      entry.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    dotNav.appendChild(dot);
  });

  expSection.appendChild(expList);
  panel.appendChild(dotNav);
  panel.appendChild(expSection);

  return panel;
}

function buildStackTab(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "cv-tab-panel";
  panel.id = "cv-tab-stack";

  const section = document.createElement("div");
  section.className = "cv-section";
  section.innerHTML = `<p class="cv-section-label">Competency Map</p>`;

  const grid = document.createElement("div");
  grid.className = "cv-competency-grid";

  SKILL_CATEGORIES.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "cv-competency-card";
    card.innerHTML = `
      <div class="cv-competency-card-header">
        <span class="cv-competency-card-label">${cat.label}</span>
        <span class="cv-competency-card-context">${cat.context}</span>
      </div>
      <div class="cv-competency-card-chips">
        ${cat.skills.map((s) =>
          `<span class="cv-competency-chip${s.core ? " core" : ""}">${s.name}</span>`
        ).join("")}
      </div>
    `;
    grid.appendChild(card);
  });

  section.appendChild(grid);
  panel.appendChild(section);

  return panel;
}

function buildAboutTab(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "cv-tab-panel";
  panel.id = "cv-tab-about";

  // Working With Me
  const workingSection = document.createElement("div");
  workingSection.className = "cv-about-section";
  workingSection.innerHTML = `
    <p class="cv-section-label">Working With Me</p>
    <div class="cv-working-with-me">
      I thrive in <strong>high-ownership environments</strong> where engineers own their systems end-to-end.
      I <strong>document before I build</strong>, I <strong>mentor by pairing</strong>, and I'll step in at 2AM if production needs it.
      I care deeply about <strong>developer experience</strong> — clean APIs, consistent patterns, and tooling that makes the team faster.
      I treat code review as teaching, not gatekeeping.
    </div>
  `;
  panel.appendChild(workingSection);

  // Education
  const eduSection = document.createElement("div");
  eduSection.className = "cv-about-section";
  eduSection.innerHTML = `
    <p class="cv-section-label">Education</p>
    <div class="cv-edu-row">
      <div class="cv-edu-line"></div>
      <div>
        <p id="cv-edu-title">B.Sc. Electrical &amp; Electronics Engineering</p>
        <p id="cv-edu-sub">Ariel University &nbsp;·&nbsp; Israel</p>
      </div>
    </div>
  `;
  panel.appendChild(eduSection);

  // Interests
  const interestsSection = document.createElement("div");
  interestsSection.className = "cv-about-section";
  interestsSection.innerHTML = `
    <p class="cv-section-label">Beyond the Code</p>
    <div class="cv-interests-row">
      <span class="cv-interest-tag">🏍️ Motorcycles</span>
      <span class="cv-interest-tag">🚵 Mountain Biking</span>
      <span class="cv-interest-tag">🎮 3D / Game Dev</span>
      <span class="cv-interest-tag">📐 System Design</span>
      <span class="cv-interest-tag">✈️ Travel</span>
    </div>
  `;
  panel.appendChild(interestsSection);

  return panel;
}

// ── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tabId: string): void {
  document.querySelectorAll(".cv-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.tab === tabId);
  });
  document.querySelectorAll(".cv-tab-panel").forEach((panel) => {
    const isActive = panel.id === `cv-tab-${tabId}`;
    panel.classList.toggle("active", isActive);
    if (isActive) {
      // Re-trigger fade animation
      (panel as HTMLElement).style.animation = "none";
      void (panel as HTMLElement).offsetHeight;
      (panel as HTMLElement).style.animation = "";
    }
  });
}

// ── Dot nav scroll tracking ──────────────────────────────────────────────────

function setupDotNav(): void {
  const journeyPanel = document.getElementById("cv-tab-journey");
  if (!journeyPanel) return;

  journeyPanel.addEventListener("scroll", () => {
    const entries = journeyPanel.querySelectorAll<HTMLElement>(".cv-exp-entry[data-stop-id]");
    const dots = document.querySelectorAll<HTMLElement>(".cv-dot-nav-item[data-stop-id]");
    const panelRect = journeyPanel.getBoundingClientRect();
    const panelCenter = panelRect.top + panelRect.height / 2;

    let closestId = "";
    let closestDist = Infinity;

    entries.forEach((entry) => {
      const rect = entry.getBoundingClientRect();
      const entryCenter = rect.top + rect.height / 2;
      const dist = Math.abs(entryCenter - panelCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = entry.dataset.stopId ?? "";
      }
    });

    dots.forEach((dot) => {
      dot.classList.toggle("active", dot.dataset.stopId === closestId);
    });
  });
}

// ── Living Dossier: refresh unlock states ────────────────────────────────────

function refreshDynamicContent(): void {
  // Update journey progress in Overview tab
  const progressEl = document.getElementById("cv-progress");
  if (progressEl) {
    progressEl.innerHTML = buildProgressHTML();
  }

  // Update experience entry unlock states in Journey tab
  document.querySelectorAll<HTMLElement>(".cv-exp-entry[data-stop-id]").forEach((entry) => {
    const id = entry.dataset.stopId!;
    const completed = isStopCompleted(id);

    if (completed) {
      entry.classList.remove("cv-locked");

      // Play shimmer if this is a newly-seen unlock
      if (!seenUnlocks.has(id)) {
        seenUnlocks.add(id);
        entry.classList.add("cv-shimmer");
        setTimeout(() => entry.classList.remove("cv-shimmer"), 1500);
      }
    } else {
      entry.classList.add("cv-locked");
      entry.classList.remove("cv-shimmer");
    }
  });

  // Update dot-nav completion state
  document.querySelectorAll<HTMLElement>(".cv-dot-nav-item[data-stop-id]").forEach((dot) => {
    const id = dot.dataset.stopId!;
    dot.classList.toggle("completed", isStopCompleted(id));
  });
}

// ── Open / Close ─────────────────────────────────────────────────────────────

function openCVPanel(): void {
  if (!panelEl) return;
  isOpen = true;
  refreshDynamicContent();
  refreshProgressDots();
  panelEl.style.display = "flex";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    panelEl!.classList.add("cv-visible");
  }));
}

function closeCVPanel(): void {
  if (!panelEl) return;
  isOpen = false;
  panelEl.classList.remove("cv-visible");
  setTimeout(() => { if (!isOpen) panelEl!.style.display = "none"; }, 360);
}

export function initCVPanel(): void {
  createCVPanel();
}
