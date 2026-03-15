/**
 * Shared texture creation utilities for ground, spawn pad, and timeline.
 */

import * as THREE from "three";

/** Procedural noise roughness map for PBR materials. */
export function createNoiseRoughnessMap(
  resolution: number,
  baseRoughness: number,
  variation: number,
  tileRepeat: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(resolution, resolution);
  const d = imageData.data;

  const coarseSize = 8;
  const coarseGrid: number[] = [];
  const coarseDim = Math.ceil(resolution / coarseSize);
  for (let i = 0; i < coarseDim * coarseDim; i++) {
    coarseGrid[i] = (Math.random() - 0.5) * variation * 1.4;
  }

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const gx = x / coarseSize;
      const gy = y / coarseSize;
      const gx0 = Math.floor(gx) % coarseDim;
      const gy0 = Math.floor(gy) % coarseDim;
      const gx1 = (gx0 + 1) % coarseDim;
      const gy1 = (gy0 + 1) % coarseDim;
      const fx = gx - Math.floor(gx);
      const fy = gy - Math.floor(gy);

      const c00 = coarseGrid[gy0 * coarseDim + gx0];
      const c10 = coarseGrid[gy0 * coarseDim + gx1];
      const c01 = coarseGrid[gy1 * coarseDim + gx0];
      const c11 = coarseGrid[gy1 * coarseDim + gx1];
      const coarseVal =
        c00 * (1 - fx) * (1 - fy) +
        c10 * fx * (1 - fy) +
        c01 * (1 - fx) * fy +
        c11 * fx * fy;

      const fineVal = (Math.random() - 0.5) * variation * 0.4;

      const v =
        Math.max(0, Math.min(1, baseRoughness + coarseVal + fineVal)) * 255;
      const idx = (y * resolution + x) * 4;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(tileRepeat, tileRepeat);
  return texture;
}

export interface RadialGlowOptions {
  size?: number;
  r?: number;
  g?: number;
  b?: number;
  peakAlpha?: number;
  /** Alternative: color stops for custom gradient (overrides r,g,b,peakAlpha). */
  colorStops?: Array<{ offset: number; color: string }>;
}

/** Radial gradient glow texture. Defaults: white, alpha 0.32. */
export function createRadialGlowTexture(
  options: RadialGlowOptions = {},
): THREE.CanvasTexture {
  const size = options.size ?? 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);

  if (options.colorStops) {
    for (const { offset, color } of options.colorStops) {
      grad.addColorStop(offset, color);
    }
  } else {
    const r = options.r ?? 0;
    const g = options.g ?? 229;
    const b = options.b ?? 204;
    const peakAlpha = options.peakAlpha ?? 0.32;
    grad.addColorStop(0, `rgba(${r},${g},${b},${peakAlpha})`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},${peakAlpha * 0.35})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

/** Dot texture for particle systems (PointsMaterial). */
export function createDotTexture(size: number = 32): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
