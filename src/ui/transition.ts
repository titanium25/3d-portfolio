import * as THREE from "three";
import type { StopData } from "../scene/types";
import { addTiltEffect } from "./tiltEffect";
import { highlight, injectHighlightStyles } from "./highlightUtils";
import { initPhotoLightbox, attachZoomHint } from "./photoLightbox";

const DURATION_MS = 700;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

const HOME_POSITION = new THREE.Vector3(6, 6, 10);
const HOME_TARGET = new THREE.Vector3(0, 0.5, 0);

// #cinematic-content  — outer animation wrapper (translateY / opacity slide-in)
// #cinematic-card     — inner visual card (background, border, flex layout, TILT)
let overlayEl: HTMLDivElement | null = null;
let contentEl: HTMLDivElement | null = null;   // animation wrapper
let cardEl: HTMLDivElement | null = null;       // visual card + tilt
let isTransitioning = false;
let isOpen = false;
let detachImgZoom: (() => void) | null = null; // cleanup for current image zoom hint

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("cinematic-styles")) return;
  const style = document.createElement("style");
  style.id = "cinematic-styles";
  style.textContent = `
    /* Animation wrapper — only drives enter/exit, no visual styles */
    #cinematic-content {
      position: relative;
      max-width: 440px;
      width: calc(100% - 2rem);
      transform: translateY(40px);
      opacity: 0;
      transition:
        transform 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.18s,
        opacity 0.45s ease-out 0.18s;
      pointer-events: auto;
    }
    #cinematic-content.has-image {
      max-width: 660px;
    }

    /* Visual card — background, layout, tilt target */
    #cinematic-card {
      background: linear-gradient(145deg, #0d1117 0%, #111827 55%, #0a0f1e 100%);
      border-radius: 16px;
      color: #fff;
      box-shadow:
        0 32px 80px rgba(0,0,0,0.7),
        0 0 0 1px rgba(0,229,204,0.13),
        0 0 48px rgba(0,229,204,0.03);
      border: 1px solid rgba(0,229,204,0.14);
      overflow: hidden;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: row;
      will-change: transform;
      transform-style: preserve-3d;
      position: relative;
      max-height: min(620px, calc(92vh - 2rem));
    }

    /* Top accent line */
    #cinematic-top-bar {
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #00e5cc 35%, #4ecdc4 55%, transparent 100%);
      opacity: 0.9;
      position: absolute;
      top: 0; left: 0; right: 0;
      z-index: 3;
      pointer-events: none;
    }

    /* ── Close button (pill with ESC badge) ── */
    #cinematic-close {
      position: absolute;
      top: 0.7rem;
      right: 0.7rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.65rem 0.3rem 0.45rem;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      cursor: pointer;
      color: rgba(255,255,255,0.55);
      font-family: inherit;
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.03em;
      z-index: 10;
      transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
      white-space: nowrap;
    }
    #cinematic-close:hover {
      background: rgba(0,229,204,0.1);
      color: #fff;
      border-color: rgba(0,229,204,0.35);
      transform: scale(1.04);
    }
    #cinematic-close:active { transform: scale(0.97); }
    #cinematic-close .esc-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 1px 5px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-bottom: 2px solid rgba(255,255,255,0.25);
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
      font-family: system-ui, monospace;
      color: rgba(255,255,255,0.7);
      line-height: 1.4;
    }
    #cinematic-close .close-x {
      font-size: 1rem;
      line-height: 1;
      color: rgba(255,255,255,0.4);
      margin-left: 1px;
    }

    /* Hide controls hint while overlay is open */
    body.transition-open #controls-hint {
      opacity: 0 !important;
      pointer-events: none;
      transition: opacity 0.25s ease !important;
    }

    /* ── Backdrop hint below the card ── */
    #cinematic-backdrop-hint {
      margin-top: 0.9rem;
      font-size: 0.65rem;
      color: rgba(255,255,255,0.22);
      letter-spacing: 0.06em;
      text-align: center;
      pointer-events: none;
      user-select: none;
    }

    /* ── Image panel ─────────────────────────────────────────────── */
    #cinematic-img-panel {
      width: 235px;
      min-width: 235px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      align-self: stretch;
      display: none;
      border-radius: 16px 0 0 16px;
    }
    /* zoom hint inherits the rounded left corners of the panel */
    #cinematic-img-panel .plb-trigger-hint {
      border-radius: 16px 0 0 16px;
    }
    #cinematic-content.has-image #cinematic-img-panel {
      display: block;
    }
    #cinematic-img-panel img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 42%;
      display: block;
    }
    #cinematic-img-fade {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(
          to right,
          rgba(255, 190, 40, 0.07) 0%,
          transparent 50%,
          rgba(10, 15, 30, 0.82) 78%,
          rgba(10, 15, 30, 1) 100%
        ),
        linear-gradient(
          to bottom,
          rgba(0,0,0,0.28) 0%,
          transparent 22%,
          transparent 72%,
          rgba(0,0,0,0.58) 100%
        );
      pointer-events: none;
    }
    #cinematic-img-caption {
      position: absolute;
      bottom: 0.7rem;
      left: 0.75rem;
      font-size: 0.58rem;
      color: rgba(255,255,255,0.36);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      line-height: 1.4;
      pointer-events: none;
    }

    /* ── Content panel ───────────────────────────────────────────── */
    #cinematic-panel-body {
      flex: 1;
      min-width: 0;
      min-height: 0;
      padding: 1.6rem 1.8rem 1.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,229,204,0.15) transparent;
    }
    #cinematic-content.no-image #cinematic-panel-body {
      padding: 1.6rem 2rem 1.5rem 2rem;
    }

    /* Year badge */
    #cinematic-year-tag {
      display: none;
      align-self: flex-start;
      align-items: center;
      background: rgba(0, 229, 204, 0.09);
      border: 1px solid rgba(0, 229, 204, 0.22);
      color: #00e5cc;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 0.17rem 0.52rem;
      border-radius: 100px;
      margin-bottom: 0.6rem;
    }
    #cinematic-year-tag.visible {
      display: inline-flex;
    }

    /* Company name row: logo badge + name */
    #cinematic-company-row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      margin: 0 0 0.18rem 0;
      padding-right: 1.5rem;
    }
    #cinematic-logo-wrap {
      width: 34px;
      height: 34px;
      border-radius: 7px;
      background: #fff;
      flex-shrink: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 3px;
      overflow: hidden;
      box-shadow: 0 1px 6px rgba(0,0,0,0.35);
    }
    #cinematic-logo-wrap.visible {
      display: flex;
    }
    #cinematic-logo-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    #cinematic-company {
      font-size: 1.4rem;
      font-weight: 800;
      color: #fff;
      line-height: 1.15;
      margin: 0;
      letter-spacing: -0.015em;
    }

    /* Role */
    #cinematic-role {
      font-size: 0.88rem;
      font-weight: 500;
      color: rgba(255,255,255,0.68);
      margin: 0 0 0.15rem 0;
    }

    /* Period */
    #cinematic-period {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.32);
      font-style: italic;
      margin: 0 0 0.75rem 0;
    }

    /* Company context block */
    #cinematic-context {
      display: none;
      font-size: 0.75rem;
      color: rgba(255,255,255,0.5);
      line-height: 1.6;
      padding: 0.5rem 0.65rem;
      margin: 0 0 0.85rem 0;
      border-left: 2px solid rgba(0,229,204,0.28);
      background: rgba(0,229,204,0.04);
      border-radius: 0 6px 6px 0;
    }
    #cinematic-context.visible {
      display: block;
    }

    /* Separator */
    #cinematic-divider {
      height: 1px;
      background: linear-gradient(90deg, rgba(0,229,204,0.2) 0%, transparent 65%);
      margin-bottom: 0.85rem;
      flex-shrink: 0;
    }

    /* Description fallback */
    #cinematic-description-text {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.66);
      line-height: 1.62;
      margin: 0 0 0.75rem 0;
    }

    /* Bullets */
    #cinematic-bullets-list {
      list-style: none;
      padding: 0;
      margin: 0 0 0.6rem 0;
      flex: 1;
    }
    #cinematic-bullets-list li {
      padding: 0.27rem 0 0.27rem 1.2rem;
      position: relative;
      font-size: 0.79rem;
      color: rgba(255,255,255,0.75);
      line-height: 1.56;
    }
    #cinematic-bullets-list li::before {
      content: '▸';
      position: absolute;
      left: 0;
      color: #00e5cc;
    }

    /* ── Skills section ── */
    #cinematic-skills {
      display: none;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.75rem;
      margin-top: auto;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    #cinematic-skills.visible { display: flex; }
    #cinematic-skills-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.55);
    }
    #cinematic-skills-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    #cinematic-skills-chips span {
      padding: 0.22rem 0.62rem;
      background: rgba(0,229,204,0.06);
      border: 1px solid rgba(0,229,204,0.18);
      border-radius: 20px;
      font-size: 0.68rem;
      font-weight: 500;
      color: rgba(255,255,255,0.78);
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    #cinematic-skills-chips span:hover {
      background: rgba(0,229,204,0.13);
      border-color: rgba(0,229,204,0.4);
      color: #fff;
    }

    /* ── Responsive ──────────────────────────────────────────────── */
    @media (max-width: 600px) {
      #cinematic-content.has-image {
        flex-direction: column;
        max-width: calc(100% - 2rem);
      }
      #cinematic-card {
        flex-direction: column;
      }
      #cinematic-img-panel {
        width: 100% !important;
        min-width: unset !important;
        height: 160px;
        flex-shrink: 0;
      }
      #cinematic-img-fade {
        background: linear-gradient(
          to bottom,
          transparent 35%,
          rgba(10,15,30,0.85) 75%,
          rgba(10,15,30,1) 100%
        ) !important;
      }
      #cinematic-panel-body {
        padding: 1.2rem 1.4rem 1.3rem !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Overlay DOM ───────────────────────────────────────────────────────────────

function getOrCreateOverlay(): {
  overlay: HTMLDivElement;
  content: HTMLDivElement;
  card: HTMLDivElement;
} {
  if (overlayEl && contentEl && cardEl)
    return { overlay: overlayEl, content: contentEl, card: cardEl };

  injectStyles();
  injectHighlightStyles();

  const overlay = document.createElement("div");
  overlay.id = "cinematic-overlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  `;

  // Dim/blur backdrop
  const dimLayer = document.createElement("div");
  dimLayer.id = "cinematic-dim";
  dimLayer.style.cssText = `
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0);
    backdrop-filter: blur(0px);
    transition: background 0.5s ease-out, backdrop-filter 0.5s ease-out;
    pointer-events: auto;
    cursor: pointer;
  `;
  dimLayer.onclick = () => {
    if (isOpen && currentCamera) {
      const cam = currentCamera;
      currentCamera = null;
      const onClosedCb = currentOnClosed;
      const getReturn = currentGetReturnTarget;
      doClose(cam, getReturn);
      onClosedCb?.();
    }
  };
  overlay.appendChild(dimLayer);

  // Animation wrapper — translateY slide + opacity (no visual styles)
  const content = document.createElement("div");
  content.id = "cinematic-content";
  overlay.appendChild(content);

  // Visual card — all the styling + tilt effect lives here
  const card = document.createElement("div");
  card.id = "cinematic-card";
  card.innerHTML = `
    <div id="cinematic-top-bar"></div>
    <button id="cinematic-close" aria-label="Close">
      <span class="esc-key">ESC</span>
      <span>Close</span>
      <span class="close-x">&times;</span>
    </button>

    <div id="cinematic-img-panel">
      <img id="cinematic-img" src="" alt="" />
      <div id="cinematic-img-fade"></div>
      <div id="cinematic-img-caption"></div>
    </div>

    <div id="cinematic-panel-body">
      <div id="cinematic-year-tag"></div>
      <div id="cinematic-company-row">
        <div id="cinematic-logo-wrap"><img id="cinematic-logo-img" src="" alt="" /></div>
        <h2 id="cinematic-company"></h2>
      </div>
      <p id="cinematic-role"></p>
      <p id="cinematic-period"></p>
      <p id="cinematic-context"></p>
      <div id="cinematic-divider"></div>
      <p id="cinematic-description-text"></p>
      <ul id="cinematic-bullets-list"></ul>
      <div id="cinematic-skills">
        <div id="cinematic-skills-label">Tech Stack</div>
        <div id="cinematic-skills-chips"></div>
      </div>
    </div>
  `;
  content.appendChild(card);

  const backdropHint = document.createElement("div");
  backdropHint.id = "cinematic-backdrop-hint";
  backdropHint.textContent = "click backdrop to close";
  content.appendChild(backdropHint);

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && isOpen && currentCamera) {
      const cam = currentCamera;
      currentCamera = null;
      const onClosedCb = currentOnClosed;
      const getReturn = currentGetReturnTarget;
      doClose(cam, getReturn);
      onClosedCb?.();
    }
  });

  document.body.appendChild(overlay);
  overlayEl = overlay;
  contentEl = content;
  cardEl = card;

  initPhotoLightbox();

  // Attach tilt to the visual card (pointer-events auto via parent content)
  addTiltEffect(card, {
    maxRotation: 10,
    scale: 1.03,
    lerpFactor: 0.08,
    accentColor: "0, 229, 204",
  });

  return { overlay, content, card };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let currentCamera: THREE.PerspectiveCamera | null = null;
