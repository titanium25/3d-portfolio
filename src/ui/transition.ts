import * as THREE from "three";
import type { StopData } from "../scene/types";

const DURATION_MS = 700;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

const HOME_POSITION = new THREE.Vector3(6, 6, 10);
const HOME_TARGET = new THREE.Vector3(0, 0.5, 0);

let overlayEl: HTMLDivElement | null = null;
let contentEl: HTMLDivElement | null = null;
let isTransitioning = false;
let isOpen = false;

function getOrCreateOverlay(): {
  overlay: HTMLDivElement;
  content: HTMLDivElement;
} {
  if (overlayEl && contentEl) return { overlay: overlayEl, content: contentEl };

  const overlay = document.createElement("div");
  overlay.id = "cinematic-overlay";
  overlay.innerHTML = `
    <div id="cinematic-content">
      <button id="cinematic-close">&times;</button>
      <h2 id="cinematic-title"></h2>
      <p id="cinematic-subtitle"></p>
      <p id="cinematic-description"></p>
      <ul id="cinematic-bullets"></ul>
      <div id="cinematic-links"></div>
    </div>
  `;

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  `;

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
  overlay.insertBefore(dimLayer, overlay.firstChild);

  const content = overlay.querySelector("#cinematic-content") as HTMLDivElement;
  content.style.cssText = `
    background: #2d3561;
    padding: 1.5rem 2rem;
    border-radius: 12px;
    max-width: 420px;
    position: relative;
    color: #fff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    transform: translateY(40px);
    opacity: 0;
    transition: transform 0.5s ease-out 0.2s, opacity 0.5s ease-out 0.2s;
    pointer-events: auto;
  `;

  const closeBtn = overlay.querySelector(
    "#cinematic-close",
  ) as HTMLButtonElement;
  closeBtn.style.cssText = `
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    background: none;
    border: none;
    color: #4ecdc4;
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
  `;

  const subtitleStyle = overlay.querySelector(
    "#cinematic-subtitle",
  ) as HTMLParagraphElement;
  subtitleStyle.style.cssText = `
    color: rgba(255,255,255,0.5);
    font-style: italic;
    font-size: 0.85rem;
    margin: 0.25rem 0 0 0;
    display: none;
  `;

  const bulletsStyle = overlay.querySelector(
    "#cinematic-bullets",
  ) as HTMLUListElement;
  bulletsStyle.style.cssText = `
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 0 0;
    display: none;
  `;

  const linksStyle = overlay.querySelector(
    "#cinematic-links",
  ) as HTMLDivElement;
  linksStyle.style.cssText = `
    display: none;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.75rem;
  `;

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
  return { overlay, content };
}

let currentCamera: THREE.PerspectiveCamera | null = null;
let currentOnClosed: (() => void) | undefined;
let currentGetReturnTarget:
  | (() => { position: THREE.Vector3; lookAt: THREE.Vector3 })
  | undefined;
let zoomLookTarget: THREE.Vector3 | null = null;

export function isTransitionOpen(): boolean {
  return isOpen || isTransitioning;
}

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

  const { overlay, content } = getOrCreateOverlay();
  const dimLayer = overlay.querySelector("#cinematic-dim") as HTMLDivElement;
  const title = overlay.querySelector("#cinematic-title") as HTMLHeadingElement;
  const desc = overlay.querySelector(
    "#cinematic-description",
  ) as HTMLParagraphElement;

  title.textContent = data.title;

  const subtitleEl = overlay.querySelector(
    "#cinematic-subtitle",
  ) as HTMLParagraphElement;
  const bulletsEl = overlay.querySelector(
    "#cinematic-bullets",
  ) as HTMLUListElement;
  const linksEl = overlay.querySelector(
    "#cinematic-links",
  ) as HTMLDivElement;

  if (data.subtitle) {
    subtitleEl.textContent = data.subtitle;
    subtitleEl.style.display = "block";
    desc.style.display = "none";
  } else {
    subtitleEl.style.display = "none";
    desc.textContent = data.description;
    desc.style.display = "block";
  }

  if (data.bullets && data.bullets.length > 0) {
    bulletsEl.innerHTML = data.bullets
      .map(
        (b) =>
          `<li style="padding:0.3rem 0 0.3rem 1.1rem;position:relative;font-size:0.82rem;color:rgba(255,255,255,0.82);line-height:1.55"><span style="position:absolute;left:0;color:#00e5cc">▸</span>${b}</li>`,
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
          `<a href="${l.url}" target="_blank" rel="noopener" style="display:inline-block;padding:0.35rem 0.75rem;background:rgba(0,229,204,0.08);border:1px solid rgba(0,229,204,0.25);border-radius:6px;color:#00e5cc;text-decoration:none;font-size:0.75rem;transition:background 0.2s">${l.label}</a>`,
      )
      .join("");
    linksEl.style.display = "flex";
  } else {
    linksEl.innerHTML = "";
    linksEl.style.display = "none";
  }

  overlay.style.display = "flex";
  overlay.style.pointerEvents = "auto";
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
  const startTarget = new THREE.Vector3();
  camera.getWorldDirection(new THREE.Vector3(0, 0, -1));
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  startTarget.copy(camera.position).add(camDir);

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
    dimLayer.style.background = "rgba(0,0,0,0.65)";
    dimLayer.style.backdropFilter = "blur(10px)";
    content.style.transform = "translateY(0)";
    content.style.opacity = "1";
  });

  const handleClose = () => {
    if (!isOpen || !currentCamera) return;
    const cam = currentCamera;
    currentCamera = null;
    const onClosedCb = currentOnClosed;
    const getReturn = currentGetReturnTarget;
    doClose(cam, getReturn);
    onClosedCb?.();
  };

  const closeBtn = overlay.querySelector(
    "#cinematic-close",
  ) as HTMLButtonElement;
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
    }
  }

  setTimeout(() => requestAnimationFrame(animateCameraBack), 150);
}
