import type { StopData } from "../scene/types";
import { addTiltEffect } from "./tiltEffect";

// positionerEl — outer div: fixed positioning, opacity, slide-in transition (pointer-events: none)
// cardEl       — inner div: visual card + tilt + click handler (pointer-events: auto)
let positionerEl: HTMLDivElement | null = null;
let cardEl: HTMLDivElement | null = null;
let currentStopId: string | null = null;
let latestInteractCb: (() => void) | undefined;
/** True while crossfade is mid-flight — prevents re-triggering. */
let isSwitching = false;

// ── Styles (injected once) ─────────────────────────────────────────────────

function injectPanelStyles(): void {
  if (document.getElementById("gate-panel-styles")) return;
  const s = document.createElement("style");
  s.id = "gate-panel-styles";
  s.textContent = `
    @keyframes gpCtaGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,204,0), 0 0 0 1px rgba(0,229,204,0.22); }
      50%       { box-shadow: 0 0 14px 3px rgba(0,229,204,0.18), 0 0 0 1px rgba(0,229,204,0.5); }
    }
    @keyframes gpArrowBounce {
      0%, 100% { transform: translateX(0); }
      50%       { transform: translateX(4px); }
    }
    /* ── CTA: ready state (in interact range) ── */
    #gate-panel-cta-ready {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      width: 100%;
      padding: 0.6rem 0.9rem;
      background: rgba(0,229,204,0.07);
      border: 1px solid rgba(0,229,204,0.25);
      border-radius: 9px;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
      text-align: left;
      /* enter: slide up + fade in */
      opacity: 0;
      transform: translateY(8px) scale(0.97);
      pointer-events: none;
      transition:
        opacity   0.38s cubic-bezier(0.16,1,0.3,1),
        transform 0.38s cubic-bezier(0.16,1,0.3,1),
        background 0.2s, border-color 0.2s;
    }
    #gate-panel-cta-ready.gp-active {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
      animation: gpCtaGlow 2.2s ease-in-out infinite;
    }
    #gate-panel-cta-ready.gp-active:hover {
      background: rgba(0,229,204,0.14);
      border-color: rgba(0,229,204,0.55);
      transform: translateY(-1px) scale(1);
    }
    #gate-panel-cta-ready.gp-active:active {
      transform: scale(0.98);
    }
    #gate-panel-cta-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 5px;
      background: rgba(0,229,204,0.12);
      border: 1px solid rgba(0,229,204,0.4);
      border-bottom: 2px solid rgba(0,229,204,0.55);
      border-radius: 5px;
      font-family: system-ui, monospace;
      font-size: 0.72rem;
      font-weight: 800;
      color: #00e5cc;
      flex-shrink: 0;
    }
    #gate-panel-cta-label { flex: 1; color: rgba(255,255,255,0.9); }
    #gate-panel-cta-arrow {
      color: #00e5cc;
      font-size: 0.9rem;
      animation: gpArrowBounce 1.4s ease-in-out infinite;
      flex-shrink: 0;
    }

    /* ── CTA: hint state (too far, approaching) ── */
    #gate-panel-cta-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.45rem 0;
      font-size: 0.68rem;
      color: rgba(255,255,255,0.28);
      letter-spacing: 0.04em;
      /* exit: slide up + fade out when switching to ready */
      opacity: 1;
      transform: translateY(0);
      transition:
        opacity   0.25s ease,
        transform 0.25s ease;
    }
    #gate-panel-cta-hint.gp-hidden {
      opacity: 0;
      transform: translateY(-5px);
      pointer-events: none;
    }

    #gate-panel {
      transition: filter 0.2s ease, opacity 0.18s ease;
    }
    #gate-panel:hover { filter: brightness(1.06); }
  `;
  document.head.appendChild(s);
}

// ── DOM creation ───────────────────────────────────────────────────────────

