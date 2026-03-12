import { TIMELINE_STOPS } from "../scene/timeline/timelineConfig";
import { isStopCompleted } from "../scene/timeline/createTimelineStops";
import { initPhotoLightbox, attachZoomHint, openLightboxAlbum, LightboxPhoto } from "./photoLightbox";
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
    { src: "/img/discoveries/mtb-bike.png",   caption: "Full-carbon · weighs less than my node_modules folder",              objectPosition: "center 60%" },
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
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 1.2rem;
    }
    .cv-action-link {
      display: inline-flex;
      align-items: center;
      gap: 0.42rem;
      padding: 0.44rem 1rem;
      border-radius: 8px;
      font-size: 0.73rem;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s, transform 0.15s;
      border: 1px solid;
      white-space: nowrap;
      letter-spacing: 0.01em;
    }
    .cv-action-link.linkedin {
      color: rgba(100,180,255,0.85);
      border-color: rgba(100,180,255,0.22);
      background: rgba(100,180,255,0.07);
    }
    .cv-action-link.linkedin:hover {
      color: #7fcfff;
      border-color: rgba(100,180,255,0.5);
      background: rgba(100,180,255,0.14);
      box-shadow: 0 0 12px rgba(100,180,255,0.15);
      transform: translateY(-1px);
    }
    .cv-action-link.email {
      color: rgba(255,255,255,0.6);
      border-color: rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.04);
    }
    .cv-action-link.email:hover {
      color: #fff;
      border-color: rgba(255,255,255,0.38);
      background: rgba(255,255,255,0.09);
      transform: translateY(-1px);
    }
    .cv-action-link.phone {
      color: rgba(90,230,175,0.8);
      border-color: rgba(90,230,175,0.2);
      background: rgba(90,230,175,0.05);
    }
    .cv-action-link.phone:hover {
      color: rgba(90,230,175,1);
      border-color: rgba(90,230,175,0.45);
      background: rgba(90,230,175,0.11);
      box-shadow: 0 0 12px rgba(90,230,175,0.12);
      transform: translateY(-1px);
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

    /* ── Journey: Horizontal timeline navigation bar ── */
    .cv-journey-tlbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: linear-gradient(to bottom, rgba(13,17,23,0.97) 70%, transparent);
      padding: 0.85rem 2rem 0.75rem;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .cv-jtl-track {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 0;
    }
    .cv-jtl-line {
      position: absolute;
      top: 9px;
      left: 8%;
      right: 8%;
      height: 1.5px;
      background: linear-gradient(to right,
        rgba(59,130,246,0.55) 0%,
        rgba(251,146,60,0.55) 33%,
        rgba(167,139,250,0.55) 66%,
        rgba(16,185,129,0.55) 100%);
      z-index: 0;
      border-radius: 2px;
    }
    .cv-jtl-stop {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.32rem;
      cursor: pointer;
      position: relative;
      z-index: 2;
      padding: 0 0.2rem;
      transition: opacity 0.2s;
    }
    .cv-jtl-stop:hover { opacity: 0.8; }
    .cv-jtl-node-wrap {
      position: relative;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cv-jtl-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1.5px solid var(--stop-color, #00e5cc);
      opacity: 0;
      transform: scale(0.6);
      transition: opacity 0.4s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
    }
    .cv-jtl-node {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.2);
      background: #0d1117;
      position: relative;
      z-index: 1;
      transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
    }
    .cv-jtl-stop.completed .cv-jtl-node {
      background: color-mix(in srgb, var(--stop-color, #00e5cc) 30%, #0d1117);
      border-color: color-mix(in srgb, var(--stop-color, #00e5cc) 60%, transparent);
    }
    .cv-jtl-stop.active .cv-jtl-node {
      width: 12px;
      height: 12px;
      background: var(--stop-color, #00e5cc);
      border-color: var(--stop-color, #00e5cc);
      box-shadow: 0 0 16px var(--stop-color, #00e5cc);
    }
    .cv-jtl-stop.active .cv-jtl-ring {
      opacity: 0.35;
      transform: scale(1);
      animation: cvJtlPulse 2.2s ease-in-out infinite;
    }
    @keyframes cvJtlPulse {
      0%, 100% { transform: scale(1);   opacity: 0.28; }
      50%       { transform: scale(1.7); opacity: 0.08; }
    }
    .cv-jtl-year {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: rgba(255,255,255,0.3);
      transition: color 0.25s;
      line-height: 1;
    }
    .cv-jtl-stop.active .cv-jtl-year    { color: var(--stop-color, #00e5cc); }
    .cv-jtl-stop.completed .cv-jtl-year { color: rgba(255,255,255,0.58); }
    .cv-jtl-company {
      font-size: 0.47rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgba(255,255,255,0.16);
      transition: color 0.25s;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
    }
    .cv-jtl-stop.active .cv-jtl-company    { color: rgba(255,255,255,0.58); }
    .cv-jtl-stop.completed .cv-jtl-company { color: rgba(255,255,255,0.35); }

    /* ── Journey: Entry cards ── */
    .cv-exp-list {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      padding: 0.3rem 1.5rem 2rem;
    }
    .cv-exp-entry {
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.015);
      overflow: hidden;
      position: relative;
      animation: cvEntrySlideIn 0.52s cubic-bezier(0.16,1,0.3,1) both;
      transition:
        border-color 0.3s ease,
        box-shadow 0.3s ease,
        transform 0.3s cubic-bezier(0.34,1.56,0.64,1),
        background 0.3s ease;
    }
    @keyframes cvEntrySlideIn {
      from { opacity: 0; transform: translateY(30px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
    .cv-exp-entry:hover {
      border-color: rgba(255,255,255,0.13);
      box-shadow: 0 16px 48px rgba(0,0,0,0.48);
      transform: translateY(-3px);
    }
    /* Colored top accent line */
    .cv-exp-entry::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: var(--entry-color, rgba(0,229,204,0.5));
      opacity: 0.55;
      transition: opacity 0.3s, left 0.3s, right 0.3s;
    }
    .cv-exp-entry:hover::before { opacity: 1; }
    /* Explored state — subtle color wash */
    .cv-exp-entry.cv-entry-explored {
      border-color: color-mix(in srgb, var(--entry-color, #00e5cc) 22%, rgba(255,255,255,0.07));
      background: color-mix(in srgb, var(--entry-color, #00e5cc) 2.5%, rgba(255,255,255,0.015));
    }
    .cv-exp-entry.cv-entry-explored::before { opacity: 1; }

    /* ── Card header ── */
    .cv-entry-head {
      padding: 1.05rem 1.2rem 0.85rem;
      display: flex;
      align-items: flex-start;
      gap: 0.9rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .cv-entry-year-badge {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 46px;
      min-height: 46px;
      border-radius: 11px;
      background: color-mix(in srgb, var(--entry-color, #00e5cc) 9%, transparent);
      border: 1px solid color-mix(in srgb, var(--entry-color, #00e5cc) 22%, transparent);
      font-size: 0.74rem;
      font-weight: 800;
      color: var(--entry-color, #00e5cc);
      text-align: center;
      line-height: 1.1;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s;
    }
    .cv-exp-entry:hover .cv-entry-year-badge {
      transform: scale(1.06);
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
    }
    .cv-entry-head-main { flex: 1; min-width: 0; }
    .cv-entry-company {
      font-size: 1.1rem;
      font-weight: 800;
      color: #fff;
      line-height: 1.15;
      margin: 0 0 0.15rem;
      letter-spacing: -0.028em;
    }
    .cv-entry-role {
      font-size: 0.7rem;
      font-weight: 500;
      color: rgba(255,255,255,0.46);
      margin: 0 0 0.42rem;
      line-height: 1.4;
    }
    .cv-exp-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.38rem;
    }
    .cv-entry-period-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 0.2rem 0.62rem;
      border-radius: 12px;
      background: color-mix(in srgb, var(--entry-color, #00e5cc) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--entry-color, #00e5cc) 22%, transparent);
      color: color-mix(in srgb, var(--entry-color, #00e5cc) 85%, #fff);
    }
    .cv-entry-period-chip-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--entry-color, #00e5cc);
      flex-shrink: 0;
      animation: cvAvailPulse 2.5s ease-in-out infinite;
    }
    .cv-entry-location {
      font-size: 0.57rem;
      color: rgba(255,255,255,0.28);
      font-weight: 500;
    }
    .cv-entry-logo-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 8px;
      padding: 4px 10px;
      height: 36px;
      align-self: flex-start;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s;
    }
    .cv-exp-entry:hover .cv-entry-logo-wrap {
      transform: scale(1.05);
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
    }
    .cv-entry-logo {
      height: 20px;
      width: auto;
      max-width: 84px;
      object-fit: contain;
    }

    /* ── Company context blurb ── */
    .cv-entry-context {
      padding: 0.72rem 1.2rem;
      font-size: 0.73rem;
      line-height: 1.66;
      color: rgba(255,255,255,0.37);
      font-style: italic;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      background: rgba(255,255,255,0.012);
      position: relative;
      overflow: hidden;
    }
    .cv-entry-context::before {
      content: '"';
      position: absolute;
      top: 0.1rem; left: 0.5rem;
      font-size: 2.4rem;
      color: rgba(255,255,255,0.04);
      font-family: Georgia, serif;
      line-height: 1;
      pointer-events: none;
    }

    /* ── Bullets & skills ── */
    .cv-entry-body { padding: 0.9rem 1.2rem; }
    .cv-exp-bullets {
      list-style: none; padding: 0; margin: 0 0 0.88rem;
      display: flex; flex-direction: column; gap: 0.3rem;
    }
    .cv-exp-bullets li {
      font-size: 0.76rem;
      color: rgba(255,255,255,0.62);
      padding-left: 1.1rem;
      position: relative;
      line-height: 1.62;
      animation: cvBulletIn 0.42s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes cvBulletIn {
      from { opacity: 0; transform: translateX(-10px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .cv-exp-bullets li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.62em;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--entry-color, #00e5cc);
      opacity: 0.65;
    }
    .cv-exp-skills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .cv-exp-skill {
      padding: 0.18rem 0.55rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px;
      font-size: 0.62rem;
      color: rgba(255,255,255,0.5);
      cursor: default;
      transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.18s;
    }
    .cv-exp-skill:hover {
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.88);
      transform: scale(1.04);
    }

    /* ── Photo section ── */
    .cv-entry-photos {
      padding: 0 1.2rem 1.05rem;
    }
    .cv-exp-photos-grid {
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
      padding-top: 0.6rem;
    }
    .cv-exp-photos-grid .cv-exp-photo { margin-top: 0; flex: 0 0 auto; }
    .cv-exp-photo {
      flex: 0 0 auto;
      margin-top: 0;
      border-radius: 10px;
      overflow: hidden;
      width: 140px;
      border: 1px solid rgba(255,255,255,0.08);
      transition:
        border-color 0.22s,
        transform 0.3s cubic-bezier(0.34,1.56,0.64,1),
        box-shadow 0.3s;
      position: relative;
    }
    .cv-exp-photo:hover {
      border-color: color-mix(in srgb, var(--entry-color, rgba(0,229,204,1)) 45%, transparent);
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 10px 28px rgba(0,0,0,0.55);
    }
    .cv-exp-photo img {
      width: 140px;
      height: 93px;
      object-fit: cover;
      display: block;
      transition: filter 0.4s ease, transform 0.4s ease;
    }
    .cv-exp-photo:hover img { filter: brightness(1.08); transform: scale(1.03); }
    .cv-exp-photo-caption {
      font-size: 0.57rem;
      color: rgba(255,255,255,0.42);
      padding: 0.28rem 0.45rem;
      font-style: italic;
      background: rgba(0,0,0,0.45);
      line-height: 1.3;
    }

    /* ── Narrative note (pivot quote) ── */
    .cv-pivot-note {
      margin: 0.1rem 1.2rem 1.1rem;
      padding: 0.88rem 1rem 0.88rem 1.35rem;
      border-left: 2.5px solid color-mix(in srgb, var(--entry-color, #fbbf24) 55%, transparent);
      background: color-mix(in srgb, var(--entry-color, #fbbf24) 3%, transparent);
      border-radius: 0 10px 10px 0;
      font-size: 0.74rem;
      font-style: italic;
      color: rgba(255,255,255,0.48);
      line-height: 1.68;
      position: relative;
      overflow: hidden;
    }
    .cv-pivot-note::before {
      content: '"';
      position: absolute;
      top: 0.15rem; left: 0.2rem;
      font-size: 3rem;
      color: color-mix(in srgb, var(--entry-color, #fbbf24) 14%, transparent);
      font-family: Georgia, serif;
      line-height: 1;
      pointer-events: none;
    }
    .cv-pivot-note span {
      color: color-mix(in srgb, var(--entry-color, #fbbf24) 82%, #fff);
      font-weight: 600;
      font-style: normal;
    }

    /* ── Explored badge ── */
    .cv-explored-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.22rem;
      padding: 0.13rem 0.52rem;
      background: rgba(0,229,204,0.08);
      border: 1px solid rgba(0,229,204,0.28);
      border-radius: 10px;
      font-size: 0.56rem;
      font-weight: 700;
      color: rgba(0,229,204,0.82);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      animation: cvBadgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes cvBadgePop {
      0%   { transform: scale(0); opacity: 0; }
      60%  { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
    /* Shimmer for newly-explored entries */
    @keyframes cvShimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    .cv-exp-entry.cv-shimmer {
      background: linear-gradient(90deg, transparent 30%, rgba(0,229,204,0.05) 50%, transparent 70%);
      background-size: 200% 100%;
      animation: cvShimmer 1.4s ease-out 1;
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
    #cv-tab-about {
      padding: 1.5rem 1.75rem 2rem;
    }
    #cv-tab-about.active {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    /* Section heading */
    .cv-about-heading {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.5);
      font-family: 'Courier New', Courier, monospace;
      margin: 0 0 1rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .cv-about-heading::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, rgba(0,229,204,0.2), transparent);
    }

    /* ── Trait Cards (Engineering DNA) ── */
    .cv-traits-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .cv-trait-card {
      position: relative;
      padding: 1rem 1.1rem 1rem;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.02);
      overflow: hidden;
      transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), border-color 0.28s, box-shadow 0.28s;
      animation: cvTraitIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
    }
    .cv-trait-card:hover {
      transform: translateY(-3px);
      border-color: rgba(0,229,204,0.25);
      box-shadow: 0 8px 28px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,229,204,0.06);
    }
    /* Colored top accent per card */
    .cv-trait-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: var(--trait-color, #00e5cc);
      opacity: 0.6;
    }
    /* Soft glow from top accent */
    .cv-trait-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 60px;
      background: linear-gradient(to bottom, var(--trait-color, #00e5cc), transparent);
      opacity: 0.04;
      pointer-events: none;
    }
    .cv-trait-icon {
      width: 2.2rem;
      height: 2.2rem;
      margin-bottom: 0.6rem;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: color-mix(in srgb, var(--trait-color, #00e5cc) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--trait-color, #00e5cc) 22%, transparent);
      color: var(--trait-color, #00e5cc);
      font-size: 1rem;
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--trait-color, #00e5cc) 40%, transparent));
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s ease, background 0.28s ease;
    }
    .cv-trait-icon svg { width: 1.05rem; height: 1.05rem; stroke: currentColor; display: block; }
    .cv-trait-card:hover .cv-trait-icon {
      transform: scale(1.08);
      background: color-mix(in srgb, var(--trait-color, #00e5cc) 18%, transparent);
      box-shadow: 0 0 16px color-mix(in srgb, var(--trait-color, #00e5cc) 30%, transparent);
    }
    .cv-trait-title {
      font-size: 0.79rem;
      font-weight: 700;
      color: rgba(255,255,255,0.9);
      margin: 0 0 0.3rem;
      line-height: 1.2;
    }
    .cv-trait-desc {
      font-size: 0.69rem;
      color: rgba(255,255,255,0.42);
      line-height: 1.6;
      margin: 0;
    }
    .cv-trait-desc strong {
      color: rgba(255,255,255,0.7);
      font-weight: 600;
    }
    @keyframes cvTraitIn {
      from { opacity: 0; transform: translateY(18px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }

    /* ── Education card ── */
    .cv-edu-card {
      position: relative;
      padding: 1.1rem 1.4rem;
      border-radius: 14px;
      overflow: hidden;
      background: rgba(255,255,255,0.02);
      animation: cvTraitIn 0.5s 0.18s cubic-bezier(0.16,1,0.3,1) both;
    }
    /* Animated conic border */
    .cv-edu-card::before {
      content: '';
      position: absolute;
      inset: -1px;
      border-radius: 15px;
      background: conic-gradient(
        from var(--cvEduAngle, 0deg),
        rgba(0,229,204,0.35) 0%,
        rgba(79,143,255,0.25) 25%,
        rgba(167,139,250,0.2) 50%,
        rgba(0,229,204,0.08) 75%,
        rgba(0,229,204,0.35) 100%
      );
      animation: cvEduSpin 8s linear infinite;
      z-index: 0;
    }
    @property --cvEduAngle {
      syntax: '<angle>';
      initial-value: 0deg;
      inherits: false;
    }
    @keyframes cvEduSpin { to { --cvEduAngle: 360deg; } }
    .cv-edu-card::after {
      content: '';
      position: absolute;
      inset: 1px;
      border-radius: 14px;
      background: linear-gradient(135deg, #0d1117 0%, #111827 100%);
      z-index: 0;
    }
    .cv-edu-inner {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 1.1rem;
    }
    .cv-edu-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(79,143,255,0.15), rgba(167,139,250,0.1));
      border: 1px solid rgba(79,143,255,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      flex-shrink: 0;
      color: rgba(79,143,255,0.85);
    }
    .cv-edu-badge svg { width: 1.5rem; height: 1.5rem; stroke: currentColor; display: block; }
    .cv-edu-text { flex: 1; min-width: 0; }
    .cv-edu-degree {
      font-size: 0.87rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.15rem;
      line-height: 1.25;
    }
    .cv-edu-university {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.42);
      margin: 0;
    }
    .cv-edu-tag {
      display: inline-block;
      margin-top: 0.4rem;
      padding: 0.18rem 0.6rem;
      background: rgba(79,143,255,0.1);
      border: 1px solid rgba(79,143,255,0.25);
      border-radius: 20px;
      font-size: 0.58rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: rgba(79,143,255,0.8);
    }

    /* ── Interests Grid ── */
    .cv-interests-intro {
      font-size: 0.77rem;
      line-height: 1.65;
      color: rgba(255,255,255,0.45);
      margin: 0 0 1rem;
    }
    .cv-interests-intro strong {
      color: rgba(255,255,255,0.72);
      font-weight: 600;
    }
    .cv-interests-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.6rem;
    }
    /* ── Interest card base ── */
    .cv-interest-card {
      position: relative;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.018);
      overflow: hidden;
      cursor: default;
      transition:
        transform 0.3s cubic-bezier(0.16,1,0.3,1),
        border-color 0.3s ease,
        box-shadow 0.3s ease;
      animation: cvCardIn 0.55s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes cvCardIn {
      from { opacity: 0; transform: translateY(22px) scale(0.94); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .cv-interest-card[data-photo-album] { cursor: pointer; }
    .cv-interest-card:hover {
      transform: translateY(-3px) scale(1.012);
      border-color: color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 45%, transparent);
      box-shadow: 0 10px 28px rgba(0,0,0,0.4), 0 0 0 1px color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 12%, transparent);
    }

    /* ══════════════════════════════════════════════
       PHOTO PREVIEW AREA  (top of photo cards)
    ══════════════════════════════════════════════ */
    .cv-interest-photo-area {
      position: relative;
      width: 100%;
      height: 88px;
      overflow: hidden;
      background: rgba(4, 6, 16, 0.8);
      flex-shrink: 0;
    }

    /* The actual photo — heavily blurred when locked */
    .cv-interest-photo-img {
      position: absolute;
      inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
      filter: blur(18px) brightness(0.22) saturate(0.3);
      transform: scale(1.18);
      transition:
        filter 1.1s cubic-bezier(0.16,1,0.3,1),
        transform 1.1s cubic-bezier(0.16,1,0.3,1);
      will-change: filter, transform;
    }
    .cv-interest-card.cv-discovered .cv-interest-photo-img {
      filter: blur(0px) brightness(0.72) saturate(1.15);
      transform: scale(1.0);
    }
    .cv-interest-card.cv-discovered:hover .cv-interest-photo-img {
      filter: blur(0px) brightness(0.88) saturate(1.3);
      transform: scale(1.06);
      transition: filter 0.45s ease, transform 0.65s ease;
    }

    /* CRT scanlines — fades out on unlock */
    .cv-interest-photo-scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.25) 2px,
        rgba(0,0,0,0.25) 4px
      );
      pointer-events: none;
      z-index: 1;
      transition: opacity 0.8s ease;
    }
    .cv-interest-card.cv-discovered .cv-interest-photo-scanlines { opacity: 0; }

    /* Shimmer sweep — animated on locked */
    .cv-interest-photo-shimmer {
      position: absolute;
      inset: 0;
      z-index: 2;
      background: linear-gradient(
        108deg,
        transparent 18%,
        rgba(255,255,255,0.028) 42%,
        rgba(255,255,255,0.065) 50%,
        rgba(255,255,255,0.028) 58%,
        transparent 82%
      );
      background-size: 280% 100%;
      animation: cvPhotoShimmer 4.2s ease-in-out infinite;
      pointer-events: none;
      transition: opacity 0.7s ease;
    }
    .cv-interest-card.cv-discovered .cv-interest-photo-shimmer { opacity: 0; animation: none; }
    @keyframes cvPhotoShimmer {
      0%   { background-position: 240% 0; }
      100% { background-position: -240% 0; }
    }

    /* Lock overlay (locked state) */
    .cv-interest-photo-lock {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      z-index: 3;
      pointer-events: none;
      transition: opacity 0.55s ease;
    }
    .cv-interest-card.cv-discovered .cv-interest-photo-lock { opacity: 0; }

    .cv-interest-lock-icon-wrap {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: rgba(4, 6, 16, 0.68);
      border: 1.5px solid rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.48);
      backdrop-filter: blur(6px);
      animation: cvLockPulse 3s ease-in-out infinite;
    }
    .cv-interest-lock-icon-wrap svg { width: 12px; height: 12px; stroke: currentColor; display: block; }
    @keyframes cvLockPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); border-color: rgba(255,255,255,0.12); }
      50%      { box-shadow: 0 0 0 7px rgba(255,255,255,0); border-color: rgba(255,255,255,0.28); }
    }
    .cv-interest-lock-label {
      font-size: 0.42rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
      font-family: 'Courier New', Courier, monospace;
    }

    /* Photo count badge (appears after unlock) */
    .cv-interest-photo-badge {
      position: absolute;
      bottom: 7px; right: 7px;
      z-index: 4;
      padding: 2px 7px;
      border-radius: 20px;
      background: rgba(4, 6, 16, 0.72);
      border: 1px solid rgba(0,229,204,0.32);
      font-size: 0.42rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      color: rgba(0,229,204,0.9);
      backdrop-filter: blur(6px);
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.55s 0.5s ease, transform 0.55s 0.5s cubic-bezier(0.16,1,0.3,1);
      pointer-events: none;
    }
    .cv-interest-card.cv-discovered .cv-interest-photo-badge {
      opacity: 1;
      transform: translateY(0);
    }

    /* Reveal flash on first discovery */
    @keyframes cvRevealFlash {
      0%   { opacity: 0.55; }
      100% { opacity: 0; }
    }
    .cv-interest-card.cv-discovered-new .cv-interest-photo-area::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--card-color, rgba(0,229,204,0.4));
      opacity: 0;
      animation: cvRevealFlash 1s cubic-bezier(0.16,1,0.3,1) forwards;
      z-index: 10;
      pointer-events: none;
    }

    /* ══════════════════════════════════════════════
       CARD HEADER — row layout for photo cards,
       centered column for non-photo cards
    ══════════════════════════════════════════════ */
    .cv-interest-card-header {
      padding: 0.7rem 0.65rem 0.55rem;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
    }
    /* Row layout when photo area present */
    .cv-interest-card:has(.cv-interest-photo-area) .cv-interest-card-header {
      flex-direction: row;
      align-items: center;
      padding: 0.55rem 0.65rem;
      gap: 0.5rem;
    }
    .cv-interest-card-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(160deg, var(--card-color, rgba(0,229,204,0.12)) 0%, transparent 70%);
      opacity: 0.28;
      pointer-events: none;
    }
    /* Tonal accent line at bottom of header for photo cards */
    .cv-interest-card:has(.cv-interest-photo-area) .cv-interest-card-header::after {
      content: '';
      position: absolute;
      bottom: 0; left: 8%; right: 8%;
      height: 1px;
      background: linear-gradient(to right, transparent, color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 30%, transparent), transparent);
    }

    /* Glow ring around icon on discovered */
    .cv-interest-icon-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 44px; height: 44px;
    }
    .cv-interest-card:has(.cv-interest-photo-area) .cv-interest-icon-wrap {
      width: 36px; height: 36px;
    }
    .cv-interest-icon-ring {
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 1.5px solid var(--card-color, rgba(0,229,204,0.3));
      opacity: 0;
      transition: opacity 0.4s;
    }
    .cv-interest-card.cv-discovered .cv-interest-icon-ring {
      opacity: 0.55;
      animation: cvIconRing 2.5s ease-in-out infinite;
    }
    @keyframes cvIconRing {
      0%,100% { transform: scale(1); opacity: 0.55; }
      50%      { transform: scale(1.12); opacity: 0.2; }
    }
    .cv-interest-card-icon {
      width: 2.4rem;
      height: 2.4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 28%, transparent);
      color: color-mix(in srgb, var(--card-color, #00e5cc) 80%, #fff);
      position: relative;
      z-index: 1;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), background 0.28s ease, box-shadow 0.28s ease;
    }
    .cv-interest-card:has(.cv-interest-photo-area) .cv-interest-card-icon {
      width: 2.0rem; height: 2.0rem;
      border-radius: 10px;
    }
    .cv-interest-card-icon svg { width: 1.1rem; height: 1.1rem; stroke: currentColor; display: block; }
    .cv-interest-card:has(.cv-interest-photo-area) .cv-interest-card-icon svg { width: 0.95rem; height: 0.95rem; }
    .cv-interest-card:hover .cv-interest-card-icon {
      transform: scale(1.08);
      background: color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 22%, transparent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 35%, transparent);
    }

    /* Text group (row layout) */
    .cv-interest-card-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.12rem;
    }
    .cv-interest-card-label {
      font-size: 0.67rem;
      font-weight: 700;
      color: rgba(255,255,255,0.88);
      letter-spacing: 0.02em;
      position: relative;
      z-index: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* Center for non-photo column layout */
    .cv-interest-card:not(:has(.cv-interest-photo-area)) .cv-interest-card-label { text-align: center; }
    .cv-interest-card-sub {
      font-size: 0.54rem;
      color: rgba(255,255,255,0.3);
      line-height: 1.3;
      position: relative;
      z-index: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cv-interest-card:not(:has(.cv-interest-photo-area)) .cv-interest-card-sub { text-align: center; }

    /* Detail hint — only for non-photo cards on hover */
    .cv-interest-detail {
      font-size: 0.54rem;
      font-style: italic;
      color: rgba(0,229,204,0.48);
      text-align: center;
      padding: 0 0.4rem;
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-height 0.3s ease, opacity 0.25s ease;
      position: relative;
      z-index: 1;
    }
    .cv-interest-card:not(:has(.cv-interest-photo-area)):hover .cv-interest-detail {
      max-height: 2rem;
      opacity: 1;
    }

    /* ── 3D world badge ── */
    .cv-interest-world {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(0,229,204,0.07);
      border: 1px solid rgba(0,229,204,0.18);
      font-size: 0.44rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: rgba(0,229,204,0.42);
      white-space: nowrap;
      transition: all 0.3s ease;
      z-index: 5;
    }
    .cv-interest-card.cv-discovered .cv-interest-world {
      background: rgba(0,229,204,0.13);
      border-color: rgba(0,229,204,0.42);
      color: #00e5cc;
      box-shadow: 0 0 8px rgba(0,229,204,0.28);
    }
    @keyframes cvDiscoverPop {
      0%   { transform: scale(0.6) translateY(-4px); opacity: 0; }
      65%  { transform: scale(1.15) translateY(0);   opacity: 1; }
      100% { transform: scale(1)   translateY(0);    opacity: 1; }
    }
    .cv-interest-card.cv-discovered-new .cv-interest-world {
      animation: cvDiscoverPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards;
    }

    /* ── Discovered glow burst (one-shot, border flash) ── */
    @keyframes cvDiscoverBurst {
      0%   { opacity: 0.7; box-shadow: 0 0 0 0 var(--card-color, rgba(0,229,204,0.5)); }
      100% { opacity: 0;   box-shadow: 0 0 0 12px transparent; }
    }
    .cv-interest-card.cv-discovered-new {
      animation: cvDiscoverBurst 0.7s ease-out forwards;
    }

    /* ══════════════════════════════════════════════
       CTA FOOTER STRIP
    ══════════════════════════════════════════════ */
    .cv-card-cta {
      margin-top: auto;
      padding: 6px 10px 7px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,0.04);
      background: rgba(0,0,0,0.18);
      min-height: 28px;
      transition: background 0.3s ease, border-top-color 0.3s ease;
    }

    /* Locked CTA text */
    .cv-cta-locked-text {
      font-size: 0.43rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.2);
      font-family: 'Courier New', Courier, monospace;
    }
    /* Unlocked CTA text (hidden by default) */
    .cv-cta-unlocked-text {
      font-size: 0.48rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: rgba(0,229,204,0.75);
      display: none;
      align-items: center;
      gap: 5px;
      transition: color 0.2s ease;
    }
    .cv-cta-arrow {
      display: inline-block;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    /* Discovered: swap locked ↔ unlocked */
    .cv-interest-card.cv-discovered .cv-cta-locked-text,
    .cv-interest-card:not([data-discovery-id])[data-photo-album] .cv-cta-locked-text { display: none; }
    .cv-interest-card.cv-discovered .cv-cta-unlocked-text,
    .cv-interest-card:not([data-discovery-id])[data-photo-album] .cv-cta-unlocked-text { display: flex; }
    /* Hover enhancements for unlocked cards */
    .cv-interest-card.cv-discovered:hover .cv-card-cta,
    .cv-interest-card:not([data-discovery-id])[data-photo-album]:hover .cv-card-cta {
      background: color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 8%, rgba(0,0,0,0.18));
      border-top-color: color-mix(in srgb, var(--card-color, rgba(0,229,204,0.3)) 25%, transparent);
    }
    .cv-interest-card.cv-discovered:hover .cv-cta-unlocked-text,
    .cv-interest-card:not([data-discovery-id])[data-photo-album]:hover .cv-cta-unlocked-text {
      color: rgba(0,229,204,1);
    }
    .cv-interest-card.cv-discovered:hover .cv-cta-arrow,
    .cv-interest-card:not([data-discovery-id])[data-photo-album]:hover .cv-cta-arrow {
      transform: translateX(3px);
    }
    /* Photo count in CTA */
    .cv-cta-photo-count {
      font-size: 0.42rem;
      color: rgba(0,229,204,0.45);
      font-family: 'Courier New', Courier, monospace;
      letter-spacing: 0.04em;
    }

    /* ── "Beyond the code" wink ── */
    .cv-beyond-wink {
      margin-top: 0.5rem;
      padding: 0.6rem 0.9rem;
      background: rgba(0,229,204,0.03);
      border: 1px solid rgba(0,229,204,0.08);
      border-radius: 10px;
      font-size: 0.68rem;
      font-style: italic;
      color: rgba(255,255,255,0.3);
      text-align: center;
      animation: cvTraitIn 0.5s 0.45s cubic-bezier(0.16,1,0.3,1) both;
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

    /* ── Inline experience photo (dimensions kept in sync with Journey CSS above) ── */

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
    const photos: LightboxPhoto[] = stop.journeyImages ?? (stop.journeyImage ?? stop.image
      ? [{ src: stop.journeyImage ?? stop.image!, caption: stop.journeyCaption ?? stop.imageCaption ?? "" }]
      : []);
    photos.forEach((p, i) => {
      const photoId = photos.length > 1 ? `${stop.id}--${i}` : stop.id;
      const photoEl = panel.querySelector<HTMLDivElement>(`[data-photo-id="${photoId}"]`);
      if (photoEl) {
        attachZoomHint(
          photoEl,
          () => p.src,
          { shape: "rect", caption: p.caption ?? "", hintSize: 16, album: photos, albumIndex: i },
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
          <a class="cv-action-link linkedin" href="https://www.linkedin.com/in/alexander-lazarovich/"
            target="_blank" rel="noopener">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
            </svg>
            LinkedIn
          </a>
          <a class="cv-action-link email" href="mailto:alex.lazarovichh@gmail.com">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z"/>
            </svg>
            Email
          </a>
          <a class="cv-action-link phone" href="tel:+972544567302">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
            </svg>
            +972 544 567 302
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

const STOP_COLORS: Record<string, string> = {
  asml:    "#3b82f6",
  restigo: "#fb923c",
  triolla: "#a78bfa",
  the5ers: "#10b981",
};
const STOP_SHORT_NAMES: Record<string, string> = {
  asml:    "ASML",
  restigo: "Restigo",
  triolla: "Triolla",
  the5ers: "The5ers",
};

function buildJourneyTab(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "cv-tab-panel";
  panel.id = "cv-tab-journey";

  // ── Horizontal Timeline Bar ────────────────────────────────────────────────
  const tlBar = document.createElement("div");
  tlBar.className = "cv-journey-tlbar";
  tlBar.innerHTML = `
    <div class="cv-jtl-track">
      <div class="cv-jtl-line"></div>
      ${TIMELINE_STOPS.map((stop) => {
        const color = STOP_COLORS[stop.id] ?? "#00e5cc";
        return `
          <div class="cv-jtl-stop" data-stop-id="${stop.id}" style="--stop-color:${color}">
            <div class="cv-jtl-node-wrap">
              <div class="cv-jtl-ring"></div>
              <div class="cv-jtl-node"></div>
            </div>
            <span class="cv-jtl-year">${stop.year}</span>
            <span class="cv-jtl-company">${STOP_SHORT_NAMES[stop.id] ?? stop.id}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
  panel.appendChild(tlBar);

  // ── Entry cards ────────────────────────────────────────────────────────────
  const expList = document.createElement("div");
  expList.className = "cv-exp-list";

  [...TIMELINE_STOPS].reverse().forEach((stop, cardIdx) => {
    const color = STOP_COLORS[stop.id] ?? "#00e5cc";
    const dashIdx = stop.title.indexOf(" — ");
    const company = dashIdx >= 0 ? stop.title.slice(0, dashIdx) : stop.title;
    const role    = dashIdx >= 0 ? stop.title.slice(dashIdx + 3) : "";

    const parts    = stop.subtitle.split("·").map((p) => p.trim()).filter(Boolean);
    const period   = parts[1] ?? String(stop.year);
    const duration = parts[2] ?? "";
    const location = parts.slice(3).join(" · ");
    const isPresent = period.includes("Present");

    const logoHtml = stop.logo
      ? `<div class="cv-entry-logo-wrap"><img class="cv-entry-logo" src="${stop.logo}" alt="${company}" /></div>`
      : "";

    const contextHtml = stop.companyContext
      ? `<div class="cv-entry-context">${stop.companyContext}</div>` : "";

    const pivotHtml = stop.narrativeNote
      ? `<div class="cv-pivot-note">${stop.narrativeNote}</div>` : "";

    const photos = stop.journeyImages ?? (stop.journeyImage ?? stop.image
      ? [{ src: stop.journeyImage ?? stop.image!, caption: stop.journeyCaption ?? stop.imageCaption ?? "", objectPosition: undefined as string | undefined }]
      : []);

    const photoHtml = photos.length > 0
      ? `<div class="cv-entry-photos"><div class="cv-exp-photos-grid">${
          photos.map((p, pi) => {
            const photoId = photos.length > 1 ? `${stop.id}--${pi}` : stop.id;
            return `<div class="cv-exp-photo" data-photo-id="${photoId}" style="--entry-color:${color}">
              <img src="${p.src}" alt="${p.caption}" ${p.objectPosition ? `style="object-position:${p.objectPosition}"` : ""} />
              ${p.caption ? `<div class="cv-exp-photo-caption">${p.caption}</div>` : ""}
            </div>`;
          }).join("")
        }</div></div>` : "";

    const baseDelay = cardIdx * 90;
    const bulletsHtml = stop.bullets.map((b, bi) =>
      `<li style="animation-delay:${baseDelay + 130 + bi * 48}ms">${highlight(b)}</li>`
    ).join("");

    const entry = document.createElement("div");
    entry.className = "cv-exp-entry";
    entry.id = `cv-exp-${stop.id}`;
    entry.dataset.stopId = stop.id;
    entry.style.cssText = `--entry-color:${color}; animation-delay:${baseDelay}ms;`;
    entry.innerHTML = `
      <div class="cv-entry-head">
        <div class="cv-entry-year-badge">${stop.year}</div>
        <div class="cv-entry-head-main">
          <div class="cv-entry-company">${company}</div>
          <div class="cv-entry-role">${role}</div>
          <div class="cv-exp-meta">
            <span class="cv-entry-period-chip">
              ${isPresent ? '<span class="cv-entry-period-chip-dot"></span>' : ""}
              ${period}
            </span>
            ${duration ? `<span class="cv-entry-location">${duration}</span>` : ""}
            ${location ? `<span class="cv-entry-location">· ${location}</span>` : ""}
          </div>
        </div>
        ${logoHtml}
      </div>
      ${contextHtml}
      <div class="cv-entry-body">
        <ul class="cv-exp-bullets">${bulletsHtml}</ul>
        <div class="cv-exp-skills">
          ${(stop.skills ?? []).map((s) => `<span class="cv-exp-skill">${s}</span>`).join("")}
        </div>
      </div>
      ${photoHtml}
      ${pivotHtml}
    `;
    expList.appendChild(entry);

    // Wire up timeline bar node click → scroll to entry
    const jtlStop = tlBar.querySelector<HTMLElement>(`.cv-jtl-stop[data-stop-id="${stop.id}"]`);
    if (jtlStop) {
      jtlStop.onclick = () => entry.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  panel.appendChild(expList);
  return panel;
}

// ── SVG Icon System (cross-platform consistent, no emoji) ─────────────────────
function _svgI(d: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;display:block">${d}</svg>`;
}
const SVG_ICONS = {
  // Engineering DNA
  compass:   _svgI('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'),
  fileText:  _svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>'),
  users:     _svgI('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  zap:       _svgI('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  // Beyond the Code interests
  gauge:     _svgI('<path d="M12 2a10 10 0 0 0-10 10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 22a10 10 0 0 1-6.52-2.46"/><path d="M12 22a10 10 0 0 0 6.52-2.46"/><path d="M12 12l4.5-4.5"/><circle cx="12" cy="12" r="1.5"/>'),
  bike:      _svgI('<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-2 11.5"/><path d="M9 6L5.5 17.5"/><path d="M12 12l6.5 5.5"/><circle cx="15" cy="5" r="1.3"/>'),
  dumbbell:  _svgI('<rect x="6" y="7" width="2.5" height="10" rx="1"/><rect x="15.5" y="7" width="2.5" height="10" rx="1"/><line x1="3.5" y1="10" x2="8.5" y2="10"/><line x1="3.5" y1="14" x2="8.5" y2="14"/><line x1="15.5" y1="10" x2="20.5" y2="10"/><line x1="15.5" y1="14" x2="20.5" y2="14"/><line x1="8.5" y1="12" x2="15.5" y2="12"/>'),
  paw:       _svgI('<circle cx="7" cy="8" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="4.5" cy="13.5" r="2"/><path d="M12 21c-4 0-7-3.5-7-7.5a7 7 0 0 1 14 0c0 4-3 7.5-7 7.5z"/>'),
  heart:     _svgI('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  gamepad:   _svgI('<rect x="2" y="6" width="20" height="12" rx="4"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1.2"/><circle cx="17.5" cy="13.5" r="1.2"/>'),
  grid4:     _svgI('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  music:     _svgI('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  plane:     _svgI('<path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2h-.01A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>'),
  graduationCap: _svgI('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
};

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
      <span class="cv-stack-stat-num">5+</span>
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

  // ── Engineering DNA ──────────────────────────────────────────────────────
  const dnaSection = document.createElement("div");
  const TRAITS = [
    {
      icon: SVG_ICONS.compass,
      title: "End-to-End Ownership",
      desc: "I own the <strong>full lifecycle</strong> — architecture decisions, production incidents, postmortems. Half-ownership is half-accountability.",
      color: "#00e5cc",
      delay: 0,
    },
    {
      icon: SVG_ICONS.fileText,
      title: "Document Before Build",
      desc: "Every system I ship has a <strong>README before it has code</strong>. API contracts before implementations. Future me says thanks.",
      color: "#4f8fff",
      delay: 80,
    },
    {
      icon: SVG_ICONS.users,
      title: "Mentor by Pairing",
      desc: "I <strong>mentor by sitting down</strong> and showing, not telling. Led 6 teams at The5ers, promoted to lead in 9 months at Restigo.",
      color: "#a78bfa",
      delay: 160,
    },
    {
      icon: SVG_ICONS.zap,
      title: "Ship, Then Improve",
      desc: "I don't over-engineer first drafts. I <strong>ship, measure, iterate</strong>. Performance is the product — I proved that at The5ers.",
      color: "#f59e0b",
      delay: 240,
    },
  ];

  dnaSection.innerHTML = `<p class="cv-about-heading">◈ Engineering DNA</p>`;
  const traitsGrid = document.createElement("div");
  traitsGrid.className = "cv-traits-grid";
  TRAITS.forEach((t) => {
    const card = document.createElement("div");
    card.className = "cv-trait-card";
    card.style.cssText = `--trait-color:${t.color}; animation-delay:${t.delay}ms;`;
    card.innerHTML = `
      <span class="cv-trait-icon">${t.icon}</span>
      <p class="cv-trait-title">${t.title}</p>
      <p class="cv-trait-desc">${t.desc}</p>
    `;
    traitsGrid.appendChild(card);
  });
  dnaSection.appendChild(traitsGrid);
  panel.appendChild(dnaSection);

  // ── Education ────────────────────────────────────────────────────────────
  const eduSection = document.createElement("div");
  eduSection.innerHTML = `
    <p class="cv-about-heading">◈ Education</p>
    <div class="cv-edu-card">
      <div class="cv-edu-inner">
        <div class="cv-edu-badge">${SVG_ICONS.graduationCap}</div>
        <div class="cv-edu-text">
          <p class="cv-edu-degree">B.Sc. Electrical &amp; Electronics Engineering</p>
          <p class="cv-edu-university">Ariel University &nbsp;·&nbsp; Israel</p>
          <span class="cv-edu-tag">EE → Software Engineering</span>
        </div>
      </div>
    </div>
  `;
  panel.appendChild(eduSection);

  // ── Beyond the Code ──────────────────────────────────────────────────────
  const interestsSection = document.createElement("div");
  const INTEREST_CARDS = [
    {
      discoveryId: "bmw", photoAlbum: "bmw",
      icon: SVG_ICONS.gauge, label: "BMW S1000RR", sub: "199hp weekend therapy",
      detail: "Click the bike on the spawn pad",
      color: "rgba(239,68,68,0.5)", photoCount: 2,
    },
    {
      discoveryId: "mtb", photoAlbum: "mtb",
      icon: SVG_ICONS.bike, label: "80km Rides", sub: "Friday mornings",
      detail: "MTB parked on the spawn pad",
      color: "rgba(74,222,128,0.5)", photoCount: 3,
    },
    {
      discoveryId: "gym",
      icon: SVG_ICONS.dumbbell, label: "Gym", sub: "5 days a week",
      detail: "32kg kettlebell on the arena",
      color: "rgba(251,191,36,0.5)",
    },
    {
      discoveryId: "meny", photoAlbum: "meny",
      icon: SVG_ICONS.paw, label: "Meny", sub: "Short for Manfred",
      detail: "Named after Manny from Ice Age",
      color: "rgba(56,189,248,0.5)", photoCount: 2,
    },
    {
      discoveryId: "twins", photoAlbum: "twins",
      icon: SVG_ICONS.heart, label: "Twins", sub: "Tomer & Alma",
      detail: "Their masterpiece on the arena",
      color: "rgba(244,114,182,0.5)", photoCount: 2,
    },
    {
      discoveryId: "monogram",
      icon: SVG_ICONS.gamepad, label: "Game Dev", sub: "Side passion",
      detail: "Find the AL monogram on the arena",
      color: "rgba(167,139,250,0.5)",
    },
    {
      discoveryId: "lego", photoAlbum: "lego",
      icon: SVG_ICONS.grid4, label: "LEGO", sub: "Cities with the twins",
      detail: "Brick stack on the arena",
      color: "rgba(251,191,36,0.5)", photoCount: 3,
    },
    {
      discoverable: false,
      icon: SVG_ICONS.music, label: "Classic Rock", sub: "Always playing",
      detail: "Best debugging soundtrack",
      color: "rgba(168,85,247,0.5)",
    },
    {
      discoverable: false,
      icon: SVG_ICONS.plane, label: "Travel", sub: "Thailand, northern Israel",
      detail: "Every trip is a research project",
      color: "rgba(14,165,233,0.5)",
    },
  ];

  interestsSection.innerHTML = `<p class="cv-about-heading">◈ Beyond the Code</p>`;
  const introP = document.createElement("p");
  introP.className = "cv-interests-intro";
  introP.innerHTML = `When I'm not shipping — building LEGO cities with the twins,
    hiking with <strong>Meny the Malamute</strong> (named after Manfred from Ice Age — yes, that's him in the 3D world),
    or pushing 80&nbsp;km on a Friday morning ride.`;
  interestsSection.appendChild(introP);

  const grid = document.createElement("div");
  grid.className = "cv-interests-grid";

  INTEREST_CARDS.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "cv-interest-card";
    el.style.cssText = `--card-color:${card.color}; animation-delay:${i * 55}ms;`;

    if (card.discoveryId)  el.dataset.discoveryId  = card.discoveryId;
    if (card.photoAlbum)   el.dataset.photoAlbum   = card.photoAlbum;
    if (card.discoverable === false) el.dataset.discoverable = "false";

    // World badge
    const worldBadge = card.discoveryId
      ? `<span class="cv-interest-world">↗ In 3D world</span>`
      : "";

    // Photo preview area (blurred tease — only for photo album cards)
    const firstPhoto = card.photoAlbum ? CARD_PHOTOS[card.photoAlbum]?.[0] : null;
    const photoAreaHtml = firstPhoto ? `
      <div class="cv-interest-photo-area">
        <img class="cv-interest-photo-img" src="${firstPhoto.src}" alt=""
          ${firstPhoto.objectPosition ? `style="object-position:${firstPhoto.objectPosition}"` : ""} />
        <div class="cv-interest-photo-scanlines"></div>
        <div class="cv-interest-photo-shimmer"></div>
        <div class="cv-interest-photo-lock">
          <div class="cv-interest-lock-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <span class="cv-interest-lock-label">Find in 3D World</span>
        </div>
        ${card.photoCount ? `<div class="cv-interest-photo-badge">${card.photoCount} photos</div>` : ""}
      </div>` : "";

    // CTA footer (only for photo cards)
    const ctaHtml = card.photoAlbum ? `
      <div class="cv-card-cta">
        <span class="cv-cta-locked-text">Locked</span>
        <span class="cv-cta-unlocked-text">
          View photos <span class="cv-cta-arrow">→</span>
        </span>
        ${card.photoCount ? `<span class="cv-cta-photo-count">${card.photoCount} photos</span>` : ""}
      </div>` : "";

    // Header text wrapper (row layout for photo cards, column for non-photo)
    const headerInner = firstPhoto
      ? `<div class="cv-interest-icon-wrap"><div class="cv-interest-icon-ring"></div><span class="cv-interest-card-icon">${card.icon}</span></div>
         <div class="cv-interest-card-text">
           <span class="cv-interest-card-label">${card.label}</span>
           <span class="cv-interest-card-sub">${card.sub}</span>
         </div>`
      : `<div class="cv-interest-icon-wrap"><div class="cv-interest-icon-ring"></div><span class="cv-interest-card-icon">${card.icon}</span></div>
         <span class="cv-interest-card-label">${card.label}</span>
         <span class="cv-interest-card-sub">${card.sub}</span>
         <span class="cv-interest-detail">${card.detail}</span>`;

    el.innerHTML = `
      ${worldBadge}
      ${photoAreaHtml}
      <div class="cv-interest-card-header">${headerInner}</div>
      ${ctaHtml}
    `;

    grid.appendChild(el);
  });

  interestsSection.appendChild(grid);
  const wink = document.createElement("div");
  wink.className = "cv-beyond-wink";
  wink.textContent = "And yes — this entire portfolio is a playable video game. I couldn't resist.";
  interestsSection.appendChild(wink);
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
    const stops   = journeyPanel.querySelectorAll<HTMLElement>(".cv-jtl-stop[data-stop-id]");
    const panelRect = journeyPanel.getBoundingClientRect();
    const threshold = panelRect.top + panelRect.height * 0.38;

    let closestId = "";
    let closestDist = Infinity;

    entries.forEach((entry) => {
      const rect = entry.getBoundingClientRect();
      const dist = Math.abs(rect.top - threshold);
      if (dist < closestDist) { closestDist = dist; closestId = entry.dataset.stopId ?? ""; }
    });

    stops.forEach((stop) => {
      stop.classList.toggle("active", stop.dataset.stopId === closestId);
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

    if (completed && metaEl) {
      // Add explored badge if not already present
      if (!metaEl.querySelector(".cv-explored-badge")) {
        const badge = document.createElement("span");
        badge.className = "cv-explored-badge";
        badge.textContent = "✦ Explored";
        metaEl.appendChild(badge);
      }
      // Highlight the card with explored state
      entry.classList.add("cv-entry-explored");

      // Shimmer on newly-seen completions
      if (!seenUnlocks.has(id)) {
        seenUnlocks.add(id);
        entry.classList.add("cv-shimmer");
        setTimeout(() => entry.classList.remove("cv-shimmer"), 1500);
      }
    }
    // Journey photos are always visible — no gate-based unlock
  });

  // Update timeline bar completion state
  document.querySelectorAll<HTMLElement>(".cv-jtl-stop[data-stop-id]").forEach((stop) => {
    const id = stop.dataset.stopId!;
    stop.classList.toggle("completed", isStopCompleted(id));
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

    /* ── Photo modal backdrop ── */
    #cv-photo-backdrop {
      position: fixed;
      inset: 0;
      z-index: 3499;
      background: rgba(4, 6, 16, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease;
    }
    #cv-photo-backdrop.cpp-visible { opacity: 1; pointer-events: auto; }

    #cv-photo-panel {
      position: fixed;
      z-index: 3500;
      width: min(380px, calc(100vw - 2rem));
      border-radius: 20px;
      background: linear-gradient(160deg, #0d1117 0%, #111827 60%, #0a0e1a 100%);
      border: 1px solid rgba(0,229,204,0.18);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow:
        0 40px 100px rgba(0,0,0,0.85),
        0 0 0 1px rgba(0,229,204,0.06),
        inset 0 1px 0 rgba(255,255,255,0.05);
      overflow: hidden;
      opacity: 0;
      /* Centered in viewport */
      top: 50%;
      left: 50%;
      transform: translate(-50%, calc(-50% + 28px)) scale(0.9);
      transition: opacity 0.22s ease, transform 0.36s cubic-bezier(0.16,1,0.3,1);
      pointer-events: none;
    }
    #cv-photo-panel.cpp-visible {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
      pointer-events: auto;
    }

    /* ── Panel header (title + close btn) ── */
    .cpp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.8rem 0.9rem 0.5rem;
    }
    .cpp-title {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.5);
      font-family: 'Courier New', Courier, monospace;
    }
    .cpp-close-btn {
      width: 26px; height: 26px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; line-height: 1;
      transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
      padding: 0;
    }
    .cpp-close-btn:hover {
      background: rgba(239,68,68,0.14);
      border-color: rgba(239,68,68,0.42);
      color: rgba(252,165,165,0.9);
      transform: rotate(90deg);
    }

    /* ── Image area ── */
    .cpp-img-area {
      position: relative;
      width: 100%;
      height: 240px;
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

  // Backdrop
  let backdropEl = document.getElementById("cv-photo-backdrop");
  if (!backdropEl) {
    backdropEl = document.createElement("div");
    backdropEl.id = "cv-photo-backdrop";
    backdropEl.addEventListener("click", hidePhotoPanel);
    document.body.appendChild(backdropEl);
  }

  photoPanelEl = document.createElement("div");
  photoPanelEl.id = "cv-photo-panel";

  // Header row: title + close button
  const headerEl = document.createElement("div");
  headerEl.className = "cpp-header";
  headerEl.innerHTML = `<span class="cpp-title">Photo Gallery</span>`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "cpp-close-btn";
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="width:14px;height:14px;display:block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); hidePhotoPanel(); });
  headerEl.appendChild(closeBtn);
  photoPanelEl.appendChild(headerEl);

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




function hidePhotoPanel(): void {
  // Ensure panel DOM exists before trying to hide it (lazy init)
  if (!photoPanelEl) { createPhotoPanel(); }
  photoPanelEl?.classList.remove("cpp-visible");
  document.getElementById("cv-photo-backdrop")?.classList.remove("cpp-visible");
  clearPhotoPanelTouchClose();
}

function clearPhotoPanelTouchClose(): void {
  // No-op — kept for call-site compatibility; touch-close handled by backdrop now
}

/** Attach click listeners to cards with photo albums — opens lightbox album directly. */
function initPhotoPanelHovers(): void {
  const cards = document.querySelectorAll<HTMLElement>(
    ".cv-interest-card[data-photo-album], .cv-interest-card[data-discovery-id]"
  );

  cards.forEach((card) => {
    const key = card.dataset.photoAlbum ?? card.dataset.discoveryId ?? "";
    const photos = CARD_PHOTOS[key];
    if (!photos?.length) return;
    if (card.dataset.photoPanelBound === "1") return;
    card.dataset.photoPanelBound = "1";

    // Only open lightbox if this card has been discovered
    card.addEventListener("click", (e) => {
      const discovered = card.classList.contains("cv-discovered");
      if (!discovered) return; // let the locked state stand — no lightbox yet
      e.preventDefault();
      e.stopPropagation();
      openLightboxAlbum(photos, 0, card);
    });
  });
}

export function initCVPanel(): void {
  createCVPanel();
}
