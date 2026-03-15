/**
 * perfDiagnostics.ts
 *
 * Logs a one-time performance snapshot to the console on the first rendered frame.
 * Counts all lights in the scene, logs renderer.info stats, and reports render resolution.
 *
 * Usage: call `logPerfDiagnostics(renderer, scene)` inside the animate loop,
 * gated with the `logged` guard so it only fires once.
 */

import * as THREE from "three";
import { isMobile } from "./mobileDetect";

let logged = false;

export function logPerfDiagnostics(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): void {
  if (logged) return;
  logged = true;

  // Wait one frame so renderer.info is populated
  requestAnimationFrame(() => {
    const ri = renderer.info;
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const dpr = renderer.getPixelRatio();

    // Count all light types in the scene
    let pointLights = 0;
    let dirLights = 0;
    let spotLights = 0;
    let hemiLights = 0;
    let ambientLights = 0;

    scene.traverse((obj) => {
      if (obj instanceof THREE.PointLight)     pointLights++;
      else if (obj instanceof THREE.DirectionalLight) dirLights++;
      else if (obj instanceof THREE.SpotLight)       spotLights++;
      else if (obj instanceof THREE.HemisphereLight) hemiLights++;
      else if (obj instanceof THREE.AmbientLight)    ambientLights++;
    });

    const renderW = Math.round(size.width  * dpr);
    const renderH = Math.round(size.height * dpr);
    const megapixels = ((renderW * renderH) / 1_000_000).toFixed(2);

    const lines = [
      `%c── PERF DIAGNOSTICS ──────────────────────────────────`,
      `%c  Platform:      ${isMobile ? "📱 MOBILE" : "🖥  desktop"}`,
      `%c  CSS viewport:  ${size.width}×${size.height}`,
      `%c  Pixel ratio:   ${dpr}`,
      `%c  Render size:   ${renderW}×${renderH} (${megapixels}MP)`,
      `%c  ─`,
      `%c  Draw calls:    ${ri.render.calls}`,
      `%c  Triangles:     ${ri.render.triangles.toLocaleString()}`,
      `%c  Geometries:    ${ri.memory.geometries}`,
      `%c  Textures:      ${ri.memory.textures}`,
      `%c  ─`,
      `%c  PointLights:   ${pointLights}  ⚠ each evaluates in every fragment shader`,
      `%c  DirLights:     ${dirLights}`,
      `%c  HemiLights:    ${hemiLights}`,
      `%c  AmbientLights: ${ambientLights}`,
      `%c  SpotLights:    ${spotLights}`,
      `%c────────────────────────────────────────────────────────`,
    ];

    const style  = "color:#00e5cc;font-family:monospace";
    const normal = "color:#aaa;font-family:monospace";
    const warn   = pointLights > 12 ? "color:#ff9944;font-family:monospace;font-weight:bold" : normal;

    console.groupCollapsed("%c[3D Portfolio] Performance Diagnostics", style);
    console.log(lines[0],  style);
    console.log(lines[1],  normal);
    console.log(lines[2],  normal);
    console.log(lines[3],  normal);
    console.log(lines[4],  normal);
    console.log(lines[5],  normal);
    console.log(lines[6],  normal);
    console.log(lines[7],  normal);
    console.log(lines[8],  normal);
    console.log(lines[9],  normal);
    console.log(lines[10], normal);
    console.log(lines[11], warn);
    console.log(lines[12], normal);
    console.log(lines[13], normal);
    console.log(lines[14], normal);
    console.log(lines[15], normal);
    console.log(lines[16], style);
    console.groupEnd();
  });
}

/**
 * Call after a GLB model finishes loading to log its triangle count.
 * Helps identify high-poly models that inflate vertex shader cost.
 */
export function logModelTriangles(model: THREE.Object3D, label: string): void {
  let tris = 0;
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry;
    if (geo.index) {
      tris += geo.index.count / 3;
    } else if (geo.attributes.position) {
      tris += geo.attributes.position.count / 3;
    }
  });
  const color = tris > 50_000 ? "color:#ff9944" : "color:#7cf8a4";
  console.log(`%c[Mesh] ${label}: ${tris.toLocaleString()} triangles`, `${color};font-family:monospace`);
}