let currentOnClosed: (() => void) | undefined;
let currentGetReturnTarget:
  | (() => { position: THREE.Vector3; lookAt: THREE.Vector3 })
  | undefined;
let zoomLookTarget: THREE.Vector3 | null = null;

export function isTransitionOpen(): boolean {
  return isOpen || isTransitioning;
}

function parseTitleParts(title: string): {
  year: string;
  company: string;
  role: string;
} {
  const parts = title.split(" — ");
  if (parts.length >= 3) {
    return { year: parts[0], company: parts[1], role: parts.slice(2).join(" — ") };
  }
  if (parts.length === 2) {
    return { year: parts[0], company: parts[1], role: "" };
  }
  return { year: "", company: title, role: "" };
}

// ── Open / close ──────────────────────────────────────────────────────────────

export function openTransition(
  data: StopData,
  stopWorldPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  onClosed?: () => void,
  getCameraReturnTarget?: () => {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
  },
): void {
  if (isTransitioning || isOpen) return;
  isTransitioning = true;
  currentCamera = camera;
  currentOnClosed = onClosed;
  currentGetReturnTarget = getCameraReturnTarget;

  const { overlay, content, card } = getOrCreateOverlay();
  const dimLayer = overlay.querySelector("#cinematic-dim") as HTMLDivElement;

  const { year, company, role } = parseTitleParts(data.title);

  // ── Populate elements ──────────────────────────────────────────────────────

  const yearTagEl = card.querySelector("#cinematic-year-tag") as HTMLDivElement;
  const companyEl = card.querySelector("#cinematic-company") as HTMLHeadingElement;
  const roleEl = card.querySelector("#cinematic-role") as HTMLParagraphElement;
  const periodEl = card.querySelector("#cinematic-period") as HTMLParagraphElement;
  const dividerEl = card.querySelector("#cinematic-divider") as HTMLDivElement;
  const descEl = card.querySelector("#cinematic-description-text") as HTMLParagraphElement;
  const bulletsEl = card.querySelector("#cinematic-bullets-list") as HTMLUListElement;
  const skillsEl = card.querySelector("#cinematic-skills") as HTMLDivElement;
  const skillsChipsEl = card.querySelector("#cinematic-skills-chips") as HTMLDivElement;
  const imgEl = card.querySelector("#cinematic-img") as HTMLImageElement;
  const imgCaptionEl = card.querySelector("#cinematic-img-caption") as HTMLDivElement;
  const contextEl = card.querySelector("#cinematic-context") as HTMLParagraphElement;
  const logoWrap = card.querySelector("#cinematic-logo-wrap") as HTMLDivElement;
  const logoImg = card.querySelector("#cinematic-logo-img") as HTMLImageElement;

  if (year) {
    yearTagEl.textContent = year;
    yearTagEl.classList.add("visible");
  } else {
    yearTagEl.classList.remove("visible");
  }

  companyEl.textContent = company || data.title;

  if (data.logo) {
    logoImg.src = data.logo;
    logoImg.alt = company;
    logoWrap.classList.add("visible");
  } else {
    logoImg.src = "";
    logoWrap.classList.remove("visible");
  }

  if (role) {
    roleEl.textContent = role;
    roleEl.style.display = "block";
  } else {
    roleEl.style.display = "none";
  }

  if (data.subtitle) {
    periodEl.textContent = data.subtitle;
    periodEl.style.display = "block";
  } else {
    periodEl.style.display = "none";
  }

  if (data.companyContext) {
    contextEl.innerHTML = highlight(data.companyContext);
    contextEl.classList.add("visible");
  } else {
    contextEl.innerHTML = "";
    contextEl.classList.remove("visible");
  }

  const hasBelowContent = !!(data.bullets?.length || data.description);
  dividerEl.style.display = hasBelowContent ? "block" : "none";

  if (!data.bullets?.length && data.description) {
    descEl.textContent = data.description;
    descEl.style.display = "block";
  } else {
    descEl.style.display = "none";
  }

  if (data.bullets && data.bullets.length > 0) {
    bulletsEl.innerHTML = data.bullets.map((b) => `<li>${highlight(b)}</li>`).join("");
    bulletsEl.style.display = "block";
  } else {
    bulletsEl.innerHTML = "";
    bulletsEl.style.display = "none";
  }

  if (data.skills && data.skills.length > 0) {
    skillsChipsEl.innerHTML = data.skills
      .map((s) => `<span>${s}</span>`)
      .join("");
    skillsEl.classList.add("visible");
  } else {
    skillsChipsEl.innerHTML = "";
    skillsEl.classList.remove("visible");
  }

  // Detach any previous zoom hint before re-attaching
  detachImgZoom?.();
  detachImgZoom = null;

  const imgPanelEl = card.querySelector<HTMLDivElement>("#cinematic-img-panel")!;

  if (data.image) {
    imgEl.src = data.image;
    imgEl.alt = data.imageCaption ?? company;
    imgCaptionEl.textContent = data.imageCaption ?? "";
    content.classList.add("has-image");
    content.classList.remove("no-image");

    // Attach zoom-in lightbox to the image panel
    const captionText = data.imageCaption ?? company;
    detachImgZoom = attachZoomHint(
      imgPanelEl,
      () => data.image!,
      { shape: "rect", caption: captionText, hintSize: 22 },
    );
  } else {
    imgEl.src = "";
    content.classList.remove("has-image");
    content.classList.add("no-image");
  }

  // ── Animate in ────────────────────────────────────────────────────────────

  overlay.style.display = "flex";
  overlay.style.pointerEvents = "auto";
  document.body.classList.add("transition-open");
  content.style.transform = "translateY(40px)";
  content.style.opacity = "0";
  dimLayer.style.background = "rgba(0,0,0,0)";
  dimLayer.style.backdropFilter = "blur(0px)";

  const zoomTarget = new THREE.Vector3(
    stopWorldPos.x + 1.5,
    stopWorldPos.y + 5,
    stopWorldPos.z + 2,
  );
  const lookTarget = new THREE.Vector3(
    stopWorldPos.x,
    stopWorldPos.y + 0.5,
    stopWorldPos.z,
  );
  zoomLookTarget = lookTarget.clone();

  const startPos = camera.position.clone();
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const startTarget = camera.position.clone().add(camDir);
  const startTime = performance.now();

  function animateCamera(): void {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / DURATION_MS, 1);
    const eased = EASE_OUT(t);

    camera.position.lerpVectors(startPos, zoomTarget, eased);
    const currentLook = new THREE.Vector3().lerpVectors(
      startTarget,
      lookTarget,
      eased,
    );
    camera.lookAt(currentLook);

    if (t < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      isTransitioning = false;
      isOpen = true;
    }
  }

  requestAnimationFrame(animateCamera);

  requestAnimationFrame(() => {
    dimLayer.style.background = "rgba(0,0,0,0.68)";
    dimLayer.style.backdropFilter = "blur(10px)";
    content.style.transform = "translateY(0)";
    content.style.opacity = "1";
  });

  // Close handlers
  const handleClose = () => {
    if (!isOpen || !currentCamera) return;
    const cam = currentCamera;
    currentCamera = null;
    const onClosedCb = currentOnClosed;
    const getReturn = currentGetReturnTarget;
    doClose(cam, getReturn);
    onClosedCb?.();
  };

  const closeBtn = card.querySelector("#cinematic-close") as HTMLButtonElement;
  closeBtn.onclick = handleClose;

  overlay.onclick = (e) => {
    if (
      isOpen &&
      (e.target === overlay || (e.target as Element).id === "cinematic-dim")
    ) {
      handleClose();
    }
  };
}

