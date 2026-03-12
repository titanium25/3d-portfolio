import { TIMELINE_STOPS } from "../scene/timeline/timelineConfig";
import { isStopCompleted } from "../scene/timeline/createTimelineStops";
import { initPhotoLightbox, attachZoomHint } from "./photoLightbox";
import { highlight, injectHighlightStyles } from "./highlightUtils";
import { refreshProgressDots, applyAboutTabNewToDom, clearAboutTabNew, applyJourneyTabNewToDom, clearJourneyTabNew } from "./gateUnlockAnimation";
import { isDiscovered } from "./discoveryTracker";

let panelEl: HTMLDivElement | null = null;
let isOpen = false;

// Track which unlocks the user has already seen (for shimmer animation)
const seenUnlocks = new Set<string>();

// ── Discovery photo data ──────────────────────────────────────────────────────

interface PhotoEntry { src: string; caption: string; objectPosition?: string; }

const CARD_PHOTOS: Record<string, PhotoEntry[]> = {
  bmw: [
    { src: "/img/discoveries/bmw-real-1.png", caption: "Tel Aviv nightride · 199hp of \"I should not be doing this on a Tuesday\"", objectPosition: "bottom 15%" },
    { src: "/img/discoveries/bmw-real-2.png", caption: "The Shark wrap · yes, the dentist asked if I have a death wish",            objectPosition: "center center" },
  ],
  mtb: [
    { src: "/img/discoveries/mtb-riding.png", caption: "05:30 AM · 80 km done before my first standup",                              objectPosition: "center 75%" },
    { src: "/img/discoveries/mtb-bike.png",   caption: "Full-carbon hardtail · weighs less than my node_modules folder",              objectPosition: "center 60%" },
    { src: "/img/discoveries/mtb-road.png",   caption: "Road ride · Ra'anana promenade",                                              objectPosition: "center 40%" },
  ],
  lego: [
    { src: "/img/discoveries/lego-building.png", caption: "Mid-build chaos — sorted by part type, RGB ambiance mandatory",              objectPosition: "center center" },
    { src: "/img/discoveries/lego-bmw.png",      caption: "BMW M1000RR Technic · 1,920 pieces · 0 leftover (I counted twice)",         objectPosition: "center center" },
    { src: "/img/discoveries/lego-yamaha.png",   caption: "Yamaha MT-10 Technic · built with the twins, they did the stickers",         objectPosition: "center center" },
  ],
  meny: [
    { src: "/img/discoveries/meny-1.png", caption: "Meny (Manfred) at the park · 45 kg of Ice Age energy and zero personal space",    objectPosition: "center 20%" },
    { src: "/img/discoveries/meny-2.png", caption: "Posing for the camera · he knows exactly what he's doing",                         objectPosition: "center 15%" },
  ],
  twins: [
    { src: "/img/discoveries/twins-stroller.png", caption: "Leading the way · Tomer & Alma with Meny on the path", objectPosition: "center center" },
    { src: "/img/discoveries/twins-walking.png", caption: "Jacaranda season · purple petals and tiny explorers", objectPosition: "center center" },
  ],
};

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
      top: calc(1rem + env(safe-area-inset-top, 0px));
      right: calc(1.25rem + env(safe-area-inset-right, 0px));
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.52rem 1.1rem 0.52rem 0.85rem;
      background: rgba(6,11,20,0.88);
      border: 1px solid rgba(0,229,204,0.4);
      border-radius: 5px;
      color: #00e5cc;
      cursor: pointer;
      white-space: nowrap;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow:
        0 0 20px rgba(0,229,204,0.12),
        0 4px 16px rgba(0,0,0,0.6),
        inset 0 1px 0 rgba(255,255,255,0.04);
      transition: background 0.2s ease, border-color 0.25s ease, box-shadow 0.3s ease, transform 0.15s ease;
      animation: cvBtnIdle 5s ease-in-out infinite;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    /* Scanline + accent layer — position:absolute overlay so overflow:hidden
       never touches the badge which is appended directly to #cv-btn */
    .cv-btn-inner {
      position: absolute;
      inset: 0;
      border-radius: 4px;
      overflow: hidden;
      pointer-events: none;
    }
    /* Scanline sweep */
    .cv-btn-inner::before {
      content: '';
      position: absolute;
      top: 0; bottom: 0;
      width: 70px;
      left: -70px;
      background: linear-gradient(
        to right,
        transparent,
        rgba(0,229,204,0.1) 35%,
        rgba(255,255,255,0.18) 50%,
        rgba(0,229,204,0.1) 65%,
        transparent
      );
      animation: cvBtnScan 7s ease-in-out infinite 2s;
    }
    @keyframes cvBtnScan {
      0%   { left: -70px; }
      100% { left: calc(100% + 70px); }
    }
    /* Bottom accent line */
    .cv-btn-inner::after {
      content: '';
      position: absolute;
      bottom: 0; left: 15%; right: 15%;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba(0,229,204,0.75) 50%, transparent);
      opacity: 0.45;
      transition: opacity 0.25s ease, left 0.25s ease, right 0.25s ease;
    }
    #cv-btn:hover .cv-btn-inner::after { opacity: 1; left: 5%; right: 5%; }
    /* Corner brackets (DOM spans, not pseudo) */
    .cv-btn-tl, .cv-btn-br {
      position: absolute;
      width: 7px; height: 7px;
      pointer-events: none;
      transition: width 0.22s ease, height 0.22s ease, border-color 0.22s ease;
    }
    .cv-btn-tl {
      top: 3px; left: 3px;
      border-top: 1.5px solid rgba(0,229,204,0.5);
      border-left: 1.5px solid rgba(0,229,204,0.5);
    }
    .cv-btn-br {
      bottom: 3px; right: 3px;
      border-bottom: 1.5px solid rgba(0,229,204,0.5);
      border-right: 1.5px solid rgba(0,229,204,0.5);
    }
    #cv-btn:hover .cv-btn-tl,
    #cv-btn:hover .cv-btn-br { width: 12px; height: 12px; border-color: #00e5cc; }
    /* Hover */
    #cv-btn:hover {
      background: rgba(0,229,204,0.07);
      border-color: rgba(0,229,204,0.72);
      box-shadow:
        0 0 38px rgba(0,229,204,0.28),
        0 4px 16px rgba(0,0,0,0.6),
        inset 0 1px 0 rgba(255,255,255,0.07);
      transform: translateY(-1px);
      animation-play-state: paused;
    }
    #cv-btn:active { transform: translateY(0) scale(0.96); animation-play-state: paused; }
    #cv-btn:focus-visible { outline: 2px solid rgba(0,229,204,0.7); outline-offset: 3px; }
    @keyframes cvBtnIdle {
      0%, 100% {
        box-shadow: 0 0 16px rgba(0,229,204,0.1), 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04);
        border-color: rgba(0,229,204,0.38);
      }
      50% {
        box-shadow: 0 0 32px rgba(0,229,204,0.22), 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
        border-color: rgba(0,229,204,0.58);
      }
    }
    /* Icon */
    .cv-btn-icon { flex-shrink: 0; opacity: 0.85; transition: opacity 0.2s ease, transform 0.2s ease; }
    #cv-btn:hover .cv-btn-icon { opacity: 1; transform: scale(1.12); }
    /* Text stack */
    .cv-btn-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.1rem;
      line-height: 1;
    }
    .cv-btn-label {
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #00e5cc;
      transition: color 0.2s ease;
    }
    #cv-btn:hover .cv-btn-label { color: #fff; }
    .cv-btn-sub {
      font-size: 0.57rem;
      font-weight: 500;
      letter-spacing: 0.07em;
      color: rgba(0,229,204,0.42);
      font-family: 'Courier New', Courier, monospace;
      transition: color 0.2s ease;
    }
    #cv-btn:hover .cv-btn-sub { color: rgba(0,229,204,0.72); }
    /* Mobile: hide subtitle, ensure 44px touch target */
    @media (max-width: 480px) {
      #cv-btn { padding: 0 0.85rem; min-height: 44px; }
      .cv-btn-sub { display: none; }
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
      transform: scale(0.9) translateY(36px);
      filter: blur(8px);
      transition: transform 0.52s cubic-bezier(0.16,1,0.3,1), opacity 0.38s ease, filter 0.44s ease;
      opacity: 0;
    }
    #cv-overlay.cv-visible #cv-panel {
      transform: scale(1) translateY(0);
      filter: blur(0px);
      opacity: 1;
    }

    /* ── Top bar ── */
    #cv-topbar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.72rem 0.9rem 0 1.1rem;
      background: linear-gradient(to bottom, #0d1117 60%, transparent);
      position: relative;
      z-index: 10;
    }
    #cv-panel-title {
      font-size: 0.54rem;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.28);
      font-family: 'Courier New', Courier, monospace;
      user-select: none;
    }
    #cv-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 50%;
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition:
        background 0.22s ease,
        border-color 0.22s ease,
        color 0.22s ease,
        box-shadow 0.22s ease,
        transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
    }
    #cv-close:hover {
      background: rgba(239,68,68,0.13);
      border-color: rgba(239,68,68,0.42);
      color: rgba(252,165,165,0.92);
      transform: scale(1.14);
      box-shadow: 0 0 18px rgba(239,68,68,0.22), 0 4px 12px rgba(0,0,0,0.3);
    }
    #cv-close:active { transform: scale(0.88); }
    /* Ripple burst on click */
    #cv-close::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: rgba(239,68,68,0.3);
      transform: scale(0);
      opacity: 1;
    }
    #cv-close:active::after {
      transform: scale(2.5);
      opacity: 0;
      transition: transform 0.38s ease-out, opacity 0.38s ease-out;
    }
    /* X icon rotation on hover */
    .cv-close-x {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.32s cubic-bezier(0.34,1.56,0.64,1);
    }
    #cv-close:hover .cv-close-x { transform: rotate(90deg); }

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
      border-bottom-color: transparent;
    }
    /* Sliding tab indicator */
    #cv-tab-slider {
      position: absolute;
      bottom: -1px;
      height: 2px;
      background: linear-gradient(90deg, #00e5cc 0%, #00b8a0 100%);
      border-radius: 2px 2px 0 0;
      box-shadow: 0 0 16px rgba(0,229,204,0.7), 0 0 4px rgba(0,229,204,0.4);
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }

    /* ── Tab content panels ── */
    .cv-tab-panel {
      display: none;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,229,204,0.15) transparent;
      animation: cvTabFade 0.36s cubic-bezier(0.16,1,0.3,1);
    }
    .cv-tab-panel::-webkit-scrollbar { width: 4px; }
    .cv-tab-panel::-webkit-scrollbar-track { background: transparent; }
    .cv-tab-panel::-webkit-scrollbar-thumb { background: rgba(0,229,204,0.18); border-radius: 4px; }
    .cv-tab-panel.active { display: block; }
    @keyframes cvTabFade {
      from { opacity: 0; transform: translateY(14px); }
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
      opacity: 0.28;
      pointer-events: none;
      transition: opacity 0.4s ease;
    }
    #cv-panel:hover #cv-hero-cover { opacity: 0.33; }
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
      font-size: 1.62rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #fff;
      margin: 0 0 0.15rem;
      line-height: 1.1;
      text-shadow: 0 2px 24px rgba(0,0,0,0.5);
    }
    #cv-title {
      font-size: 0.74rem;
      font-weight: 600;
      color: #00e5cc;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 0.45rem;
      opacity: 0.9;
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
      transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
      animation: cvChipSlideIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes cvChipSlideIn {
      from { opacity: 0; transform: translateY(10px) scale(0.85); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .cv-sig-chip:hover {
      background: rgba(0,229,204,0.16);
      border-color: rgba(0,229,204,0.5);
      color: #fff;
      transform: translateY(-1px);
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
      padding: 1rem 0 0.2rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    #cv-progress-label {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.45);
      margin: 0 0 0.35rem;
    }
    #cv-progress-count {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.55);
      font-weight: 500;
      margin: 0;
    }
    #cv-progress-count span { color: #00e5cc; font-weight: 700; }
    #cv-progress-dots-row {
      display: flex;
      align-items: center;
      gap: 0;
      margin: 0.45rem 0 0.55rem;
    }
    .cv-progress-dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
      border: 1.5px solid rgba(255,255,255,0.13);
      flex-shrink: 0;
      transition: background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease;
    }
    .cv-progress-dot.filled {
      background: rgba(0,229,204,0.35);
      border-color: #00e5cc;
      box-shadow: 0 0 10px rgba(0,229,204,0.55);
    }
    .cv-progress-bar {
      flex: 1;
      height: 2px;
      background: rgba(255,255,255,0.06);
      border-radius: 2px;
      overflow: hidden;
    }
    .cv-progress-bar-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, #00e5cc, #0066ff);
      transition: width 0.8s cubic-bezier(0.16,1,0.3,1);
    }

    /* ── Avatar ── */
    @property --cvRingAngle {
      syntax: '<angle>';
      initial-value: 0deg;
      inherits: false;
    }
    @keyframes cvRingSpin { to { --cvRingAngle: 360deg; } }
    #cv-avatar-wrap {
      position: relative;
      flex-shrink: 0;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      padding: 2.5px;
      background: conic-gradient(from var(--cvRingAngle), #00e5cc 0%, #0066ff 28%, #7c3aed 56%, #f59e0b 78%, #00e5cc 100%);
      animation: cvRingSpin 5s linear infinite;
      box-shadow: 0 0 22px rgba(0,229,204,0.25), 0 4px 20px rgba(0,0,0,0.55);
      cursor: pointer;
    }
    #cv-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      object-position: center top;
      border: 2.5px solid #0d1117;
      display: block;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
      pointer-events: none;
      user-select: none;
    }
    #cv-avatar-wrap:hover { animation-play-state: paused; }
    #cv-avatar-wrap:hover #cv-avatar {
      transform: scale(1.06);
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

    /* ── Explored badge ── */
    .cv-explored-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.12rem 0.45rem;
      background: rgba(0,229,204,0.08);
      border: 1px solid rgba(0,229,204,0.25);
      border-radius: 10px;
      font-size: 0.56rem;
      font-weight: 700;
      color: rgba(0,229,204,0.75);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      animation: cvBadgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes cvBadgePop {
      0%   { transform: scale(0); opacity: 0; }
      60%  { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }

    /* Shimmer animation (still plays on newly-explored entries) */
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

    /* ── Role narrative blurb ── */
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
      width: 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      padding: 1.6rem 0 1rem;
      margin-left: 0.15rem;
      margin-right: 0.65rem;
      z-index: 5;
    }
    .cv-dot-nav-item {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      z-index: 2;
    }
    .cv-dot-nav-item::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: 1.5px solid rgba(255,255,255,0.12);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      flex-shrink: 0;
    }
    .cv-dot-nav-item:hover::before {
      background: rgba(0,229,204,0.2);
      border-color: rgba(0,229,204,0.5);
      transform: scale(1.35);
      box-shadow: 0 0 10px rgba(0,229,204,0.25);
    }
    .cv-dot-nav-item.active::before {
      width: 9px;
      height: 9px;
      background: rgba(0,229,204,0.4);
      border-color: #00e5cc;
      box-shadow: 0 0 10px rgba(0,229,204,0.5);
      animation: cvDotPulse 2.4s ease-in-out infinite;
    }
    @keyframes cvDotPulse {
      0%, 100% { box-shadow: 0 0 6px rgba(0,229,204,0.3); }
      50%       { box-shadow: 0 0 14px rgba(0,229,204,0.6); }
    }
    .cv-dot-nav-item.completed::before {
      background: rgba(0,229,204,0.15);
      border-color: rgba(0,229,204,0.35);
    }
    /* Connecting rail behind dots */
    .cv-dot-nav-rail {
      position: absolute;
      top: 1.6rem;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      width: 1px;
      background: linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.06) 10%, rgba(255,255,255,0.06) 90%, transparent 100%);
      z-index: 1;
      pointer-events: none;
    }
    /* Year tooltip on hover */
    .cv-dot-nav-item .cv-dot-year {
      position: absolute;
      left: calc(100% + 2px);
      top: 50%;
      transform: translateY(-50%) translateX(-4px);
      opacity: 0;
      padding: 0.15rem 0.4rem;
      background: rgba(6, 10, 20, 0.92);
      border: 1px solid rgba(0,229,204,0.2);
      border-radius: 5px;
      font-size: 0.54rem;
      font-weight: 700;
      color: rgba(0,229,204,0.8);
      letter-spacing: 0.06em;
      white-space: nowrap;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .cv-dot-nav-item:hover .cv-dot-year {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }

    /* ── Stack tab: stats banner ── */
    .cv-stack-banner {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 1.1rem 2rem 0.9rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .cv-stack-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.12rem;
      flex: 1;
      text-align: center;
    }
    .cv-stack-stat-num {
      font-size: 1.45rem;
      font-weight: 800;
      color: #00e5cc;
      letter-spacing: -0.04em;
      line-height: 1;
      text-shadow: 0 0 20px rgba(0,229,204,0.4);
      animation: cvStatCount 0.6s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes cvStatCount {
      from { opacity: 0; transform: translateY(8px) scale(0.8); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .cv-stack-stat:nth-child(1) .cv-stack-stat-num { animation-delay: 0.05s; }
    .cv-stack-stat:nth-child(3) .cv-stack-stat-num { animation-delay: 0.12s; }
    .cv-stack-stat:nth-child(5) .cv-stack-stat-num { animation-delay: 0.19s; }
    .cv-stack-stat:nth-child(7) .cv-stack-stat-num { animation-delay: 0.26s; }
    .cv-stack-stat-label {
      font-size: 0.52rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
    }
    .cv-stack-divider {
      width: 1px;
      height: 28px;
      background: rgba(255,255,255,0.07);
    }

    /* ── Stack tab: competency cards ── */
    .cv-competency-grid {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    @keyframes cvCardIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    .cv-competency-card {
      padding: 1rem 1.1rem 0.9rem;
      background: rgba(255,255,255,0.018);
      border: 1px solid rgba(255,255,255,0.065);
      border-radius: 14px;
      position: relative;
      overflow: hidden;
      animation: cvCardIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
      transition:
        transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
        box-shadow 0.28s ease,
        border-color 0.28s ease,
        background 0.28s ease;
    }
    .cv-competency-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255,255,255,0.11);
      background: rgba(255,255,255,0.03);
      box-shadow: 0 10px 28px rgba(0,0,0,0.35);
    }
    /* Colored top glow line using CSS var from inline style */
    .cv-competency-card::before {
      content: '';
      position: absolute;
      top: 0; left: 1rem; right: 1rem;
      height: 1.5px;
      background: var(--cat-color, #00e5cc);
      border-radius: 0 0 3px 3px;
      opacity: 0.45;
      transition: opacity 0.3s, left 0.3s ease, right 0.3s ease;
    }
    .cv-competency-card:hover::before {
      left: 0.4rem; right: 0.4rem;
      opacity: 0.85;
    }
    /* Subtle colored corner glow on hover */
    .cv-competency-card::after {
      content: '';
      position: absolute;
      top: -30px; right: -20px;
      width: 80px; height: 80px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--cat-color, #00e5cc), transparent 70%);
      opacity: 0;
      transition: opacity 0.35s ease;
      pointer-events: none;
    }
    .cv-competency-card:hover::after { opacity: 0.07; }

    .cv-competency-card-header {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      margin-bottom: 0.7rem;
    }
    .cv-cat-icon {
      width: 34px;
      height: 34px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      line-height: 1;
      background: var(--cat-color-bg, rgba(0,229,204,0.07));
      border: 1px solid var(--cat-color-border, rgba(0,229,204,0.18));
      flex-shrink: 0;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
    }
    .cv-competency-card:hover .cv-cat-icon {
      transform: scale(1.08) rotate(-4deg);
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
    }
    .cv-cat-meta { flex: 1; min-width: 0; }
    .cv-competency-card-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.75);
    }
    .cv-competency-card-context {
      font-size: 0.57rem;
      color: rgba(255,255,255,0.28);
      font-style: italic;
      margin-top: 0.1rem;
    }
    .cv-cat-count {
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: var(--cat-color, #00e5cc);
      padding: 0.16rem 0.5rem;
      border-radius: 20px;
      border: 1px solid var(--cat-color-border, rgba(0,229,204,0.25));
      background: var(--cat-color-bg, rgba(0,229,204,0.06));
      flex-shrink: 0;
      opacity: 0.8;
    }
    .cv-competency-card-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .cv-competency-chip {
      padding: 0.22rem 0.65rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 20px;
      font-size: 0.64rem;
      font-weight: 500;
      color: rgba(255,255,255,0.62);
      cursor: default;
      animation: cvChipIn 0.38s cubic-bezier(0.16,1,0.3,1) both;
      transition:
        background 0.18s ease,
        border-color 0.18s ease,
        color 0.18s ease,
        transform 0.2s cubic-bezier(0.34,1.56,0.64,1),
        box-shadow 0.18s ease;
    }
    @keyframes cvChipIn {
      from { opacity: 0; transform: scale(0.78) translateY(6px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .cv-competency-chip:hover {
      background: rgba(255,255,255,0.09);
      border-color: rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.92);
      transform: scale(1.06) translateY(-1px);
    }
    /* Core chips: branded with category color */
    .cv-competency-chip.core {
      background: color-mix(in srgb, var(--cat-color, #00e5cc) 11%, transparent);
      border: 1px solid color-mix(in srgb, var(--cat-color, #00e5cc) 32%, transparent);
      color: rgba(255,255,255,0.95);
      font-weight: 700;
      box-shadow: 0 0 8px color-mix(in srgb, var(--cat-color, #00e5cc) 18%, transparent);
    }
    .cv-competency-chip.core::before {
      content: '★ ';
      font-size: 0.5rem;
      color: var(--cat-color, #00e5cc);
      vertical-align: middle;
      opacity: 0.8;
    }
    .cv-competency-chip.core:hover {
      background: color-mix(in srgb, var(--cat-color, #00e5cc) 20%, transparent);
      border-color: color-mix(in srgb, var(--cat-color, #00e5cc) 55%, transparent);
      box-shadow: 0 0 16px color-mix(in srgb, var(--cat-color, #00e5cc) 30%, transparent);
      transform: scale(1.08) translateY(-1px);
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
      padding: 1.4rem 1.3rem 1.1rem 1.6rem;
      background: rgba(0,229,204,0.025);
      border: 1px solid rgba(0,229,204,0.08);
      border-left: 3px solid rgba(0,229,204,0.3);
      border-radius: 0 10px 10px 0;
      position: relative;
    }
    .cv-working-with-me::before {
      content: '\u201C';
      position: absolute;
      top: 0.55rem;
      left: 0.45rem;
      font-size: 3.2rem;
      color: rgba(0,229,204,0.12);
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1;
      pointer-events: none;
    }
    .cv-working-with-me::after {
      content: '\u201D';
      position: absolute;
      bottom: 0.1rem;
      right: 0.65rem;
      font-size: 3.2rem;
      color: rgba(0,229,204,0.07);
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1;
      pointer-events: none;
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

    /* Interests grid */
    .cv-interests-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }
    .cv-interest-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.7rem 0.4rem 0.55rem;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      text-align: center;
      transition: border-color 0.25s, background 0.25s, transform 0.25s, box-shadow 0.25s;
      cursor: default;
      position: relative;
      overflow: hidden;
    }
    .cv-interest-card[data-photo-album] { cursor: pointer; }
    .cv-interest-card:hover {
      background: rgba(0,229,204,0.05);
      border-color: rgba(0,229,204,0.22);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0,229,204,0.08);
    }
    .cv-interest-card-icon {
      font-size: 1.3rem;
      line-height: 1;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .cv-interest-card:hover .cv-interest-card-icon {
      transform: scale(1.15);
    }
    .cv-interest-card-label {
      font-size: 0.62rem;
      font-weight: 700;
      color: rgba(255,255,255,0.6);
      letter-spacing: 0.02em;
    }
    .cv-interest-card-sub {
      font-size: 0.52rem;
      color: rgba(255,255,255,0.25);
      line-height: 1.3;
    }
    /* Hover-reveal detail line */
    .cv-interest-detail {
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      font-size: 0.52rem;
      font-style: italic;
      color: rgba(0,229,204,0.55);
      line-height: 1.35;
      transition: max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease;
      margin-top: 0;
    }
    .cv-interest-card:hover .cv-interest-detail {
      max-height: 2.5rem;
      opacity: 1;
      margin-top: 0.2rem;
    }
    /* 3D world link badge — text pill, always readable */
    .cv-interest-world {
      position: absolute;
      top: 5px;
      right: 5px;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(0,229,204,0.07);
      border: 1px solid rgba(0,229,204,0.2);
      font-size: 0.47rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: rgba(0,229,204,0.5);
      white-space: nowrap;
      transition: opacity 0.2s, background 0.25s, border-color 0.25s, color 0.25s, box-shadow 0.25s;
    }
    /* Discovered state — card visited in 3D world */
    .cv-interest-card.cv-discovered {
      border-color: rgba(0,229,204,0.2);
      background: rgba(0,229,204,0.05);
    }
    /* Non-discoverable cards (no 3D counterpart) — always visible, muted border */
    .cv-interest-card[data-discoverable="false"] {
      border: 1px solid rgba(255,255,255,0.08);
    }
    .cv-interest-card.cv-discovered .cv-interest-world {
      background: rgba(0,229,204,0.15);
      border-color: rgba(0,229,204,0.5);
      color: #00e5cc;
      box-shadow: 0 0 8px rgba(0,229,204,0.35);
    }
    @keyframes cvDiscoverPop {
      0%   { transform: scale(0.75) translateY(-2px); opacity: 0; }
      65%  { transform: scale(1.1)  translateY(0);   opacity: 1; }
      100% { transform: scale(1)    translateY(0);   opacity: 1; }
    }
    .cv-interest-card.cv-discovered-new .cv-interest-world {
      animation: cvDiscoverPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    /* ── Film strip photo indicator (bottom of photo cards) ── */
    .cv-card-film-strip {
      align-self: stretch;
      margin-top: auto;
      margin-left: -0.4rem;
      margin-right: -0.4rem;
      margin-bottom: -0.55rem;
      padding: 5px 9px 6px;
      display: flex;
      align-items: center;
      gap: 5px;
      border-top: 1px solid rgba(255,255,255,0.05);
      background: rgba(0,0,0,0.18);
      transition: background 0.3s, border-top-color 0.3s;
    }
    .cfs-icon {
      font-size: 0.7rem;
      line-height: 1;
      flex-shrink: 0;
    }
    .cfs-frames {
      display: flex;
      gap: 2px;
      flex-shrink: 0;
    }
    .cfs-frame {
      width: 9px;
      height: 7px;
      border-radius: 2px;
      border: 1px solid;
      transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
    }
    .cfs-text {
      font-size: 0.46rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      flex: 1;
      text-align: right;
      transition: color 0.3s;
    }

    /* Locked (undiscovered) */
    .cv-interest-card[data-discovery-id]:not(.cv-discovered) .cv-card-film-strip {
      border-top-color: rgba(255,255,255,0.04);
    }
    .cv-interest-card[data-discovery-id]:not(.cv-discovered) .cfs-icon::before { content: "🔒"; }
    .cv-interest-card[data-discovery-id]:not(.cv-discovered) .cfs-frame {
      border-color: rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.02);
    }
    .cv-interest-card[data-discovery-id]:not(.cv-discovered) .cfs-text {
      color: rgba(255,255,255,0.18);
      content: "discover to unlock";
    }
    .cv-interest-card[data-discovery-id]:not(.cv-discovered) .cfs-text::before { content: "discover to unlock"; }

    /* Unlocked (discovered OR no discovery gate, e.g. LEGO) */
    .cv-interest-card.cv-discovered .cv-card-film-strip,
    .cv-interest-card:not([data-discovery-id])[data-photo-album] .cv-card-film-strip {
      border-top-color: rgba(0,229,204,0.15);
      background: rgba(0,229,204,0.05);
    }
    .cv-interest-card.cv-discovered .cfs-icon::before,
    .cv-interest-card:not([data-discovery-id])[data-photo-album] .cfs-icon::before { content: "📷"; }
    .cv-interest-card.cv-discovered .cfs-frame,
    .cv-interest-card:not([data-discovery-id])[data-photo-album] .cfs-frame {
      border-color: rgba(0,229,204,0.5);
      background: rgba(0,229,204,0.1);
      box-shadow: 0 0 4px rgba(0,229,204,0.25);
    }
    .cv-interest-card.cv-discovered .cfs-text,
    .cv-interest-card:not([data-discovery-id])[data-photo-album] .cfs-text,
    .cv-interest-card[data-discoverable="false"][data-photo-album] .cfs-text {
      color: rgba(0,229,204,0.65);
    }
    .cv-interest-card.cv-discovered .cfs-text::before,
    .cv-interest-card:not([data-discovery-id])[data-photo-album] .cfs-text::before,
    .cv-interest-card[data-discoverable="false"][data-photo-album] .cfs-text::before {
      content: attr(data-count) " photos";
    }

    /* Hover shimmer on unlocked strip */
    .cv-interest-card.cv-discovered:hover .cv-card-film-strip,
    .cv-interest-card:not([data-discovery-id])[data-photo-album]:hover .cv-card-film-strip {
      background: rgba(0,229,204,0.1);
      border-top-color: rgba(0,229,204,0.25);
    }
    .cv-interest-card.cv-discovered:hover .cfs-frame,
    .cv-interest-card:not([data-discovery-id])[data-photo-album]:hover .cfs-frame {
      box-shadow: 0 0 6px rgba(0,229,204,0.45);
    }

    .cv-beyond-wink {
      margin-top: 0.8rem;
      padding: 0.5rem 0.7rem;
      background: rgba(0,229,204,0.03);
      border: 1px solid rgba(0,229,204,0.08);
      border-radius: 8px;
      font-size: 0.68rem;
      font-style: italic;
      color: rgba(255,255,255,0.3);
      text-align: center;
    }

    /* ── Footer ── */
    #cv-footer {
      flex-shrink: 0;
      padding: 0.9rem 1.5rem 1.1rem;
      display: flex;
      align-items: stretch;
      background: rgba(0,0,0,0.42);
      border-top: 1px solid rgba(0,229,204,0.1);
    }
    #cv-footer-dl {
      position: relative;
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
      padding: 0.9rem 1.25rem;
      background: linear-gradient(135deg, rgba(0,229,204,0.1) 0%, rgba(0,150,135,0.14) 55%, rgba(0,60,90,0.08) 100%);
      border: 1px solid rgba(0,229,204,0.36);
      border-radius: 14px;
      color: #fff;
      text-decoration: none;
      font-family: 'Inter', system-ui, sans-serif;
      overflow: hidden;
      box-shadow:
        0 4px 28px rgba(0,229,204,0.12),
        inset 0 1px 0 rgba(255,255,255,0.06),
        inset 0 0 0 1px rgba(0,229,204,0.04);
      animation: cvDlBreath 3s ease-in-out infinite;
      transition: transform 0.15s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }
    .cv-dl-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex: 1;
      min-width: 0;
    }
    .cv-dl-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(0,229,204,0.1);
      border: 1px solid rgba(0,229,204,0.25);
      color: #00e5cc;
      flex-shrink: 0;
      animation: cvDlIconBounce 3s ease-in-out infinite;
    }
    .cv-dl-text {
      display: flex;
      flex-direction: column;
      gap: 0.12rem;
    }
    .cv-dl-label {
      font-size: 0.88rem;
      font-weight: 700;
      color: #e8fffe;
      letter-spacing: 0.025em;
      text-shadow: 0 0 16px rgba(0,229,204,0.45);
      position: relative;
      z-index: 1;
    }
    .cv-dl-sub {
      font-size: 0.63rem;
      color: rgba(0,229,204,0.5);
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .cv-dl-right {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-shrink: 0;
    }
    .cv-dl-badge {
      padding: 0.2rem 0.55rem;
      background: rgba(0,229,204,0.07);
      border: 1px solid rgba(0,229,204,0.2);
      border-radius: 6px;
      font-size: 0.58rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: rgba(0,229,204,0.6);
    }
    .cv-dl-arrow {
      color: rgba(0,229,204,0.65);
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
    }
    #cv-footer-dl:hover .cv-dl-arrow { transform: translateX(4px); }
    @keyframes cvDlBreath {
      0%,100% { box-shadow: 0 4px 20px rgba(0,229,204,0.1), inset 0 1px 0 rgba(255,255,255,0.06); }
      50%      { box-shadow: 0 4px 36px rgba(0,229,204,0.28), inset 0 1px 0 rgba(255,255,255,0.08); }
    }
    /* Shimmer sweep */
    #cv-footer-dl::before {
      content: "";
      position: absolute;
      top: 0; bottom: 0;
      left: -100%;
      width: 55%;
      background: linear-gradient(
        105deg,
        transparent 20%,
        rgba(255,255,255,0.09) 50%,
        transparent 80%
      );
      animation: cvDlShimmer 4.5s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes cvDlShimmer {
      0%    { left: -80%; opacity: 0; }
      8%    { opacity: 1; }
      42%   { left: 115%; opacity: 0; }
      100%  { left: 115%; opacity: 0; }
    }
    @keyframes cvDlIconBounce {
      0%,100% { transform: translateY(0); }
      45%     { transform: translateY(3px); }
      62%     { transform: translateY(-1px); }
    }
    #cv-footer-dl:hover {
      transform: translateY(-2px);
      border-color: rgba(0,229,204,0.58);
      box-shadow:
        0 8px 40px rgba(0,229,204,0.22),
        0 0 0 1px rgba(0,229,204,0.12),
        inset 0 1px 0 rgba(255,255,255,0.1);
    }
    #cv-footer-dl:active { transform: translateY(0) scale(0.99); }

    /* ── Inline experience photo ── */
    .cv-exp-photos-grid {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-top: 0.6rem;
    }
    .cv-exp-photos-grid .cv-exp-photo { margin-top: 0; flex: 0 0 auto; }
    .cv-exp-photo {
      margin-top: 0.6rem;
      border-radius: 8px;
      overflow: hidden;
      width: 130px;
      border: 1px solid rgba(255,255,255,0.08);
      transition: border-color 0.2s;
      position: relative;
    }
    .cv-exp-photo:hover { border-color: rgba(0,229,204,0.3); }
    .cv-exp-photo img {
      width: 130px;
      height: 86px;
      object-fit: cover;
      display: block;
      transition: filter 0.5s ease, transform 0.5s ease;
    }
    .cv-exp-photo-caption {
      font-size: 0.58rem;
      color: rgba(255,255,255,0.45);
      padding: 0.25rem 0.4rem;
      font-style: italic;
      background: rgba(0,0,0,0.35);
      line-height: 1.3;
    }

    /* ── Journey photo lock / teaser ── */
    /* Suppress zoom affordance while locked */
    .cv-exp-photo.cv-photo-locked.plb-trigger { cursor: default; }
    .cv-exp-photo.cv-photo-locked .plb-trigger-hint { display: none !important; }
    /* Also suppress zoom on the photo panel in teaser state */
    #cv-photo-panel:not(.cpp-discovered).plb-trigger { cursor: default; }
    #cv-photo-panel:not(.cpp-discovered) .plb-trigger-hint { display: none !important; }

    .cv-exp-photo.cv-photo-locked img {
      filter: blur(7px) brightness(0.32) saturate(0.35);
      transform: scale(1.06);
    }
    .cv-photo-teaser {
      display: none;
      position: absolute;
      inset: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      z-index: 2;
      padding: 0 10px;
      background: repeating-linear-gradient(
        0deg,
        transparent, transparent 3px,
        rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px
      );
    }
    .cv-exp-photo.cv-photo-locked .cv-photo-teaser { display: flex; }
    .cv-photo-teaser-icon {
      font-size: 1rem;
      line-height: 1;
      filter: drop-shadow(0 0 6px rgba(0,229,204,0.7));
      animation: cppIconPulse 2s ease-in-out infinite;
    }
    .cv-photo-teaser-text {
      font-size: 0.44rem;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.6);
      text-align: center;
      line-height: 1.4;
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

// ── Button animations ─────────────────────────────────────────────────────────

const GLITCH_CHARS = '▓▒░█01XABCF><#/';

function bootSequence(btn: HTMLButtonElement): void {
  const label = btn.querySelector<HTMLElement>('.cv-btn-label');
  const sub   = btn.querySelector<HTMLElement>('.cv-btn-sub');
  if (!label) return;

  const target = 'RESUME';
  if (sub) { sub.style.opacity = '0'; sub.style.transition = 'opacity 0.5s ease'; }

  // Start with noise, resolve letter by letter
  let i = 0;
  const tick = setInterval(() => {
    label.textContent = target.slice(0, i)
      + Array.from({ length: target.length - i }, () =>
          GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        ).join('');
    i++;
    if (i > target.length) {
      label.textContent = target;
      clearInterval(tick);
      if (sub) requestAnimationFrame(() => { sub.style.opacity = '1'; });
    }
  }, 65);
}

function addGlitchEffect(btn: HTMLButtonElement): void {
  const label = btn.querySelector<HTMLElement>('.cv-btn-label');
  if (!label) return;
  const labelEl: HTMLElement = label;

  const target = 'RESUME';

  function glitch(): void {
    // Skip if button is hovered or label isn't showing the resolved text
    if (labelEl.textContent !== target) return;
    let frame = 0;
    const total = 14;
    const run = setInterval(() => {
      if (frame >= total) { labelEl.textContent = target; clearInterval(run); return; }
      labelEl.textContent = target
        .split('')
        .map((c, idx) => idx < Math.floor(frame / 2) ? c : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)])
        .join('');
      frame++;
    }, 40);
  }

  const schedule = () => setTimeout(() => { glitch(); schedule(); }, 11000 + Math.random() * 7000);
  schedule();
  btn.addEventListener('mouseenter', glitch);
}

// ── DOM ──────────────────────────────────────────────────────────────────────

function createCVPanel(): void {
  loadFont();
  injectStyles();
  injectHighlightStyles();

  // Button
  const btn = document.createElement("button");
  btn.id = "cv-btn";
  btn.setAttribute("aria-label", "Open Resume — Alexander Lazarovich");
  btn.innerHTML = `
    <span class="cv-btn-inner" aria-hidden="true"></span>
    <span class="cv-btn-tl" aria-hidden="true"></span>
    <span class="cv-btn-br" aria-hidden="true"></span>
    <svg class="cv-btn-icon" width="18" height="15" viewBox="0 0 22 18" fill="none" aria-hidden="true">
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M1 16c0-3.2 2.5-5 6-5s6 1.8 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="15" y1="6"  x2="21" y2="6"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="15" y1="9"  x2="20" y2="9"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="15" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span class="cv-btn-text">
      <span class="cv-btn-label">RESUME</span>
      <span class="cv-btn-sub">// access file</span>
    </span>
  `;
  btn.onclick = openCVPanel;
  document.body.appendChild(btn);
  bootSequence(btn);
  addGlitchEffect(btn);

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
    <span id="cv-panel-title">◈ LIVING DOSSIER</span>
    <button id="cv-close" title="Close  ⎋ ESC">
      <span class="cv-close-x">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </span>
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
  // Sliding underline indicator
  const slider = document.createElement("div");
  slider.id = "cv-tab-slider";
  tabs.appendChild(slider);
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
      <div class="cv-dl-left">
        <div class="cv-dl-icon-box">
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v8M4 7l3 3 3-3M1 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="cv-dl-text">
          <span class="cv-dl-label">Download Full CV</span>
          <span class="cv-dl-sub">Alexander Lazarovich · Full Stack Engineer</span>
        </div>
      </div>
      <div class="cv-dl-right">
        <span class="cv-dl-badge">PDF</span>
        <svg class="cv-dl-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
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

  // Attach lightbox zoom to all experience photos — Journey photos are always visible
  TIMELINE_STOPS.forEach((stop) => {
    const photos = stop.journeyImages ?? (stop.journeyImage ?? stop.image
      ? [{ src: stop.journeyImage ?? stop.image!, caption: stop.journeyCaption ?? stop.imageCaption ?? "" }]
      : []);
    photos.forEach((p, i) => {
      const photoId = photos.length > 1 ? `${stop.id}--${i}` : stop.id;
      const photoEl = panel.querySelector<HTMLDivElement>(`[data-photo-id="${photoId}"]`);
      if (photoEl) {
        attachZoomHint(
          photoEl,
          () => p.src,
          { shape: "rect", caption: p.caption ?? "", hintSize: 16 },
        );
      }
    });
  });

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
            ${SIGNATURE_SKILLS.map((s, i) => `<span class="cv-sig-chip" style="animation-delay:${180 + i * 65}ms">${s}</span>`).join("")}
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
  if (count === 0) return "";

  const isFull = count === total;
  const label = isFull
    ? `Journey complete — all ${total} milestones explored`
    : `${count} of ${total} milestones explored`;

  const pct = Math.round((count / total) * 100);
  const dotsHtml = TIMELINE_STOPS.map((s, i) => {
    const filled = isStopCompleted(s.id);
    const isLast = i === TIMELINE_STOPS.length - 1;
    return `<span class="cv-progress-dot${filled ? " filled" : ""}"></span>`
      + (isLast ? "" : `<span class="cv-progress-bar"><span class="cv-progress-bar-fill" style="width:${filled ? 100 : 0}%"></span></span>`);
  }).join("");

  return `
    <p id="cv-progress-label">3D World Progress</p>
    <div id="cv-progress-dots-row">${dotsHtml}</div>
    <p id="cv-progress-count">✦ <span>${pct}%</span> — ${label}</p>
  `;
}

function buildJourneyTab(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "cv-tab-panel";
  panel.id = "cv-tab-journey";

  // Dot nav with connecting rail
  const dotNav = document.createElement("div");
  dotNav.className = "cv-dot-nav";
  dotNav.id = "cv-journey-dots";
  const rail = document.createElement("div");
  rail.className = "cv-dot-nav-rail";
  dotNav.appendChild(rail);

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

    const pivotHtml = stop.narrativeNote
      ? `<div class="cv-pivot-note">${stop.narrativeNote}</div>`
      : "";

    // Journey photos are always visible — professional content is never gated
    const photos = stop.journeyImages ?? (stop.journeyImage ?? stop.image
      ? [{ src: stop.journeyImage ?? stop.image!, caption: stop.journeyCaption ?? stop.imageCaption ?? "" }]
      : []);
    const photoHtml = photos.length > 0
      ? (photos.length > 1
          ? `<div class="cv-exp-photos-grid">${photos.map((p, i) =>
              `<div class="cv-exp-photo" data-photo-id="${stop.id}--${i}">
                 <img src="${p.src}" alt="${p.caption}" />
                 ${p.caption ? `<div class="cv-exp-photo-caption">${p.caption}</div>` : ""}
               </div>`
            ).join("")}</div>`
          : `<div class="cv-exp-photo" data-photo-id="${stop.id}">
               <img src="${photos[0].src}" alt="${photos[0].caption}" />
               ${photos[0].caption ? `<div class="cv-exp-photo-caption">${photos[0].caption}</div>` : ""}
             </div>`)
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
      </div>
    `;
    expList.appendChild(entry);

    // Dot nav item with year tooltip
    const dot = document.createElement("div");
    dot.className = "cv-dot-nav-item";
    dot.dataset.stopId = stop.id;
    const yearLabel = document.createElement("span");
    yearLabel.className = "cv-dot-year";
    yearLabel.textContent = String(stop.year);
    dot.appendChild(yearLabel);
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

const CATEGORY_META: Record<string, { icon: string; color: string; colorBg: string; colorBorder: string }> = {
  "Frontend":                { icon: "⬡", color: "#00e5cc", colorBg: "rgba(0,229,204,0.07)",  colorBorder: "rgba(0,229,204,0.2)" },
  "Backend":                 { icon: "◈", color: "#4f8fff", colorBg: "rgba(79,143,255,0.07)", colorBorder: "rgba(79,143,255,0.22)" },
  "Data & Storage":          { icon: "◎", color: "#a78bfa", colorBg: "rgba(167,139,250,0.07)",colorBorder: "rgba(167,139,250,0.22)" },
  "DevOps & Infra":          { icon: "⬢", color: "#fbbf24", colorBg: "rgba(251,191,36,0.07)", colorBorder: "rgba(251,191,36,0.22)" },
  "Engineering & Leadership":{ icon: "✦", color: "#4ade80", colorBg: "rgba(74,222,128,0.07)", colorBorder: "rgba(74,222,128,0.22)" },
};

function buildStackTab(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "cv-tab-panel";
  panel.id = "cv-tab-stack";

  // Stats banner
  const totalSkills = SKILL_CATEGORIES.reduce((acc, c) => acc + c.skills.length, 0);
  const coreCount   = SKILL_CATEGORIES.reduce((acc, c) => acc + c.skills.filter((s) => s.core).length, 0);

  const banner = document.createElement("div");
  banner.className = "cv-stack-banner";
  banner.innerHTML = `
    <div class="cv-stack-stat">
      <span class="cv-stack-stat-num">${SKILL_CATEGORIES.length}</span>
      <span class="cv-stack-stat-label">Domains</span>
    </div>
    <div class="cv-stack-divider"></div>
    <div class="cv-stack-stat">
      <span class="cv-stack-stat-num">${totalSkills}</span>
      <span class="cv-stack-stat-label">Technologies</span>
    </div>
    <div class="cv-stack-divider"></div>
    <div class="cv-stack-stat">
      <span class="cv-stack-stat-num">${coreCount}</span>
      <span class="cv-stack-stat-label">Core Skills</span>
    </div>
    <div class="cv-stack-divider"></div>
    <div class="cv-stack-stat">
      <span class="cv-stack-stat-num">6+</span>
      <span class="cv-stack-stat-label">Years Prod.</span>
    </div>
  `;
  panel.appendChild(banner);

  const section = document.createElement("div");
  section.className = "cv-section";
  section.style.borderTop = "none";

  const grid = document.createElement("div");
  grid.className = "cv-competency-grid";

  SKILL_CATEGORIES.forEach((cat, cardIdx) => {
    const meta = CATEGORY_META[cat.label] ?? CATEGORY_META["Frontend"];

    const card = document.createElement("div");
    card.className = "cv-competency-card";
    card.style.cssText = `
      --cat-color: ${meta.color};
      --cat-color-bg: ${meta.colorBg};
      --cat-color-border: ${meta.colorBorder};
      animation-delay: ${cardIdx * 75}ms;
    `;

    card.innerHTML = `
      <div class="cv-competency-card-header">
        <div class="cv-cat-icon">${meta.icon}</div>
        <div class="cv-cat-meta">
          <div class="cv-competency-card-label">${cat.label}</div>
          <div class="cv-competency-card-context">${cat.context}</div>
        </div>
        <span class="cv-cat-count">${cat.skills.length}</span>
      </div>
      <div class="cv-competency-card-chips">
        ${cat.skills.map((s, chipIdx) =>
          `<span class="cv-competency-chip${s.core ? " core" : ""}" style="animation-delay:${cardIdx * 75 + 90 + chipIdx * 32}ms">${s.name}</span>`
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

  // Interests — visual grid, no wall of text
  const interestsSection = document.createElement("div");
  interestsSection.className = "cv-about-section";
  interestsSection.innerHTML = `
    <p class="cv-section-label">Beyond the Code</p>
    <p style="font-size:0.78rem;line-height:1.65;color:rgba(255,255,255,0.48);margin:0 0 0.9rem;">
      When I'm not shipping features — building LEGO cities with the twins,
      hiking with <strong style="color:rgba(255,255,255,0.72)">Meny the Malamute</strong> (named after Manfred from Ice Age — yes, that's him in the 3D world),
      or pushing 80&nbsp;km on a Friday morning ride.
    </p>
    <div class="cv-interests-grid">
      <div class="cv-interest-card" data-discovery-id="bmw" data-photo-album="bmw">
        <span class="cv-interest-world">↗ In 3D world</span>
        <span class="cv-interest-card-icon">🏍️</span>
        <span class="cv-interest-card-label">BMW S1000RR</span>
        <span class="cv-interest-card-sub">199hp weekend therapy</span>
        <span class="cv-interest-detail">Hover over the bike on the spawn pad</span>
        <div class="cv-card-film-strip"><span class="cfs-icon"></span><span class="cfs-frames"><span class="cfs-frame"></span><span class="cfs-frame"></span></span><span class="cfs-text" data-count="2"></span></div>
      </div>
      <div class="cv-interest-card" data-discovery-id="mtb" data-photo-album="mtb">
        <span class="cv-interest-world">↗ In 3D world</span>
        <span class="cv-interest-card-icon">🚴</span>
        <span class="cv-interest-card-label">80km Rides</span>
        <span class="cv-interest-card-sub">Friday mornings</span>
        <span class="cv-interest-detail">MTB parked on the spawn pad</span>
        <div class="cv-card-film-strip"><span class="cfs-icon"></span><span class="cfs-frames"><span class="cfs-frame"></span><span class="cfs-frame"></span><span class="cfs-frame"></span></span><span class="cfs-text" data-count="3"></span></div>
      </div>
      <div class="cv-interest-card" data-discovery-id="gym">
        <span class="cv-interest-world">↗ In 3D world</span>
        <span class="cv-interest-card-icon">💪</span>
        <span class="cv-interest-card-label">Gym</span>
        <span class="cv-interest-card-sub">5 days a week</span>
        <span class="cv-interest-detail">32kg kettlebell on the arena</span>
      </div>
      <div class="cv-interest-card" data-discovery-id="meny" data-photo-album="meny">
        <span class="cv-interest-world">↗ In 3D world</span>
        <span class="cv-interest-card-icon">🐾</span>
        <span class="cv-interest-card-label">Meny</span>
        <span class="cv-interest-card-sub">Short for Manfred 🦣</span>
        <span class="cv-interest-detail">Named after Manny from Ice Age — equally fluffy</span>
        <div class="cv-card-film-strip"><span class="cfs-icon"></span><span class="cfs-frames"><span class="cfs-frame"></span><span class="cfs-frame"></span></span><span class="cfs-text" data-count="2"></span></div>
      </div>
      <div class="cv-interest-card" data-discovery-id="twins" data-photo-album="twins">
        <span class="cv-interest-world">↗ In 3D world</span>
        <span class="cv-interest-card-icon">👨‍👧‍👦</span>
        <span class="cv-interest-card-label">Twins</span>
        <span class="cv-interest-card-sub">Tomer & Alma</span>
        <span class="cv-interest-detail">Their framed masterpiece on the arena</span>
        <div class="cv-card-film-strip"><span class="cfs-icon"></span><span class="cfs-frames"><span class="cfs-frame"></span><span class="cfs-frame"></span></span><span class="cfs-text" data-count="2"></span></div>
      </div>
      <div class="cv-interest-card" data-discovery-id="monogram">
        <span class="cv-interest-world">↗ In 3D world</span>
        <span class="cv-interest-card-icon">🎮</span>
        <span class="cv-interest-card-label">Game Dev</span>
        <span class="cv-interest-card-sub">Side passion</span>
        <span class="cv-interest-detail">Find the AL monogram on the arena</span>
      </div>
      <div class="cv-interest-card" data-discovery-id="lego" data-photo-album="lego">
        <span class="cv-interest-world">↗ In 3D world</span>
        <span class="cv-interest-card-icon">🧱</span>
        <span class="cv-interest-card-label">LEGO</span>
        <span class="cv-interest-card-sub">Cities with the twins</span>
        <span class="cv-interest-detail">Brick stack on the arena</span>
        <div class="cv-card-film-strip"><span class="cfs-icon"></span><span class="cfs-frames"><span class="cfs-frame"></span><span class="cfs-frame"></span><span class="cfs-frame"></span></span><span class="cfs-text" data-count="3"></span></div>
      </div>
      <div class="cv-interest-card" data-discoverable="false">
        <span class="cv-interest-card-icon">🎸</span>
        <span class="cv-interest-card-label">Classic Rock</span>
        <span class="cv-interest-card-sub">Always playing</span>
        <span class="cv-interest-detail">Best debugging soundtrack</span>
      </div>
      <div class="cv-interest-card" data-discoverable="false">
        <span class="cv-interest-card-icon">✈️</span>
        <span class="cv-interest-card-label">Travel</span>
        <span class="cv-interest-card-sub">Thailand, northern Israel</span>
        <span class="cv-interest-detail">Every trip is a research project</span>
      </div>
    </div>
    <div class="cv-beyond-wink">And yes — this entire portfolio is a playable video game. I couldn't resist.</div>
  `;
  panel.appendChild(interestsSection);

  return panel;
}

// ── Tab switching ────────────────────────────────────────────────────────────

function updateTabSlider(tabId: string): void {
  const btn = document.querySelector<HTMLElement>(`.cv-tab-btn[data-tab="${tabId}"]`);
  const slider = document.getElementById("cv-tab-slider");
  if (!btn || !slider) return;
  slider.style.left = `${btn.offsetLeft}px`;
  slider.style.width = `${btn.offsetWidth}px`;
}

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
  updateTabSlider(tabId);
  // Clear "new" indicator when user reaches the About tab
  if (tabId === "about")   clearAboutTabNew();
  if (tabId === "journey") clearJourneyTabNew();
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

  // Update experience entries — add Explored badge + shimmer for completed stops
  document.querySelectorAll<HTMLElement>(".cv-exp-entry[data-stop-id]").forEach((entry) => {
    const id = entry.dataset.stopId!;
    const completed = isStopCompleted(id);
    const metaEl = entry.querySelector<HTMLElement>(".cv-exp-meta");
    const lineEl = entry.querySelector<HTMLElement>(".cv-exp-line");

    if (completed && metaEl && lineEl) {
      // Add explored badge if not already present
      if (!metaEl.querySelector(".cv-explored-badge")) {
        const badge = document.createElement("span");
        badge.className = "cv-explored-badge";
        badge.textContent = "✦ Explored";
        metaEl.appendChild(badge);
      }
      // Upgrade timeline line to glowing cyan
      lineEl.classList.add("active");

      // Shimmer on newly-seen completions
      if (!seenUnlocks.has(id)) {
        seenUnlocks.add(id);
        entry.classList.add("cv-shimmer");
        setTimeout(() => entry.classList.remove("cv-shimmer"), 1500);
      }
    }
    // Journey photos are always visible — no gate-based unlock
  });

  // Update dot-nav completion state
  document.querySelectorAll<HTMLElement>(".cv-dot-nav-item[data-stop-id]").forEach((dot) => {
    const id = dot.dataset.stopId!;
    dot.classList.toggle("completed", isStopCompleted(id));
  });

  // Update interest cards with 3D discovery state
  document.querySelectorAll<HTMLElement>(".cv-interest-card[data-discovery-id]").forEach((card) => {
    const id = card.dataset.discoveryId!;
    const wasDiscovered = card.classList.contains("cv-discovered");
    const nowDiscovered = isDiscovered(id);
    const badge = card.querySelector<HTMLElement>(".cv-interest-world");
    if (nowDiscovered) {
      if (!wasDiscovered) {
        card.classList.add("cv-discovered", "cv-discovered-new");
        setTimeout(() => card.classList.remove("cv-discovered-new"), 500);
      } else {
        card.classList.add("cv-discovered");
      }
      if (badge) badge.textContent = "✓ Found it";
    } else {
      if (badge) badge.textContent = "↗ In 3D world";
    }
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
    // Position tab slider after panel is visible and laid out
    requestAnimationFrame(() => {
      const activeBtn = document.querySelector<HTMLElement>(".cv-tab-btn.active");
      updateTabSlider(activeBtn?.dataset.tab ?? "overview");
    });
    // Attach photo panel hovers + restore pending About tab indicator
    setTimeout(() => {
      initPhotoPanelHovers();
      applyAboutTabNewToDom();
      applyJourneyTabNewToDom();
    }, 60);
  }));
}

function closeCVPanel(): void {
  if (!panelEl) return;
  isOpen = false;
  panelEl.classList.remove("cv-visible");
  hidePhotoPanel();
  setTimeout(() => { if (!isOpen) panelEl!.style.display = "none"; }, 360);
}

// ── Discovery Photo Panel ─────────────────────────────────────────────────────

let photoPanelEl: HTMLDivElement | null = null;
let photoGalleryImg: HTMLImageElement | null = null;
let photoTeaserImg: HTMLImageElement | null = null;
let photoCaptionEl: HTMLDivElement | null = null;
let photoDotsEl: HTMLDivElement | null = null;
let photoPrevBtn: HTMLButtonElement | null = null;
let photoNextBtn: HTMLButtonElement | null = null;

let currentPhotoAlbum: PhotoEntry[] = [];
let currentPhotoIdx = 0;
let currentPhotoCaption = "";
let photoHideTimer: ReturnType<typeof setTimeout> | null = null;
/** Card that opened the panel (for touch: tap-same-card to close, tap-outside to close). */
let currentPhotoPanelCard: HTMLElement | null = null;

function injectPhotoPanelStyles(): void {
  if (document.getElementById("cv-photo-panel-styles")) return;
  const s = document.createElement("style");
  s.id = "cv-photo-panel-styles";
  s.textContent = `
    /* Base font — must be explicit because panel is outside #cv-overlay */
    #cv-photo-panel,
    #cv-photo-panel * {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
    }

    #cv-photo-panel {
      position: fixed;
      z-index: 3500;
      width: 248px;
      border-radius: 12px;
      background: rgba(8, 12, 18, 0.97);
      border: 1px solid rgba(0,229,204,0.15);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 20px 56px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,229,204,0.05);
      overflow: hidden;
      opacity: 0;
      transform: scale(0.94) translateY(8px);
      transition: opacity 0.18s ease, transform 0.24s cubic-bezier(0.34,1.56,0.64,1);
      pointer-events: none;
    }
    #cv-photo-panel.cpp-visible {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    /* ── Image area ── */
    .cpp-img-area {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
      background: #080c12;
    }
    .cpp-gallery-img,
    .cpp-teaser-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cpp-gallery-img-wrap {
      position: relative;
      flex: 1;
      min-height: 0;
      cursor: zoom-in;
    }
    .cpp-gallery-img { transition: opacity 0.28s ease; }

    /* ── Teaser ── */
    .cpp-teaser-img {
      filter: blur(7px) brightness(0.45) saturate(0.5);
      transform: scale(1.06);
    }
    .cpp-teaser-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 16px;
      /* subtle CRT scanlines */
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0,0,0,0.14) 3px,
        rgba(0,0,0,0.14) 4px
      );
    }
    .cpp-teaser-icon {
      font-size: 1.5rem;
      line-height: 1;
      color: rgba(0,229,204,0.85);
      text-shadow: 0 0 16px rgba(0,229,204,0.9), 0 0 32px rgba(0,229,204,0.4);
      animation: cppIconPulse 2s ease-in-out infinite;
      user-select: none;
    }
    @keyframes cppIconPulse {
      0%, 100% { opacity: 0.65; transform: scale(1); }
      50%       { opacity: 1;   transform: scale(1.08); }
    }
    .cpp-teaser-badge {
      font-size: 0.5rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.6);
      border: 1px solid rgba(0,229,204,0.2);
      padding: 2px 9px;
      border-radius: 20px;
      background: rgba(0,229,204,0.06);
    }
    .cpp-teaser-hint {
      font-size: 0.55rem;
      font-weight: 400;
      color: rgba(255,255,255,0.32);
      text-align: center;
      line-height: 1.5;
      font-style: italic;
    }
    /* Shimmer sweep */
    .cpp-teaser-shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        110deg,
        transparent 25%,
        rgba(0,229,204,0.06) 50%,
        transparent 75%
      );
      background-size: 250% 100%;
      animation: cppSweep 3.2s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes cppSweep {
      0%   { background-position: 250% 0; }
      100% { background-position: -250% 0; }
    }

    /* ── Gallery nav ── */
    /* Dark scrim so nav buttons are always readable against any photo */
    .cpp-img-area::after {
      content: "";
      position: absolute;
      left: 0; right: 0; bottom: 0;
      height: 56px;
      background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%);
      pointer-events: none;
      z-index: 1;
    }
    .cpp-gallery-nav {
      position: absolute;
      bottom: 10px;
      left: 0; right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      z-index: 2;
    }
    .cpp-nav-btn {
      background: rgba(0,0,0,0.72);
      border: 1px solid rgba(255,255,255,0.28);
      color: rgba(255,255,255,0.9);
      font-size: 1rem;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      padding: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    }
    .cpp-nav-btn:hover {
      background: rgba(0,229,204,0.22);
      border-color: rgba(0,229,204,0.65);
      color: #00e5cc;
      box-shadow: 0 0 10px rgba(0,229,204,0.35);
    }
    .cpp-nav-btn:disabled { opacity: 0.18; cursor: default; box-shadow: none; }
    .cpp-dots { display: flex; gap: 6px; align-items: center; }
    .cpp-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      transition: background 0.2s, transform 0.2s;
    }
    .cpp-dot.active {
      background: #00e5cc;
      transform: scale(1.35);
      box-shadow: 0 0 6px rgba(0,229,204,0.8);
    }

    /* ── Caption ── */
    .cpp-caption {
      padding: 9px 14px 11px;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .cpp-caption-label {
      font-size: 0.44rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.45);
      margin-bottom: 2px;
    }
    .cpp-caption-text {
      font-size: 0.6rem;
      font-weight: 400;
      font-style: italic;
      color: rgba(255,255,255,0.45);
      line-height: 1.45;
    }

    /* ── States ── */
    #cv-photo-panel.cpp-discovered .cpp-teaser-wrap { display: none; }
    #cv-photo-panel.cpp-discovered .cpp-gallery-wrap { display: flex; }
    #cv-photo-panel:not(.cpp-discovered) .cpp-teaser-wrap { display: block; }
    #cv-photo-panel:not(.cpp-discovered) .cpp-gallery-wrap { display: none; }
    #cv-photo-panel:not(.cpp-discovered) .cpp-caption { display: none; }
  `;
  document.head.appendChild(s);
}

function createPhotoPanel(): HTMLDivElement {
  if (photoPanelEl) return photoPanelEl;
  injectPhotoPanelStyles();

  photoPanelEl = document.createElement("div");
  photoPanelEl.id = "cv-photo-panel";

  const imgArea = document.createElement("div");
  imgArea.className = "cpp-img-area";

  // Teaser wrap
  const teaserWrap = document.createElement("div");
  teaserWrap.className = "cpp-teaser-wrap";

  photoTeaserImg = document.createElement("img");
  photoTeaserImg.className = "cpp-teaser-img";
  photoTeaserImg.alt = "";

  const teaserOverlay = document.createElement("div");
  teaserOverlay.className = "cpp-teaser-overlay";
  teaserOverlay.innerHTML = `
    <div class="cpp-teaser-icon">⬡</div>
    <div class="cpp-teaser-badge">Hidden</div>
    <div class="cpp-teaser-hint">Find this object in the 3D world<br>then click it to reveal</div>
  `;
  const shimmer = document.createElement("div");
  shimmer.className = "cpp-teaser-shimmer";

  teaserWrap.appendChild(photoTeaserImg);
  teaserWrap.appendChild(teaserOverlay);
  teaserWrap.appendChild(shimmer);

  // Gallery wrap
  const galleryWrap = document.createElement("div");
  galleryWrap.className = "cpp-gallery-wrap";
  galleryWrap.style.cssText = "flex-direction:column;width:100%;";

  const galleryImgWrap = document.createElement("div");
  galleryImgWrap.className = "cpp-gallery-img-wrap";

  photoGalleryImg = document.createElement("img");
  photoGalleryImg.className = "cpp-gallery-img";
  photoGalleryImg.style.cssText = "position:relative;";
  photoGalleryImg.alt = "";

  galleryImgWrap.appendChild(photoGalleryImg);

  const nav = document.createElement("div");
  nav.className = "cpp-gallery-nav";

  photoPrevBtn = document.createElement("button");
  photoPrevBtn.className = "cpp-nav-btn";
  photoPrevBtn.textContent = "‹";
  photoPrevBtn.addEventListener("click", (e) => { e.stopPropagation(); navigatePhoto(-1); });

  photoDotsEl = document.createElement("div");
  photoDotsEl.className = "cpp-dots";

  photoNextBtn = document.createElement("button");
  photoNextBtn.className = "cpp-nav-btn";
  photoNextBtn.textContent = "›";
  photoNextBtn.addEventListener("click", (e) => { e.stopPropagation(); navigatePhoto(1); });

  nav.appendChild(photoPrevBtn);
  nav.appendChild(photoDotsEl);
  nav.appendChild(photoNextBtn);
  galleryWrap.appendChild(galleryImgWrap);
  galleryWrap.appendChild(nav);

  imgArea.appendChild(teaserWrap);
  imgArea.appendChild(galleryWrap);

  photoCaptionEl = document.createElement("div");
  photoCaptionEl.className = "cpp-caption";

  photoPanelEl.appendChild(imgArea);
  photoPanelEl.appendChild(photoCaptionEl);

  // Hover bridge — keep panel visible while mouse is over it
  photoPanelEl.addEventListener("mouseenter", cancelPhotoPanelHide);
  photoPanelEl.addEventListener("mouseleave", schedulePhotoPanelHide);

  // Zoom-in on gallery image — attached to image wrapper, not the nav area
  attachZoomHint(
    galleryImgWrap,
    () => {
      if (!photoPanelEl?.classList.contains("cpp-discovered")) return "";
      return photoGalleryImg?.src ?? "";
    },
    { shape: "rect", hintSize: 18 },
  );
  galleryImgWrap.addEventListener("click", () => {
    const lb = document.getElementById("plb-caption");
    if (lb) lb.textContent = currentPhotoCaption;
  });

  document.body.appendChild(photoPanelEl);
  return photoPanelEl;
}

function navigatePhoto(dir: number): void {
  if (!currentPhotoAlbum.length) return;
  currentPhotoIdx = (currentPhotoIdx + dir + currentPhotoAlbum.length) % currentPhotoAlbum.length;
  setGalleryPhoto(currentPhotoIdx);
}

function setGalleryPhoto(idx: number): void {
  const photo = currentPhotoAlbum[idx];
  if (!photo || !photoGalleryImg || !photoCaptionEl || !photoDotsEl) return;

  photoGalleryImg.style.opacity = "0";
  setTimeout(() => {
    photoGalleryImg!.src = photo.src;
    photoGalleryImg!.style.objectPosition = photo.objectPosition ?? "center center";
    photoGalleryImg!.style.opacity = "1";
  }, 120);
  currentPhotoCaption = photo.caption;
  photoCaptionEl.innerHTML = `<div class="cpp-caption-label">Photo</div><div class="cpp-caption-text">${photo.caption}</div>`;

  // Update dots
  photoDotsEl.innerHTML = "";
  currentPhotoAlbum.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = `cpp-dot${i === idx ? " active" : ""}`;
    photoDotsEl!.appendChild(dot);
  });

  if (photoPrevBtn) photoPrevBtn.disabled = currentPhotoAlbum.length <= 1;
  if (photoNextBtn) photoNextBtn.disabled = currentPhotoAlbum.length <= 1;
}

function showPhotoPanel(card: HTMLElement): void {
  const panel = createPhotoPanel();
  const albumKey = card.dataset.photoAlbum ?? card.dataset.discoveryId ?? "";
  const photos = CARD_PHOTOS[albumKey];
  if (!photos?.length) return;

  const discoveryId = card.dataset.discoveryId;
  const isNonDiscoverable = card.dataset.discoverable === "false";
  const discovered = isNonDiscoverable || !discoveryId ? true : isDiscovered(discoveryId);

  // Set teaser image (blurred background) — always load it
  if (photoTeaserImg) {
    photoTeaserImg.src = photos[0].src;
    photoTeaserImg.style.objectPosition = photos[0].objectPosition ?? "center center";
  }

  // Toggle discovered/teaser state
  panel.classList.toggle("cpp-discovered", discovered);

  if (discovered) {
    currentPhotoAlbum = photos;
    currentPhotoIdx = 0;
    setGalleryPhoto(0);
  }

  // Position: right of card, clamped to viewport
  positionPhotoPanel(card);
  panel.classList.add("cpp-visible");
}

function positionPhotoPanel(card: HTMLElement): void {
  if (!photoPanelEl) return;
  const rect = card.getBoundingClientRect();
  const panelW = 240;
  const panelH = 240; // approximate

  let left = rect.right + 12;
  if (left + panelW > window.innerWidth - 8) {
    left = rect.left - panelW - 12;
  }
  // Clamp left
  left = Math.max(8, left);

  let top = rect.top;
  if (top + panelH > window.innerHeight - 8) {
    top = window.innerHeight - panelH - 8;
  }
  top = Math.max(8, top);

  photoPanelEl.style.left = `${left}px`;
  photoPanelEl.style.top = `${top}px`;
}

function hidePhotoPanel(): void {
  photoPanelEl?.classList.remove("cpp-visible");
  currentPhotoPanelCard = null;
  clearPhotoPanelTouchClose();
}

function schedulePhotoPanelHide(): void {
  photoHideTimer = setTimeout(hidePhotoPanel, 160);
}

function cancelPhotoPanelHide(): void {
  if (photoHideTimer !== null) {
    clearTimeout(photoHideTimer);
    photoHideTimer = null;
  }
}

/** True when the primary input cannot hover (touch, coarse pointer). */
function prefersNoHover(): boolean {
  return window.matchMedia("(hover: none)").matches;
}

let photoPanelTouchCloseHandler: ((e: MouseEvent) => void) | null = null;

function setupPhotoPanelTouchClose(card: HTMLElement): void {
  const remove = () => {
    if (photoPanelTouchCloseHandler) {
      document.removeEventListener("click", photoPanelTouchCloseHandler, true);
      photoPanelTouchCloseHandler = null;
    }
  };
  photoPanelTouchCloseHandler = (e: MouseEvent) => {
    const target = e.target as Node;
    const panel = document.getElementById("cv-photo-panel");
    if (
      target &&
      panel &&
      !card.contains(target) &&
      !panel.contains(target)
    ) {
      hidePhotoPanel();
      remove();
    }
  };
  // Use capture so we run before other handlers; delay so the opening click doesn't immediately close
  requestAnimationFrame(() => {
    document.addEventListener("click", photoPanelTouchCloseHandler!, true);
  });
}

function clearPhotoPanelTouchClose(): void {
  if (photoPanelTouchCloseHandler) {
    document.removeEventListener("click", photoPanelTouchCloseHandler, true);
    photoPanelTouchCloseHandler = null;
  }
}

/** Attach hover (desktop) or click (touch) listeners to cards with photo albums. */
function initPhotoPanelHovers(): void {
  const cards = document.querySelectorAll<HTMLElement>(
    ".cv-interest-card[data-photo-album], .cv-interest-card[data-discovery-id]"
  );
  const useTouch = prefersNoHover();

  cards.forEach((card) => {
    const key = card.dataset.photoAlbum ?? card.dataset.discoveryId ?? "";
    if (!CARD_PHOTOS[key]) return;
    if (card.dataset.photoPanelBound === "1") return;
    card.dataset.photoPanelBound = "1";

    if (useTouch) {
      // Mobile/touch: tap to open, tap same card or outside to close
      card.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearPhotoPanelTouchClose();
        const isOpen = photoPanelEl?.classList.contains("cpp-visible");
        const sameCard = currentPhotoPanelCard === card;
        if (isOpen && sameCard) {
          hidePhotoPanel();
          return;
        }
        createPhotoPanel();
        currentPhotoPanelCard = card;
        showPhotoPanel(card);
        setupPhotoPanelTouchClose(card);
      });
    } else {
      // Desktop: hover to show, leave to hide
      card.addEventListener("mouseenter", () => {
        cancelPhotoPanelHide();
        showPhotoPanel(card);
      });
      card.addEventListener("mouseleave", schedulePhotoPanelHide);
    }
  });
}

export function initCVPanel(): void {
  createCVPanel();
}