function getOrCreate(): { positioner: HTMLDivElement; card: HTMLDivElement } {
  if (positionerEl && cardEl) return { positioner: positionerEl, card: cardEl };

  injectPanelStyles();

  // Outer positioner — positions the card, handles opacity/slide (no pointer-events)
  const positioner = document.createElement("div");
  positioner.id = "gate-panel-positioner";
  positioner.style.cssText = `
    position: fixed;
    right: 3vw;
    top: 50%;
    transform: translateY(-50%) translateX(20px);
    z-index: 500;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.28s ease-out, transform 0.28s ease-out;
  `;

  // Inner card — visual + tilt + click target
  const card = document.createElement("div");
  card.id = "gate-panel";
  card.style.cssText = `
    width: 320px;
    background: #0d1117;
    border-radius: 14px;
    border: 1px solid rgba(0,229,204,0.18);
    box-shadow: 0 16px 56px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,229,204,0.06), 0 0 36px rgba(0,229,204,0.04);
    color: #fff;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    overflow: hidden;
    will-change: transform;
    transform-style: preserve-3d;
    position: relative;
    pointer-events: auto;
    cursor: pointer;
  `;

  card.innerHTML = `
    <div id="gate-panel-top-bar" style="
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #00e5cc 35%, #4ecdc4 58%, transparent 100%);
      opacity: 0.85;
    "></div>

    <div id="gate-panel-image-wrap" style="
      position: relative;
      width: 100%;
      height: 130px;
      overflow: hidden;
      display: none;
    ">
      <img id="gate-panel-image" src="" alt="" style="
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 42%;
        display: block;
      " />
      <div style="
        position: absolute;
        inset: 0;
        background:
          linear-gradient(to bottom,
            rgba(0,0,0,0.18) 0%,
            transparent 30%,
            transparent 55%,
            rgba(13,17,23,0.82) 82%,
            rgba(13,17,23,1) 100%
          ),
          linear-gradient(to right,
            rgba(255,190,40,0.06) 0%,
            transparent 100%
          );
        pointer-events: none;
      "></div>
      <div id="gate-panel-img-caption" style="
        position: absolute;
        bottom: 0.45rem;
        left: 0.75rem;
        font-size: 0.57rem;
        color: rgba(255,255,255,0.38);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        line-height: 1.4;
        pointer-events: none;
      "></div>
    </div>

    <div style="padding: 1.1rem 1.4rem 0.9rem;">
      <div id="gate-panel-year" style="
        display: none;
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: #00e5cc;
        text-transform: uppercase;
        margin-bottom: 0.28rem;
        opacity: 0.9;
      "></div>
      <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.18rem;">
        <div id="gate-panel-logo-wrap" style="
          width: 28px; height: 28px;
          border-radius: 6px;
          background: #fff;
          flex-shrink: 0;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 2px;
          overflow: hidden;
          box-shadow: 0 1px 5px rgba(0,0,0,0.4);
        ">
          <img id="gate-panel-logo-img" src="" alt="" style="width:100%;height:100%;object-fit:contain;" />
        </div>
        <div id="gate-panel-title" style="
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
          line-height: 1.25;
          letter-spacing: -0.01em;
        "></div>
      </div>
      <div id="gate-panel-subtitle" style="
        font-size: 0.73rem;
        color: rgba(255,255,255,0.38);
        font-style: italic;
        margin-bottom: 0.5rem;
        display: none;
      "></div>
      <div id="gate-panel-context" style="
        font-size: 0.7rem;
        color: rgba(255,255,255,0.42);
        line-height: 1.5;
        padding: 0.4rem 0.55rem;
        margin-bottom: 0.75rem;
        border-left: 2px solid rgba(0,229,204,0.25);
        background: rgba(0,229,204,0.035);
        border-radius: 0 5px 5px 0;
        display: none;
      "></div>
      <ul id="gate-panel-bullets" style="
        list-style: none;
        padding: 0;
        margin: 0 0 0.85rem 0;
        display: none;
        border-top: 1px solid rgba(255,255,255,0.06);
        padding-top: 0.7rem;
      "></ul>
      <div id="gate-panel-links" style="
        display: none;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 0.85rem;
      "></div>
    </div>

    <!-- CTA: two states toggled by updateGatePanel -->
    <div id="gate-panel-cta-wrap" style="padding: 0 1.1rem 1.1rem;">
      <!-- State A: in interact range → full glowing button -->
      <button id="gate-panel-cta-ready">
        <span id="gate-panel-cta-key">E</span>
        <span id="gate-panel-cta-label">Open full story</span>
        <span id="gate-panel-cta-arrow">→</span>
      </button>
      <!-- State B: in proximity but too far to interact -->
      <div id="gate-panel-cta-hint">
        <span style="opacity:0.5">↑</span>
        <span>walk closer to interact</span>
      </div>
    </div>
  `;

  positioner.appendChild(card);
  document.body.appendChild(positioner);

  positionerEl = positioner;
  cardEl = card;

  // Click anywhere on card triggers the callback (set by updateGatePanel when in range)
  card.addEventListener("click", (e) => {
    e.stopPropagation();
    latestInteractCb?.();
  });

  // Tilt via global mouse (card has pointer-events but positioner still won't block scene)
  addTiltEffect(card, {
    useGlobalMouse: true,
    isActive: () => parseFloat(positioner.style.opacity) > 0.05,
    maxRotation: 10,
    scale: 1.03,
    lerpFactor: 0.09,
    accentColor: "0, 229, 204",
  });

  return { positioner, card };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function initGatePanel(): void {
  getOrCreate();
}

export function updateGatePanel(
  data: StopData | null,
  proximityFactor: number,
  /** True when player is within INTERACT_RADIUS — unlocks the CTA and click. */
  canInteract = false,
  /** Callback invoked on CTA click / E press when in range. */
  onInteract?: () => void,
): void {
  const { positioner, card } = getOrCreate();

  latestInteractCb = canInteract ? onInteract : undefined;

  if (!data || proximityFactor <= 0) {
    positioner.style.opacity = "0";
    positioner.style.transform = "translateY(-50%) translateX(20px)";
    return;
  }

  if (data.id !== currentStopId && !isSwitching) {
    const clamped0 = Math.max(0, Math.min(1, proximityFactor));

    if (clamped0 > 0.15 && currentStopId !== null) {
      // Card already visible — crossfade: fade out → swap → fade in
      isSwitching = true;
      card.style.opacity = "0";
      setTimeout(() => {
        currentStopId = data.id;
        populateCard(card, data);
        card.style.opacity = "1";
        isSwitching = false;
      }, 200);
    } else {
      // Card not yet visible — swap instantly (no visible flash)
      currentStopId = data.id;
      populateCard(card, data);
    }
  }

  // Drive CTA state (update every frame so it reacts to distance changes)
  const ctaReady = card.querySelector("#gate-panel-cta-ready") as HTMLButtonElement;
  const ctaHint = card.querySelector("#gate-panel-cta-hint") as HTMLDivElement;
  ctaReady.classList.toggle("gp-active", canInteract);
  ctaHint.classList.toggle("gp-hidden", canInteract);
  card.style.cursor = canInteract ? "pointer" : "default";

  const clamped = Math.max(0, Math.min(1, proximityFactor));
  const slideX = (1 - clamped) * 20;
  positioner.style.opacity = String(clamped);
  positioner.style.transform = `translateY(-50%) translateX(${slideX}px)`;
}

// ── Card population ────────────────────────────────────────────────────────

function populateCard(card: HTMLDivElement, data: StopData): void {
  const yearEl = card.querySelector("#gate-panel-year") as HTMLDivElement;
  const titleEl = card.querySelector("#gate-panel-title") as HTMLDivElement;
  const subtitleEl = card.querySelector("#gate-panel-subtitle") as HTMLDivElement;
  const logoWrap = card.querySelector("#gate-panel-logo-wrap") as HTMLDivElement;
  const logoImg = card.querySelector("#gate-panel-logo-img") as HTMLImageElement;
  const contextEl = card.querySelector("#gate-panel-context") as HTMLDivElement;
  const bulletsEl = card.querySelector("#gate-panel-bullets") as HTMLUListElement;
  const linksEl = card.querySelector("#gate-panel-links") as HTMLDivElement;
  const imageWrap = card.querySelector("#gate-panel-image-wrap") as HTMLDivElement;
  const imageEl = card.querySelector("#gate-panel-image") as HTMLImageElement;
  const imgCaptionEl = card.querySelector("#gate-panel-img-caption") as HTMLDivElement;

  // Image header strip
  if (data.image) {
    imageEl.src = data.image;
    imageEl.alt = data.imageCaption ?? "";
    imgCaptionEl.textContent = data.imageCaption ?? "";
    imageWrap.style.display = "block";
  } else {
    imageEl.src = "";
    imageWrap.style.display = "none";
  }

  // Logo badge
  if (data.logo) {
    logoImg.src = data.logo;
    logoImg.alt = "";
    logoWrap.style.display = "flex";
  } else {
    logoImg.src = "";
    logoWrap.style.display = "none";
  }

  // Parse "2018 — ASML — Field Service Engineer" → year + company + role
  const parts = data.title.split(" — ");
  if (parts.length >= 2) {
    yearEl.textContent = parts[0];
    yearEl.style.display = "block";
    titleEl.innerHTML =
      parts.length >= 3
        ? `${parts[1]}<span style="display:block;font-size:0.8rem;font-weight:400;color:rgba(255,255,255,0.6);margin-top:0.1rem">${parts.slice(2).join(" — ")}</span>`
        : parts[1];
  } else {
    yearEl.style.display = "none";
    titleEl.textContent = data.title;
  }

  subtitleEl.textContent = data.subtitle ?? "";
  subtitleEl.style.display = data.subtitle ? "block" : "none";

  contextEl.textContent = data.companyContext ?? "";
  contextEl.style.display = data.companyContext ? "block" : "none";

  if (data.bullets && data.bullets.length > 0) {
    bulletsEl.innerHTML = data.bullets
      .slice(0, 2)
      .map(
        (b) =>
          `<li style="padding:0.25rem 0 0.25rem 1.1rem;position:relative;font-size:0.76rem;color:rgba(255,255,255,0.72);line-height:1.5"><span style="position:absolute;left:0;color:#00e5cc">▸</span>${b}</li>`,
      )
      .join("");
    bulletsEl.style.display = "block";
  } else {
    bulletsEl.innerHTML = "";
    bulletsEl.style.display = "none";
  }

  if (data.links && data.links.length > 0) {
    linksEl.innerHTML = data.links
      .map(
        (l) =>
          `<a href="${l.url}" target="_blank" rel="noopener" style="display:inline-block;padding:0.3rem 0.65rem;background:rgba(0,229,204,0.08);border:1px solid rgba(0,229,204,0.25);border-radius:6px;color:#00e5cc;text-decoration:none;font-size:0.72rem">${l.label}</a>`,
      )
      .join("");
    linksEl.style.display = "flex";
  } else {
    linksEl.innerHTML = "";
    linksEl.style.display = "none";
  }
}
