import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { createRadialGlowTexture } from "../textureUtils";

/* ── Palette (matches megastructure platform) ─────────────────── */

const COL_PAD = 0x141c26; // road-family dark
const COL_ACCENT = 0x00e5cc; // cyan emissive

/* ── Portal model ─────────────────────────────────────────────── */

const PORTAL_MODEL_PATH =
  "/models/Meshy_AI_Neon_Quantum_Portal_0216123143_texture.glb";
const MODEL_TARGET_HEIGHT = 2.9;

/* ── Floor pad ────────────────────────────────────────────────── */

const PAD_MARGIN = 0.15; // extra clearance beyond model footprint
const PAD_H = 0.035;
const PAD_CORNER_R = 0.12;

/* ── Activation ring ──────────────────────────────────────────── */

const RING_PAD = 0.1;
const RING_THICKNESS = 0.06;
const RING_SEGMENTS = 48;

/* ── Year label ───────────────────────────────────────────────── */

const LABEL_SPRITE_W = 1.2;

/* ── Model cache (loaded once, cloned per checkpoint) ─────────── */

interface PortalCache {
  scene: THREE.Group;
  scale: number;
  height: number;
  halfW: number;
  halfD: number;
}

let portalCache: PortalCache | null = null;

export async function loadPortalModel(): Promise<void> {
  if (portalCache) return;

  const loader = new GLTFLoader();
  const gltf = await new Promise<GLTF>((resolve, reject) =>
    loader.load(PORTAL_MODEL_PATH, resolve, undefined, reject),
  );

  const scene = gltf.scene;

  // Measure original (unmodified) to get size for scale factor
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const scale = MODEL_TARGET_HEIGHT / size.y;

  // Cache the UNMODIFIED scene — grounding is done per-clone in the factory
  portalCache = {
    scene,
    scale,
    height: MODEL_TARGET_HEIGHT,
    halfW: (size.x * scale) / 2,
    halfD: (size.z * scale) / 2,
  };
}

/* ── Public types ─────────────────────────────────────────────── */

export interface CheckpointComponents {
  group: THREE.Group;
  accentMaterial: THREE.MeshStandardMaterial;
  mainMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
}

/* ── Checkpoint factory (loadPortalModel must be awaited first) ── */

