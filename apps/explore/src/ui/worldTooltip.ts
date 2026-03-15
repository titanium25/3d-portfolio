import * as THREE from "three";
import { isDiscovered } from "./discoveryTracker";
import { playDiscoveryMotes } from "./gateUnlockAnimation";

/* ══════════════════════════════════════════════════════════════════════
 *  World Tooltip System
 *  ─────────────────────────────────────────────────────────────────────
 *  Displays a styled tooltip above 3D objects when the user hovers
 *  over them with the mouse. Raycasting is throttled to 120 ms for
 *  performance; tooltip positioning updates every frame for smooth
 *  tracking.
 * ══════════════════════════════════════════════════════════════════════ */

export interface TooltipTarget {
  /** The Three.js Object3D (or Group) to raycast against. */
  object: THREE.Object3D;
  /** Title line — bold, white. */
  title: string;
  /** Subtitle line — muted, smaller. */
  subtitle: string;
  /** Optional callback fired when hover begins (use for reactive FX). */
  onHoverStart?: () => void;
  /** Optional callback fired when hover ends. */
  onHoverEnd?: () => void;
  /**
   * Optional callback fired when the user clicks on this object.
   * Pair with discoveryId to drive the discovery reward system.
   */
  onClick?: () => void;
  /**
   * If set, the tooltip shows a "Click to discover →" hint when this ID
   * has not yet been discovered. The hint disappears once discovered.
   */
  discoveryId?: string;
  /**
   * Vertical offset in world units above the object's world origin
   * to place the tooltip screen anchor.  Default: 0.5
   */
  yOffset?: number;
}

interface TooltipTargetInternal extends TooltipTarget {
  /** Pre-computed flat list of leaf Meshes for fast raycasting. */
  meshes: THREE.Mesh[];
}

/* ── Module-level state ──────────────────────────────────────────────── */

let tooltipEl: HTMLDivElement | null = null;
let titleEl: HTMLDivElement | null = null;
let subEl: HTMLDivElement | null = null;
let hintEl: HTMLDivElement | null = null;

const targets: TooltipTargetInternal[] = [];

/** Flat list of all leaf meshes across all targets — rebuilt on registration. */
let allMeshes: THREE.Mesh[] = [];

/** Maps each leaf mesh back to its registered target for O(1) lookup. */
const meshToTarget = new Map<THREE.Mesh, TooltipTargetInternal>();

let currentTarget: TooltipTargetInternal | null = null;
let enabled = true;
let lastRaycastTime = 0;
let domListenerAttached = false;

const RAYCAST_INTERVAL = 120; // ms between ray tests
const MAX_HOVER_DISTANCE = 20; // world units — don't show tooltip beyond this

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-999, -999); // start offscreen
const tempVec = new THREE.Vector3();

/* ── Helpers ─────────────────────────────────────────────────────────── */

function rebuildMeshList(): void {
  allMeshes = [];
  meshToTarget.clear();
  for (const t of targets) {
    for (const m of t.meshes) {
      allMeshes.push(m);
      meshToTarget.set(m, t);
    }
  }
}

function hideTip(domEl?: HTMLCanvasElement): void {
  if (tooltipEl) {
    tooltipEl.classList.remove("visible", "has-hint", "has-nav-hint");
  }
  if (currentTarget) {
    currentTarget.onHoverEnd?.();
    currentTarget = null;
  }
  if (domEl) domEl.style.cursor = "";
}

/** Returns true when a modal overlay (transition or CV panel) is open. */
function isOverlayOpen(): boolean {
  return (
    document.body.classList.contains("transition-open") ||
    !!document.querySelector("#cv-overlay.cv-visible")
  );
}

/* ── Public API ──────────────────────────────────────────────────────── */

/** Call once at setup to create the tooltip DOM element and inject styles. */
export function initWorldTooltip(): void {
  if (tooltipEl) return;

  if (!document.getElementById("wt-styles")) {
    const s = document.createElement("style");
    s.id = "wt-styles";
    s.textContent = `
#world-tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 1500;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.45rem 0.75rem 0.4rem;
  background: rgba(10, 14, 20, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 229, 204, 0.18);
  border-left: 2.5px solid rgba(0, 229, 204, 0.5);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(0,229,204,0.06);
  transform: translate(-50%, -100%) translateY(-8px);
  opacity: 0;
  transition: opacity 0.15s ease;
  white-space: nowrap;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
#world-tooltip.visible { opacity: 1; }
#world-tooltip .wt-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.01em;
}
#world-tooltip .wt-sub {
  font-size: 0.62rem;
  font-weight: 500;
  color: rgba(255,255,255,0.4);
}
#world-tooltip .wt-hint {
  font-size: 0.54rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  margin-top: 0.18rem;
  display: none;
  transition: color 0.2s ease;
}
/* Undiscovered — action hint (cyan) */
#world-tooltip.has-hint .wt-hint {
  display: block;
  color: rgba(0,229,204,0.8);
}
/* Discovered — navigation hint (warm amber, draws eye toward Resume) */
#world-tooltip.has-nav-hint .wt-hint {
  display: block;
  color: rgba(251,191,36,0.8);
  animation: wtHintPulse 2.2s ease-in-out infinite;
}
@keyframes wtHintPulse {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
}
#world-tooltip .wt-caret {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid rgba(10, 14, 20, 0.9);
}
    `.trim();
    document.head.appendChild(s);
  }

  tooltipEl = document.createElement("div");
  tooltipEl.id = "world-tooltip";

  titleEl = document.createElement("div");
  titleEl.className = "wt-title";

  subEl = document.createElement("div");
  subEl.className = "wt-sub";

  const caret = document.createElement("div");
  caret.className = "wt-caret";

  hintEl = document.createElement("div");
  hintEl.className = "wt-hint";
  hintEl.textContent = "Click to discover →";

  tooltipEl.appendChild(titleEl);
  tooltipEl.appendChild(subEl);
  tooltipEl.appendChild(hintEl);
  tooltipEl.appendChild(caret);
  document.body.appendChild(tooltipEl);
}

