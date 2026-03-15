/**
 * mobileTapHint.ts
 *
 * On touch devices, shows a floating "TAP" pill above the nearest undiscovered
 * 3D object when the player walks into its proximity beacon range.
 *
 * Replaces the desktop hover tooltip for mobile, bridging the discoverability
 * gap when users can't hover to see the tooltip.
 */

import * as THREE from "three";
import { isTouchDevice } from "./mobileControls";
import { isDiscovered } from "./discoveryTracker";
import { getDiscoverableBeaconInfos } from "../scene/discoverableGlow";

// Must match PROX_RANGE in discoverableGlow.ts
const PROX_RANGE = 5.0;

let hintEl: HTMLDivElement | null = null;
const _wPos = new THREE.Vector3();

export function initMobileTapHint(): void {
  if (!isTouchDevice()) return;

  const s = document.createElement("style");
  s.id = "mobile-tap-hint-styles";
  s.textContent = `
    #mobile-tap-hint {
      position: fixed;
      pointer-events: none;
      z-index: 850;
      transform: translate(-50%, calc(-100% - 8px));
      opacity: 0;
      transition: opacity 0.25s ease;
      will-change: opacity;
    }
    #mobile-tap-hint.mth-visible {
      opacity: 1;
    }
    #mobile-tap-hint-pill {
      display: inline-block;
      padding: 0.22rem 0.65rem;
      background: rgba(0, 229, 204, 0.1);
      border: 1px solid rgba(0, 229, 204, 0.5);
      border-radius: 20px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.56rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: rgba(0, 229, 204, 0.95);
      text-transform: uppercase;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      box-shadow: 0 0 12px rgba(0, 229, 204, 0.15);
      animation: mthBounce 1.5s ease-in-out infinite;
    }
    @keyframes mthBounce {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-5px); }
    }
  `;
  document.head.appendChild(s);

  hintEl = document.createElement("div");
  hintEl.id = "mobile-tap-hint";
  hintEl.innerHTML = `<span id="mobile-tap-hint-pill">TAP</span>`;
  document.body.appendChild(hintEl);
}

export function updateMobileTapHint(
  camera: THREE.Camera,
  playerPosition: THREE.Vector3,
  domElement: HTMLCanvasElement,
): void {
  if (!hintEl) return;

  const beacons = getDiscoverableBeaconInfos();

  // Find nearest undiscovered beacon within proximity range
  let nearestDist = Infinity;
  let nearestObject: THREE.Object3D | null = null;

  for (const b of beacons) {
    if (isDiscovered(b.discoveryId)) continue;
    b.object.getWorldPosition(_wPos);
    const dist = _wPos.distanceTo(playerPosition);
    if (dist < PROX_RANGE && dist < nearestDist) {
      nearestDist = dist;
      nearestObject = b.object;
    }
  }

  if (!nearestObject) {
    hintEl.classList.remove("mth-visible");
    return;
  }

  // Project world position (elevated above object) to screen space
  nearestObject.getWorldPosition(_wPos);
  _wPos.y += 1.2;
  const projected = _wPos.clone().project(camera);

  // Hide if behind camera
  if (projected.z > 1) {
    hintEl.classList.remove("mth-visible");
    return;
  }

  const rect = domElement.getBoundingClientRect();
  const screenX = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
  const screenY = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;

  hintEl.style.left = `${screenX}px`;
  hintEl.style.top = `${screenY}px`;
  hintEl.classList.add("mth-visible");
}
