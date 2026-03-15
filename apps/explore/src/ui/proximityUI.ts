import * as THREE from "three";
import type { StopData } from "../scene/types";
import type { PerspectiveCamera } from "three";
import {
  PROXIMITY_RADIUS,
  INTERACT_RADIUS,
} from "../collision/checkCollisions";

const LABEL_OFFSET_Y = 2.2;

let containerEl: HTMLDivElement | null = null;

function getOrCreateContainer(): HTMLDivElement {
  if (containerEl) return containerEl;

  const el = document.createElement("div");
  el.id = "proximity-ui";
  el.style.cssText = `
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) scale(0.85);
    z-index: 500;
    background: rgba(45, 53, 97, 0.92);
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    color: #fff;
    font-family: system-ui, sans-serif;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.12);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
    white-space: nowrap;
  `;

  el.innerHTML = `
    <div id="proximity-label" style="font-weight: 600; font-size: 0.95rem;"></div>
    <div id="proximity-hint" style="font-size: 0.7rem; margin-top: 0.35rem; color: #4ecdc4; letter-spacing: 0.5px;"></div>
  `;

  document.body.appendChild(el);
  containerEl = el;
  return el;
}

function worldToScreen(
  worldPos: THREE.Vector3,
  camera: PerspectiveCamera,
): { x: number; y: number } | null {
  const projected = worldPos.clone().project(camera);
  if (projected.z > 1 || projected.z < -1) return null;
  const x = (projected.x + 1) * 0.5 * window.innerWidth;
  const y = (1 - projected.y) * 0.5 * window.innerHeight;
  return { x, y };
}

export function updateProximityUI(
  data: StopData,
  stopGroup: THREE.Group,
  distance: number,
  camera: PerspectiveCamera,
): void {
  const el = getOrCreateContainer();
  const worldPos = new THREE.Vector3();
  stopGroup.getWorldPosition(worldPos);
  worldPos.y += LABEL_OFFSET_Y;

  const screen = worldToScreen(worldPos, camera);
  if (!screen) {
    el.style.opacity = "0";
    el.style.display = "none";
    return;
  }

  (el.querySelector("#proximity-label") as HTMLElement).textContent =
    data.title;
  (el.querySelector("#proximity-hint") as HTMLElement).textContent =
    "Press E to enter";

  el.style.left = `${screen.x}px`;
  el.style.top = `${screen.y}px`;
  el.style.display = "block";

  const t =
    1 - (distance - INTERACT_RADIUS) / (PROXIMITY_RADIUS - INTERACT_RADIUS);
  const opacity = Math.max(0, Math.min(1, t * 1.2));
  const scale = 0.88 + opacity * 0.12;

  el.style.opacity = String(opacity);
  el.style.transform = `translate(-50%, -100%) scale(${scale})`;
}

export function showProximity(_data: StopData): void {
  getOrCreateContainer();
}

export function hideProximity(): void {
  if (containerEl) {
    containerEl.style.opacity = "0";
    containerEl.style.transform = "translate(-50%, -100%) scale(0.9)";
    containerEl.style.display = "none";
  }
}