function doClose(
  camera: THREE.PerspectiveCamera,
  getReturnTarget?: () => { position: THREE.Vector3; lookAt: THREE.Vector3 },
): void {
  if (!overlayEl || !contentEl) return;
  isOpen = false;
  isTransitioning = true;

  const dimLayer = overlayEl.querySelector("#cinematic-dim") as HTMLDivElement;

  dimLayer.style.background = "rgba(0,0,0,0)";
  dimLayer.style.backdropFilter = "blur(0px)";
  contentEl.style.transform = "translateY(20px)";
  contentEl.style.opacity = "0";

  const startPos = camera.position.clone();
  const target = getReturnTarget?.() ?? {
    position: HOME_POSITION.clone(),
    lookAt: HOME_TARGET.clone(),
  };
  const startTime = performance.now();

  function animateCameraBack(): void {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / DURATION_MS, 1);
    const eased = EASE_OUT(t);

    camera.position.lerpVectors(startPos, target.position, eased);
    const currentLook = new THREE.Vector3().lerpVectors(
      zoomLookTarget ?? target.lookAt,
      target.lookAt,
      eased,
    );
    camera.lookAt(currentLook);

    if (t < 1) {
      requestAnimationFrame(animateCameraBack);
    } else {
      isTransitioning = false;
      overlayEl!.style.display = "none";
      overlayEl!.style.pointerEvents = "none";
      document.body.classList.remove("transition-open");
    }
  }

  setTimeout(() => requestAnimationFrame(animateCameraBack), 150);
}
