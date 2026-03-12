import * as THREE from "three";
import type { Scene } from "three";
import { ARENA_SIZE, ARENA_SIDES } from "./layoutConstants";
import {
  createHexShape,
  createHexPath,
  hexVertex,
} from "./hexUtils";
import {
  createNoiseRoughnessMap,
  createRadialGlowTexture,
  createDotTexture,
} from "./textureUtils";

/* ══════════════════════════════════════════════════════════════
 *  FLOATING HUB PLATFORM
 *  ──────────────────────────────────────────────────────────
 *  A hexagonal megastructure floating in the void.  Layered
 *  surfaces, an elevated center hub, energy-barrier edges,
 *  void cascade glow, and ambient particles create a sense
 *  of place rather than a flat test room.
 * ═══════════════════════════════════════════════════════════ */

const SIZE = ARENA_SIZE;
const SIDES = ARENA_SIDES;

/* ── Platform constants ─────────────────────────────────────── */

const PLATFORM_DEPTH = 0.3; /* 1/5 of original 1.5 */
const BEVEL_SIZE = 0.25;
const BEVEL_THICKNESS = 0.15;
const BEVEL_SEGMENTS = 3;

const RIM_INSET = 0.35;
const RIM_WIDTH = 0.1;
const RIM_HEIGHT = 0.07;
const RIM_BEVEL = 0.018;
const RIM_BEVEL_SEGMENTS = 2;

const INNER_RADIUS = SIZE - RIM_INSET - RIM_WIDTH;
const INNER_SCALE = INNER_RADIUS / SIZE;

const UNDERGLOW_OFFSET = 0.4;
const PANEL_RINGS = [0.38, 0.68];


/* ── Center Hub ────────────────────────────────────────────── */

const HUB_RADIUS = 3.0;
const HUB_HEIGHT = 0.035;
const HUB_SIDES = 5; // Pentagon to match map polygonal style
const HUB_RING_RADII = [1.0, 1.8, 2.6];

/* ── Edge effects ──────────────────────────────────────────── */

const BARRIER_HEIGHT = 0.6;
const VOID_CASCADE_HEIGHT = 2.0;
const PARTICLE_COUNT = 80;

/* ── Palette ───────────────────────────────────────────────── */

const COL_BASE = 0x7b8fa3;
const COL_FLOOR = 0x1f2b38;
const COL_ACCENT = 0x00e5cc;
const COL_HUB = 0x263a4a;

/* ── Return type ───────────────────────────────────────────── */

export interface GroundContext {
  group: THREE.Group;
  update(time: number): void;
  /** AL monogram mesh on the arena hub floor (synchronously available). */
  monogramMesh: THREE.Mesh;
}

/* ── Geometry helpers (hub pentagon uses point-up orientation) ── */