export function createTimelineCheckpoint(year: number): CheckpointComponents {
  const p = portalCache!;
  const group = new THREE.Group();

  // Per-checkpoint accent material for pad trim / ring glow control
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x051210,
    emissive: COL_ACCENT,
    emissiveIntensity: 0.25,
    roughness: 0.6,
    metalness: 0.0,
  });

  /* ── 1. Floor pad ────────────────────────────────────────── */

  const padW = p.halfW * 2 + PAD_MARGIN * 2;
  const padD = p.halfD * 2 + PAD_MARGIN * 2;

  const padShape = createRoundedRectShape(padW, padD, PAD_CORNER_R);
  const padGeom = new THREE.ExtrudeGeometry(padShape, {
    depth: PAD_H,
    bevelEnabled: false,
  });
  padGeom.rotateX(-Math.PI / 2);

  const padMat = new THREE.MeshStandardMaterial({
    color: COL_PAD,
    roughness: 0.92,
    metalness: 0.06,
    envMapIntensity: 0.3,
  });
  const padMesh = new THREE.Mesh(padGeom, padMat);
  padMesh.position.y = 0.008;
  padMesh.receiveShadow = true;
  group.add(padMesh);

  // Pad edge trim (thin cyan outline)
  const trimPts = createRoundedRectPoints(
    padW + 0.03,
    padD + 0.03,
    PAD_CORNER_R + 0.015,
    48,
  );
  const trimGeom = new THREE.BufferGeometry().setFromPoints(
    trimPts.map((pt) => new THREE.Vector3(pt.x, 0.008 + PAD_H + 0.002, pt.y)),
  );
  const trimLine = new THREE.LineLoop(
    trimGeom,
    new THREE.LineBasicMaterial({
      color: COL_ACCENT,
      transparent: true,
      opacity: 0.35,
    }),
  );
  group.add(trimLine);

  /* ── 2. Portal model (cloned from cache) ─────────────────── */

  let mainMesh: THREE.Mesh | null = null;
  const emissiveMaterials: THREE.MeshStandardMaterial[] = [];

  // Clone the unmodified scene and ground it — same approach as
  // BaseCharacter.loadCharacterModel (scale → recompute box → position)
  const model = p.scene.clone();
  model.scale.setScalar(p.scale);

  const _box = new THREE.Box3().setFromObject(model);
  const _center = _box.getCenter(new THREE.Vector3());
  model.position.x = -_center.x;
  model.position.z = -_center.z;
  model.position.y = -_box.min.y;

  // Clone materials per checkpoint so emissive stays independent
  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mainMesh) mainMesh = mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    const cloned = mats.map((m) => {
      const c = m.clone();
      if ((c as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const std = c as THREE.MeshStandardMaterial;
        std.userData.baseEmissiveIntensity = std.emissiveIntensity;
        emissiveMaterials.push(std);
      }
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  });

  group.add(model);
  group.userData.portalModel = model;
  group.userData.portalBaseScale = p.scale;

  // Fallback if model had no meshes
  if (!mainMesh) {
    const fb = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      accentMat,
    );
    fb.position.y = 0.15;
    group.add(fb);
    mainMesh = fb;
  }

  /* ── 3. Year label sprite on the top bar ─────────────────── */

  const labelSprite = createYearSprite(year);
  const labelY = p.height - 0.75; // under the top crossbar
  labelSprite.position.set(0, labelY, 0);
  group.add(labelSprite);

  /* ── 4. Activation ring ──────────────────────────────────── */

  const ringR = Math.max(p.halfW, p.halfD) + RING_PAD;
  const ringGeom = new THREE.RingGeometry(
    ringR,
    ringR + RING_THICKNESS,
    RING_SEGMENTS,
  );
  const ringMat = new THREE.MeshBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.009;
  group.add(ringMesh);

  /* ── 5. Ground glow disc (proximity reactive) ─────────────── */

  const glowR = Math.max(p.halfW, p.halfD) + 1.0;
  const glowGeom = new THREE.PlaneGeometry(glowR * 2, glowR * 2);
  const glowTex = createRadialGlowTexture({
    size: 128,
    colorStops: [
      { offset: 0, color: "rgba(255,255,255,0.7)" },
      { offset: 0.35, color: "rgba(255,255,255,0.3)" },
      { offset: 0.7, color: "rgba(255,255,255,0.08)" },
      { offset: 1, color: "rgba(255,255,255,0)" },
    ],
  });
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glowDisc = new THREE.Mesh(glowGeom, glowMat);
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = 0.006;
  group.add(glowDisc);

  /* ── 6. Rising energy particles ──────────────────────────── */

  const ENERGY_COUNT = 28;
  const ENERGY_SPREAD = 1.0; // scatter radius around base
  const ENERGY_RISE = 3.4;   // max height particles reach

  const ePosArray = new Float32Array(ENERGY_COUNT * 3);
  const eOffsets = new Float32Array(ENERGY_COUNT);
  for (let j = 0; j < ENERGY_COUNT; j++) {
    const angle = (j / ENERGY_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const r = ENERGY_SPREAD * (0.3 + Math.random() * 0.7);
    ePosArray[j * 3] = Math.cos(angle) * r;
    ePosArray[j * 3 + 1] = Math.random() * ENERGY_RISE;
    ePosArray[j * 3 + 2] = Math.sin(angle) * r;
    eOffsets[j] = Math.random() * Math.PI * 2;
  }

  const energyGeom = new THREE.BufferGeometry();
  energyGeom.setAttribute("position", new THREE.BufferAttribute(ePosArray, 3));
  const energyMat = new THREE.PointsMaterial({
    color: COL_ACCENT,
    size: 0.04,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const energyParticles = new THREE.Points(energyGeom, energyMat);
  group.add(energyParticles);

  // Separate copy so the animation loop doesn't mutate base positions

  /* ── 7. Portal fill — energy field inside the arch opening ──── */

  const pillarInset = 0.08;
  const pillarX = p.halfW - pillarInset;

  // Size the fill to the clear opening between pillars
  const fillW = pillarX * 2 * 0.88;
  const fillH = p.height * 0.80;
  const fillY = 0.18 + fillH / 2; // slightly above pad

  const fillGeom = new THREE.PlaneGeometry(fillW, fillH, 1, 1);

  const portalFillMat = new THREE.ShaderMaterial({
    uniforms: {
      time:    { value: 0.0 },
      color:   { value: new THREE.Color(COL_ACCENT) },
      opacity: { value: 0.0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float time;
      uniform vec3  color;
      uniform float opacity;
      varying vec2  vUv;

      void main() {
        vec2 uv = vUv - 0.5;

        // Elliptical soft mask that follows arch shape
        float dist = length(uv * vec2(1.0, 1.12));
        float mask = 1.0 - smoothstep(0.36, 0.5, dist);
        if (mask <= 0.001) discard;

        float r     = length(uv);
        float theta = atan(uv.y, uv.x);

        // Expanding ripple rings from centre
        float rings = sin(r * 20.0 - time * 2.8) * 0.5 + 0.5;
        rings = pow(rings, 1.6);

        // Rotating swirl
        float swirl = sin(theta * 3.0 + r * 9.0 - time * 1.6) * 0.5 + 0.5;

        // Vertical energy flow (two frequencies for richness)
        float flow = sin(vUv.y * 11.0 - time * 4.2) * 0.35
                   + sin(vUv.y *  5.5 - time * 2.4 + 1.3) * 0.25
                   + 0.4;

        // Rotational shimmer sparks
        float shimmer = pow(max(0.0, sin(theta * 9.0 + time * 3.5) * 0.5 + 0.5), 4.0) * 0.4;

        // Soft bright core
        float core = 1.0 - smoothstep(0.0, 0.22, r);

        // Event-horizon ring — sharp bright edge at the perimeter
        float edgeRing = smoothstep(0.26, 0.40, dist) * (1.0 - smoothstep(0.40, 0.50, dist));
        edgeRing = pow(edgeRing, 0.65);

        float intensity = rings   * 0.22
                        + swirl   * 0.18
                        + flow    * 0.22
                        + shimmer
                        + core    * 0.30
                        + edgeRing * 1.0;

        intensity *= mask;

        // Gentle global pulse
        float pulse = 0.80 + sin(time * 1.15) * 0.20;

        gl_FragColor = vec4(color, clamp(intensity * opacity * pulse, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite:  false,
    side:        THREE.DoubleSide,
    blending:    THREE.AdditiveBlending,
  });

  const portalFillMesh = new THREE.Mesh(fillGeom, portalFillMat);
  portalFillMesh.position.set(0, fillY, 0);
  group.add(portalFillMesh);

  /* ── Store refs for per-frame updates ────────────────────── */

  group.userData.accentMaterial = accentMat;
  group.userData.emissiveMaterials = emissiveMaterials;
  group.userData.trimLine = trimLine;
  group.userData.labelSprite = labelSprite;
  group.userData.labelBaseY = p.height - 0.75;
  group.userData.glowDisc = glowDisc;
  group.userData.energyParticles = energyParticles;
  group.userData.energyOffsets = eOffsets;
  group.userData.energyBasePositions = new Float32Array(ePosArray);
  group.userData.energyRise = ENERGY_RISE;
  group.userData.portalFillMat = portalFillMat;

  /* ── Pillar collision (two circles for left/right frame, opening is free) */
  group.userData.collisionPoints = [
    [-pillarX, 0] as [number, number], // left pillar
    [pillarX, 0] as [number, number], // right pillar
  ];
  group.userData.collisionRadius = 0.25; // narrow pillar radius

  return { group, accentMaterial: accentMat, mainMesh, ringMesh };
}

/* ── Geometry helpers ─────────────────────────────────────────── */

function createRoundedRectShape(
  w: number,
  h: number,
  r: number,
): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

function createRoundedRectPoints(
  w: number,
  h: number,
  r: number,
  segments: number,
): THREE.Vector2[] {
  const hw = w / 2;
  const hh = h / 2;
  const pts: THREE.Vector2[] = [];
  const cornerSegs = Math.max(2, Math.floor(segments / 4));

  for (let corner = 0; corner < 4; corner++) {
    const baseAngle = -Math.PI / 2 + (Math.PI / 2) * corner;
    const cx = corner < 2 ? hw - r : -(hw - r);
    const cy = corner === 0 || corner === 3 ? -(hh - r) : hh - r;
    for (let i = 0; i <= cornerSegs; i++) {
      const a = baseAngle + (Math.PI / 2) * (i / cornerSegs);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }

  return pts;
}


/* ── Year label sprite (CanvasTexture, always faces camera) ───── */

function createYearSprite(year: number): THREE.Sprite {
  const canvasW = 512;
  const canvasH = 160;
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, canvasW, canvasH);

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  ctx.font = `bold 96px 'Cascadia Code', 'Fira Code', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Glow layer — blurred cyan halo behind the text
  ctx.shadowColor = "#00e5cc";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(0, 229, 204, 0.55)";
  ctx.fillText(String(year), cx, cy);

  // Second glow pass for density
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgba(0, 229, 204, 0.4)";
  ctx.fillText(String(year), cx, cy);

  // Crisp white text on top — no shadow so letters stay sharp
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#d8fff9";
  ctx.fillText(String(year), cx, cy);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  const aspect = canvasH / canvasW;
  sprite.scale.set(LABEL_SPRITE_W, LABEL_SPRITE_W * aspect, 1);
  return sprite;
}