/** Register a 3D object as hoverable. Safe to call at any time (even async). */
export function registerTooltipTarget(target: TooltipTarget): void {
  const meshes: THREE.Mesh[] = [];
  target.object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshes.push(child as THREE.Mesh);
    }
  });

  targets.push({ ...target, meshes });
  rebuildMeshList();
}

function refreshHint(target: TooltipTargetInternal): void {
  if (!tooltipEl || !hintEl) return;
  const hasId = !!target.discoveryId;
  const found = hasId && isDiscovered(target.discoveryId!);
  const notFound = hasId && !found;

  tooltipEl.classList.toggle("has-hint",     notFound);
  tooltipEl.classList.toggle("has-nav-hint", found);

  if (notFound) {
    hintEl.textContent = "Click to discover →";
  } else if (found) {
    hintEl.textContent = "✦ Photos in Resume → About tab";
  }
}

/**
 * Call every frame from the animation loop.
 * Raycasting is throttled internally; only positioning runs every frame.
 */
export function updateWorldTooltip(
  camera: THREE.Camera,
  domElement: HTMLCanvasElement,
): void {
  if (!tooltipEl) return;

  // Lazily attach mouse listeners to the canvas
  if (!domListenerAttached) {
    domElement.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    domElement.addEventListener("mouseleave", () => {
      mouse.set(-999, -999);
    });
    domElement.addEventListener("click", () => {
      if (!enabled || isOverlayOpen()) return;
      if (currentTarget?.onClick) {
        // Detect first-time discovery by checking state before and after
        const wasDiscovered = currentTarget.discoveryId
          ? isDiscovered(currentTarget.discoveryId)
          : true;

        currentTarget.onClick();

        const nowDiscovered = currentTarget.discoveryId
          ? isDiscovered(currentTarget.discoveryId)
          : false;

        // First-time discovery — fire motes from tooltip screen position
        if (!wasDiscovered && nowDiscovered && tooltipEl) {
          const sx = parseFloat(tooltipEl.style.left || "0");
          const sy = parseFloat(tooltipEl.style.top  || "0");
          playDiscoveryMotes(sx, sy);
        }

        refreshHint(currentTarget);
      }
    });
    domListenerAttached = true;
  }

  // Auto-hide when any overlay is open or tooltips are disabled
  if (!enabled || isOverlayOpen()) {
    hideTip();
    return;
  }

  if (allMeshes.length === 0) return;

  // Throttled raycast
  const now = performance.now();
  if (now - lastRaycastTime >= RAYCAST_INTERVAL) {
    lastRaycastTime = now;

    raycaster.setFromCamera(mouse, camera);
    // Pass false for recursive — allMeshes already contains all leaf meshes
    const hits = raycaster.intersectObjects(allMeshes, false);

    let hitTarget: TooltipTargetInternal | null = null;
    if (hits.length > 0) {
      const mesh = hits[0].object as THREE.Mesh;
      hitTarget = meshToTarget.get(mesh) ?? null;

      if (hitTarget) {
        hitTarget.object.getWorldPosition(tempVec);
        if (camera.position.distanceTo(tempVec) > MAX_HOVER_DISTANCE) {
          hitTarget = null;
        }
      }
    }

    if (hitTarget !== currentTarget) {
      if (currentTarget) {
        currentTarget.onHoverEnd?.();
        domElement.style.cursor = "";
      }
      if (hitTarget) {
        hitTarget.onHoverStart?.();
        if (titleEl) titleEl.textContent = hitTarget.title;
        if (subEl) subEl.textContent = hitTarget.subtitle;
        refreshHint(hitTarget);
        if (hitTarget.onClick) domElement.style.cursor = "pointer";
      }
      currentTarget = hitTarget;
    } else if (currentTarget?.discoveryId) {
      // Refresh hint each raycast cycle in case discovery state just changed
      refreshHint(currentTarget);
    }
  }

  // Position every frame for smooth tracking
  if (currentTarget) {
    currentTarget.object.getWorldPosition(tempVec);
    tempVec.y += currentTarget.yOffset ?? 0.5;
    tempVec.project(camera);

    const screenX = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

    // Hide if the projected point is off-screen
    if (
      screenX < 0 ||
      screenX > window.innerWidth ||
      screenY < 0 ||
      screenY > window.innerHeight
    ) {
      hideTip();
      return;
    }

    tooltipEl.style.left = `${screenX}px`;
    tooltipEl.style.top = `${screenY}px`;
    tooltipEl.classList.add("visible");
  } else {
    tooltipEl.classList.remove("visible");
  }
}

/** Explicitly enable or disable the tooltip system (e.g., during cutscenes). */
export function setTooltipsEnabled(value: boolean): void {
  enabled = value;
  if (!value) hideTip();
}