function polygonVertex(i: number, sides: number, radius: number): [number, number] {
  const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function createPolygonShape(radius: number, sides: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const [x, z] = polygonVertex(i, sides, radius);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

function toWorld(sx: number, sy: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(sx, y, -sy);
}

/* ═══════════════════════════════════════════════════════════════
 *  Build the floating megastructure hub
 * ═════════════════════════════════════════════════════════════ */

export function createGround(scene: Scene): GroundContext {
  const group = new THREE.Group();

  /* ── Materials ─────────────────────────────────────────────── */

  const baseRoughnessMap = createNoiseRoughnessMap(128, 0.78, 0.10, 3);
  const floorRoughnessMap = createNoiseRoughnessMap(128, 0.85, 0.08, 4);

  const baseMat = new THREE.MeshStandardMaterial({
    color: COL_BASE,
    roughness: 1.0,
    roughnessMap: baseRoughnessMap,
    metalness: 0.10,
    envMapIntensity: 0.5,
  });

  const floorMat = new THREE.MeshStandardMaterial({
    color: COL_FLOOR,
    roughness: 1.0,
    roughnessMap: floorRoughnessMap,
    metalness: 0.08,
    envMapIntensity: 0.5,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x061215,
    emissive: COL_ACCENT,
    emissiveIntensity: 0.6,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const hubMat = new THREE.MeshStandardMaterial({
    color: COL_HUB,
    roughness: 1.0,
    roughnessMap: floorRoughnessMap,
    metalness: 0.10,
    envMapIntensity: 0.5,
  });

  const hubAoLoader = new THREE.TextureLoader();
  hubAoLoader.load(
    "/textures/MetalPlates017A_1K-JPG_AmbientOcclusion.jpg",
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2.5, 2.5);
      hubMat.aoMap = tex;
      hubMat.aoMapIntensity = 1.0;
      hubMat.needsUpdate = true;
    },
  );

  /* ──────────────────────────────────────────────────────────
   * 1. Platform body — thick slab with beveled edges
   * ────────────────────────────────────────────────────────── */

  const bodyShape = createHexShape(SIZE, SIDES);
  bodyShape.holes.push(createHexPath(INNER_RADIUS, SIDES));

  const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, {
    depth: PLATFORM_DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    bevelSegments: BEVEL_SEGMENTS,
  });
  bodyGeom.rotateX(-Math.PI / 2);
  bodyGeom.translate(0, -PLATFORM_DEPTH, 0);
  bodyGeom.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeom, baseMat);
  bodyMesh.receiveShadow = true;
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  /* ──────────────────────────────────────────────────────────
   * 2. Raised rim ring
   * ────────────────────────────────────────────────────────── */

  const rimOuterRadius = SIZE - RIM_INSET;
  const rimInnerRadius = INNER_RADIUS;

  const rimShape = createHexShape(rimOuterRadius, SIDES);
  rimShape.holes.push(createHexPath(rimInnerRadius, SIDES));

  const rimGeom = new THREE.ExtrudeGeometry(rimShape, {
    depth: RIM_HEIGHT,
    bevelEnabled: true,
    bevelThickness: RIM_BEVEL,
    bevelSize: RIM_BEVEL,
    bevelSegments: RIM_BEVEL_SEGMENTS,
  });
  rimGeom.rotateX(-Math.PI / 2);
  rimGeom.computeVertexNormals();

  const rimMesh = new THREE.Mesh(rimGeom, baseMat);
  rimMesh.receiveShadow = true;
  rimMesh.castShadow = true;
  group.add(rimMesh);

  /* ──────────────────────────────────────────────────────────
   * 3. Inner plate — dark slate floor
   * ────────────────────────────────────────────────────────── */

  const innerShape = createHexShape(SIZE * INNER_SCALE, SIDES);
  const innerGeom = new THREE.ShapeGeometry(innerShape);
  innerGeom.rotateX(-Math.PI / 2);
  innerGeom.translate(0, 0.01, 0);
  innerGeom.computeVertexNormals();

  const innerMesh = new THREE.Mesh(innerGeom, floorMat);
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  /* ──────────────────────────────────────────────────────────
   * 4. Underside accent ring — enhanced wide glow
   * ────────────────────────────────────────────────────────── */

  const glowRingShape = createHexShape(SIZE * 1.0, SIDES);
  glowRingShape.holes.push(createHexPath(SIZE * 0.45, SIDES));

  const glowGeom = new THREE.ShapeGeometry(glowRingShape);
  glowGeom.rotateX(-Math.PI / 2);
  glowGeom.computeVertexNormals();

  const glowMesh = new THREE.Mesh(glowGeom, accentMat);
  glowMesh.position.y = -(PLATFORM_DEPTH + UNDERGLOW_OFFSET);
  group.add(glowMesh);

  const underLight = new THREE.PointLight(COL_ACCENT, 1.5, 20, 2);
  underLight.position.set(0, -PLATFORM_DEPTH * 0.6, 0);
  group.add(underLight);

  /* ──────────────────────────────────────────────────────────
   * 5. Panel lines
   * ────────────────────────────────────────────────────────── */

  const panelY = 0.012;
  const panelLineMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.1,
  });

  const panelPts: THREE.Vector3[] = [];

  for (let i = 0; i < SIDES; i++) {
    const [vx, vy] = hexVertex(i, SIDES, rimInnerRadius * 0.97);
    panelPts.push(toWorld(0, 0, panelY));
    panelPts.push(toWorld(vx, vy, panelY));
  }

  for (const frac of PANEL_RINGS) {
    const r = rimInnerRadius * frac;
    for (let i = 0; i < SIDES; i++) {
      const [x1, y1] = hexVertex(i, SIDES, r);
      const [x2, y2] = hexVertex((i + 1) % SIDES, SIDES, r);
      panelPts.push(toWorld(x1, y1, panelY));
      panelPts.push(toWorld(x2, y2, panelY));
    }
  }

  const panelGeom = new THREE.BufferGeometry().setFromPoints(panelPts);
  group.add(new THREE.LineSegments(panelGeom, panelLineMat));

  /* ──────────────────────────────────────────────────────────
   * 6. Edge trim lines — brighter accent along rim borders
   * ────────────────────────────────────────────────────────── */

  const trimMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.35,
  });

  for (const radius of [rimOuterRadius, rimInnerRadius]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SIDES; i++) {
      const [x, z] = hexVertex(i % SIDES, SIDES, radius);
      pts.push(toWorld(x, z, RIM_HEIGHT + 0.005));
    }
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(lineGeom, trimMat));
  }

  /* ══════════════════════════════════════════════════════════
   *  FLOATING HUB ENHANCEMENTS
   * ════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * 8. Center Hub — elevated pentagon plate with accent rings,
   *    radial spokes, and a radial glow disc
   * ────────────────────────────────────────────────────────── */

  const hubShape = createPolygonShape(HUB_RADIUS, HUB_SIDES);
  const hubGeom = new THREE.ShapeGeometry(hubShape);
  hubGeom.rotateX(-Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeom, hubMat);
  hubMesh.position.y = HUB_HEIGHT;
  hubMesh.receiveShadow = true;
  group.add(hubMesh);

  const hubOuterRingMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.22,
  });
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= HUB_SIDES; i++) {
      const [x, z] = polygonVertex(i % HUB_SIDES, HUB_SIDES, HUB_RADIUS);
      pts.push(new THREE.Vector3(x, HUB_HEIGHT + 0.002, z));
    }
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        hubOuterRingMat,
      ),
    );
  }

  const hubRingMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.1,
  });
  for (const r of HUB_RING_RADII) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= HUB_SIDES; i++) {
      const [x, z] = polygonVertex(i % HUB_SIDES, HUB_SIDES, r);
      pts.push(new THREE.Vector3(x, HUB_HEIGHT + 0.002, z));
    }
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        hubRingMat,
      ),
    );
  }

  const hubSpokeMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.07,
  });
  const hubSpokePts: THREE.Vector3[] = [];
  for (let i = 0; i < HUB_SIDES; i++) {
    const [x, z] = polygonVertex(i, HUB_SIDES, HUB_RADIUS * 0.92);
    const sy = HUB_HEIGHT + 0.002;
    hubSpokePts.push(new THREE.Vector3(0, sy, 0), new THREE.Vector3(x, sy, z));
  }
  group.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(hubSpokePts),
      hubSpokeMat,
    ),
  );

  const centerGlowTex = createRadialGlowTexture({
    size: 256,
    r: 0,
    g: 229,
    b: 204,
    peakAlpha: 0.32,
  });
  const centerGlowMat = new THREE.MeshBasicMaterial({
    map: centerGlowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const centerGlowGeom = new THREE.PlaneGeometry(
    HUB_RADIUS * 3.0,
    HUB_RADIUS * 3.0,
  );
  centerGlowGeom.rotateX(-Math.PI / 2);
  const centerGlow = new THREE.Mesh(centerGlowGeom, centerGlowMat);
  centerGlow.position.y = HUB_HEIGHT + 0.003;
  group.add(centerGlow);

  /* ──────────────────────────────────────────────────────────
   * 9. Edge Energy Barrier — vertical glow planes per hex edge
   *    with scanline + shimmer animation
   * ────────────────────────────────────────────────────────── */

  const barrierMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(COL_ACCENT) },
      opacity: { value: 0.28 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      varying vec2 vUv;
      void main() {
        float heightFade = 1.0 - vUv.y;
        heightFade *= heightFade;
        float scan = 0.9 + 0.1 * sin(vUv.y * 30.0 + time * 1.5);
        float alpha = opacity * heightFade * scan;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  for (let i = 0; i < SIDES; i++) {
    const [sx1, sy1] = hexVertex(i, SIDES, SIZE * 0.99);
    const [sx2, sy2] = hexVertex((i + 1) % SIDES, SIDES, SIZE * 0.99);
    const wx1 = sx1,
      wz1 = -sy1;
    const wx2 = sx2,
      wz2 = -sy2;

    const positions = new Float32Array([
      wx1, 0, wz1, wx2, 0, wz2, wx2, BARRIER_HEIGHT, wz2, wx1, 0, wz1, wx2,
      BARRIER_HEIGHT, wz2, wx1, BARRIER_HEIGHT, wz1,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    group.add(new THREE.Mesh(geom, barrierMat));
  }

  /* ──────────────────────────────────────────────────────────
   * 10. Void Cascade — energy waterfall below platform edges
   * ────────────────────────────────────────────────────────── */

  const voidCascadeMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(COL_ACCENT) },
      opacity: { value: 0.42 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform float opacity;
      uniform float time;
      varying vec2 vUv;
      void main() {
        float t = vUv.y;
        float fade = t * t * t;
        float wisps = 0.92 + 0.08 * sin(vUv.x * 4.0 - time * 0.6 + t * 8.0);
        float alpha = opacity * fade * wisps;
        vec3 col = topColor * (0.6 + 0.4 * t);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  for (let i = 0; i < SIDES; i++) {
    const [sx1, sy1] = hexVertex(i, SIDES, SIZE * 1.01);
    const [sx2, sy2] = hexVertex((i + 1) % SIDES, SIDES, SIZE * 1.01);
    const wx1 = sx1,
      wz1 = -sy1;
    const wx2 = sx2,
      wz2 = -sy2;
    const yTop = 0;
    const yBot = -VOID_CASCADE_HEIGHT;

    const positions = new Float32Array([
      wx1, yTop, wz1, wx2, yTop, wz2, wx2, yBot, wz2, wx1, yTop, wz1, wx2,
      yBot, wz2, wx1, yBot, wz1,
    ]);
    const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    group.add(new THREE.Mesh(geom, voidCascadeMat));
  }

  /* ──────────────────────────────────────────────────────────
   * 11. Ambient Rising Particles — cyan dots drifting up
   *     from below the platform perimeter
   * ────────────────────────────────────────────────────────── */

  const particleBaseX = new Float32Array(PARTICLE_COUNT);
  const particleBaseZ = new Float32Array(PARTICLE_COUNT);
  const particleBaseY = new Float32Array(PARTICLE_COUNT);
  const particlePhases = new Float32Array(PARTICLE_COUNT);
  const particleSpeeds = new Float32Array(PARTICLE_COUNT);
  const pPositions = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = SIZE * (0.78 + Math.random() * 0.25);
    particleBaseX[i] = Math.cos(angle) * r;
    particleBaseZ[i] = Math.sin(angle) * r;
    particleBaseY[i] = -(PLATFORM_DEPTH + 1.0 + Math.random() * 2.0);
    particlePhases[i] = Math.random() * Math.PI * 2;
    particleSpeeds[i] = 0.06 + Math.random() * 0.1;

    pPositions[i * 3] = particleBaseX[i];
    pPositions[i * 3 + 1] = particleBaseY[i];
    pPositions[i * 3 + 2] = particleBaseZ[i];
  }

  const particleGeom = new THREE.BufferGeometry();
  particleGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(pPositions, 3),
  );

  const dotTex = createDotTexture();
  const particleMat = new THREE.PointsMaterial({
    color: COL_ACCENT,
    size: 0.08,
    map: dotTex,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(particleGeom, particleMat));

  /* ── AL Monogram — abstract sigil on hub floor ───────────── */

  const monoSize = 512;
  const monoCanvas = document.createElement("canvas");
  monoCanvas.width = monoSize;
  monoCanvas.height = monoSize;
  const monoCtx = monoCanvas.getContext("2d")!;
  monoCtx.clearRect(0, 0, monoSize, monoSize);

  const mc = monoSize / 2;
  const ms = monoSize * 0.25;

  monoCtx.strokeStyle = "rgba(0, 229, 204, 0.55)";
  monoCtx.lineWidth = 9;
  monoCtx.lineCap = "round";
  monoCtx.lineJoin = "round";

  monoCtx.beginPath();
  monoCtx.moveTo(mc + ms * 0.55, mc + ms * 0.45);
  monoCtx.lineTo(mc - ms * 0.3, mc + ms * 0.45);
  monoCtx.lineTo(mc - ms * 0.3, mc - ms * 0.1);
  monoCtx.lineTo(mc, mc - ms * 0.5);
  monoCtx.lineTo(mc + ms * 0.3, mc + ms * 0.05);
  monoCtx.stroke();

  monoCtx.lineWidth = 5;
  monoCtx.beginPath();
  monoCtx.moveTo(mc - ms * 0.12, mc + ms * 0.05);
  monoCtx.lineTo(mc + ms * 0.12, mc + ms * 0.05);
  monoCtx.stroke();

  monoCtx.strokeStyle = "rgba(0, 229, 204, 0.15)";
  monoCtx.lineWidth = 2;
  monoCtx.beginPath();
  monoCtx.arc(mc, mc, ms * 0.85, 0, Math.PI * 2);
  monoCtx.stroke();

  const monoTex = new THREE.CanvasTexture(monoCanvas);
  const monoGeom = new THREE.PlaneGeometry(3.0, 3.0);
  monoGeom.rotateX(-Math.PI / 2);
  const monogramMesh = new THREE.Mesh(monoGeom, new THREE.MeshBasicMaterial({
    map: monoTex,
    transparent: true,
    opacity: 0.10,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  monogramMesh.position.set(0, HUB_HEIGHT + 0.002, 0);
  group.add(monogramMesh);

  /* ── Add to scene ────────────────────────────────────────── */

  scene.add(group);

  /* ── Per-frame update (animated effects) ─────────────────── */

  const RISE_RANGE = 3.5;
  const PARTICLE_Y_CEIL = -0.5;

  function update(time: number): void {
    barrierMat.uniforms.time.value = time;
    voidCascadeMat.uniforms.time.value = time;

    centerGlowMat.opacity = 0.4 + Math.sin(time * 0.6) * 0.1;
    underLight.intensity = 1.5 + Math.sin(time * 0.4) * 0.3;

    const posAttr = particleGeom.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phase = particlePhases[i];
      const speed = particleSpeeds[i];
      const cycle = RISE_RANGE / speed;
      const t = ((time * speed + phase * 3) % cycle) / cycle;

      posAttr.setXYZ(
        i,
        particleBaseX[i] + Math.sin(time * 0.3 + phase) * 0.25,
        Math.min(PARTICLE_Y_CEIL, particleBaseY[i] + t * RISE_RANGE),
        particleBaseZ[i] + Math.cos(time * 0.25 + phase * 1.3) * 0.25,
      );
    }
    posAttr.needsUpdate = true;
    monogramMesh.rotation.y = time * 0.08;
  }

  return { group, update, monogramMesh };
}
