/**
 * createCommandSpire.ts
 *
 * Arena centerpiece VFX — restrained, elegant sci-fi tone.
 *  1. Beacon Ray: razor-thin ghostly wisp above the tower tip
 *  2. Rising Particles: 12 tiny energy specks hugging the tower surface
 *  3. Emissive Idle Pulse: narrow breathing + proximity PointLight
 *  4. Holographic Rings: 3 slow-drifting ghostly ring planes
 *
 * Draw calls: ≤ 5.  All effects are atmospheric support — the tower model is the star.
 */

import * as THREE from "three";
import { gltfLoader } from "./loaderSetup";
import { computeProximityFactor } from "../collision/proximityUtils";
import type { StopData } from "../scene/types";

/* ══════════════════════════════════════════════════════════════
 *  Constants
 * ════════════════════════════════════════════════════════════ */

const SPIRE_PATH = "/models/optimized/Meshy_AI_Cyan_Ring_Spire_0314184308_texture.glb";
const SPIRE_TARGET_HEIGHT = 4;
const SPIRE_POS = new THREE.Vector3(0, 0, 0);

const PROX_OUTER = 8.0;
const PROX_INNER = 2.0;

const COL_CYAN = 0x00e5cc;

/* ══════════════════════════════════════════════════════════════
 *  Public API
 * ════════════════════════════════════════════════════════════ */

export interface CommandSpireContext {
  group: THREE.Group;
  update(time: number, playerPosition: THREE.Vector3): void;
  stopData: StopData;
  collisionRadius: number;
}

/* ══════════════════════════════════════════════════════════════
 *  Overlay content data
 * ════════════════════════════════════════════════════════════ */

const SPIRE_STOP_DATA: StopData = {
  id: "ops-center",
  title: "The Ops Center",
  description: "Full-stack architecture across 20+ microservices, 100K+ users, and company-wide engineering standards.",
  subtitle: "Full-stack architecture · From interface to infrastructure",
  companyContext: "System architecture across 20+ microservices, 100+ shared libraries, and dashboards serving 100K+ users.",
  layers: [
    {
      id: "frontend",
      label: "FRONTEND COMMAND",
      accent: "#4ecdc4",
      accentRgb: "78, 205, 196",
      metric: "100K+ users",
      pills: ["React", "TypeScript", "React Query", "MUI", "Storybook", "i18n"],
      bullets: [
        "Dashboards for {100K+ users} ({70K active}). Smart polling synced to backend 30s refresh.",
        "Introduced {React Query} company-wide — cache strategy, invalidation rules, shared defaults.",
        "MUI foundation: theme tokens, component patterns, Storybook docs. Aligned eng with Figma.",
      ],
    },
    {
      id: "backend",
      label: "BACKEND & SERVICES",
      accent: "#f0a500",
      accentRgb: "240, 165, 0",
      metric: "20+ microservices",
      pills: ["Node.js", "NestJS", "Nx", "Redis", "BullMQ", "MongoDB"],
      bullets: [
        "{20+} microservices, {100+} shared libs in Nx monorepo. Owned {3} services end-to-end.",
        "Redis cache for trade scores — eliminated rate-limit failures, cut API cost {30–40%}.",
        "BullMQ async processing across service boundaries.",
      ],
    },
    {
      id: "infra",
      label: "INFRASTRUCTURE & QUALITY",
      accent: "#8b7ec8",
      accentRgb: "139, 126, 200",
      metric: "6 teams trained",
      pills: ["Docker", "GitHub Actions", "Grafana", "Prometheus", "Sentry", "Coralogix"],
      bullets: [
        "Docker + GitHub Actions CI/CD. Drove CI/CD adoption at Restigo.",
        "Observability: Grafana/Prometheus, Sentry, Coralogix across production.",
        "AI workflow: {Cursor} + {Claude Code} for planning, refactors, code review, tests.",
      ],
    },
  ],
  leadershipBar: "Architecture training for {6 teams} (~18–24 developers) — structure, theming, i18n, UX states, best practices.",
  // Keep for StopData interface compatibility
  bullets: [],
  skills: [
    "React", "TypeScript", "Node.js", "NestJS", "Nx",
    "Redis", "BullMQ", "MUI", "React Query", "Storybook",
    "Docker", "MongoDB", "SQL", "GitHub Actions",
    "Grafana", "Sentry", "Cursor", "Claude Code",
  ],
};

/* ══════════════════════════════════════════════════════════════
 *  Main factory
 * ════════════════════════════════════════════════════════════ */

export async function createCommandSpire(
  scene: THREE.Scene,
  onAssetLoaded?: () => void,
): Promise<CommandSpireContext> {
  const group = new THREE.Group();
  group.name = "CommandSpire";
  group.position.copy(SPIRE_POS);

  /* ── Load tower GLB ──────────────────────────────────────── */

  const gltf = await gltfLoader.loadAsync(SPIRE_PATH);
  const model = gltf.scene;

  const box = new THREE.Box3().setFromObject(model);
  const currentHeight = box.max.y - box.min.y;
  const scale = SPIRE_TARGET_HEIGHT / currentHeight;
  model.scale.setScalar(scale);

  box.setFromObject(model);
  model.position.y = -box.min.y;

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).castShadow = true;
      (child as THREE.Mesh).receiveShadow = true;
    }
  });

  group.add(model);

  const towerBox = new THREE.Box3().setFromObject(model);
  const towerTopY = towerBox.max.y;
  const towerHeight = towerTopY - towerBox.min.y;

  group.userData.collisionPoints = [[0, 0]];
  group.userData.collisionRadius = 1.2;

  onAssetLoaded?.();

  /* ── Collect emissive meshes (ONCE) ──────────────────────── */

  const emissiveMeshes: THREE.Mesh[] = [];
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat?.emissive && (mat.emissive.r > 0.01 || mat.emissive.g > 0.01 || mat.emissive.b > 0.01)) {
      mesh.userData._baseEmissive = mat.emissiveIntensity;
      emissiveMeshes.push(mesh);
    }
  });

  /* ══════════════════════════════════════════════════════════
   *  1. Beacon Ray — razor-thin ethereal wisp above tip
   *     1 draw call (2 crossed quads merged)
   * ════════════════════════════════════════════════════════ */

  const beaconMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uProximity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec3 pos = position;
        // Subtle width shimmer — barely perceptible
        pos.x *= 0.95 + 0.05 * sin(uTime * 1.5 + pos.y * 0.6);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uProximity;
      varying vec2 vUv;
      void main() {
        // Steep vertical gradient — bright at base, gone by 60% height
        float vGrad = pow(1.0 - vUv.y, 3.5);
        // Horizontal softness — edges fully dissolve
        float hSoft = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 1.8);
        // Very slow breathing — the only animation
        float breath = 0.25 + 0.15 * sin(uTime * 1.0);
        // Ghostly pale cyan — not white, not saturated
        vec3 col = vec3(0.3, 0.85, 0.95);
        float alpha = vGrad * hSoft * breath * (0.8 + uProximity * 0.2);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const BEACON_WIDTH = 0.15;
  const BEACON_HEIGHT = 4.2;
  const hw = BEACON_WIDTH / 2;

  // prettier-ignore
  const beaconVerts = new Float32Array([
    // Quad 1 (XY plane)
    -hw, 0, 0,   hw, 0, 0,   hw, BEACON_HEIGHT, 0,
    -hw, 0, 0,   hw, BEACON_HEIGHT, 0,  -hw, BEACON_HEIGHT, 0,
    // Quad 2 (ZY plane)
    0, 0, -hw,   0, 0, hw,   0, BEACON_HEIGHT, hw,
    0, 0, -hw,   0, BEACON_HEIGHT, hw,  0, BEACON_HEIGHT, -hw,
  ]);
  // prettier-ignore
  const beaconUvs = new Float32Array([
    0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
    0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
  ]);
  const beaconGeo = new THREE.BufferGeometry();
  beaconGeo.setAttribute("position", new THREE.BufferAttribute(beaconVerts, 3));
  beaconGeo.setAttribute("uv", new THREE.BufferAttribute(beaconUvs, 2));

  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.y = towerTopY;
  beaconMesh.castShadow = false;
  beaconMesh.receiveShadow = false;
  beaconMesh.frustumCulled = false;
  group.add(beaconMesh);

  /* ══════════════════════════════════════════════════════════
   *  2. Rising Particles — 12 tiny specks along tower surface
   *     1 draw call, all animation in vertex shader
   * ════════════════════════════════════════════════════════ */

  const PARTICLE_COUNT = 12;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particlePhases   = new Float32Array(PARTICLE_COUNT);
  const particleSpeeds   = new Float32Array(PARTICLE_COUNT);
  const particleRadii    = new Float32Array(PARTICLE_COUNT);
  const particleSizes    = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.05 + Math.random() * 0.13;
    particlePositions[i * 3]     = Math.cos(angle) * r;
    particlePositions[i * 3 + 1] = Math.random() * towerHeight;
    particlePositions[i * 3 + 2] = Math.sin(angle) * r;
    particlePhases[i] = Math.random() * 6.283;
    particleSpeeds[i] = 0.3 + Math.random() * 0.25;
    particleRadii[i]  = 0.05 + Math.random() * 0.13;
    particleSizes[i]  = 1.5 + Math.random() * 2.0;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeo.setAttribute("aPhase",   new THREE.BufferAttribute(particlePhases, 1));
  particleGeo.setAttribute("aSpeed",   new THREE.BufferAttribute(particleSpeeds, 1));
  particleGeo.setAttribute("aRadius",  new THREE.BufferAttribute(particleRadii, 1));
  particleGeo.setAttribute("aSize",    new THREE.BufferAttribute(particleSizes, 1));

  const particleMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:        { value: 0 },
      uTowerHeight: { value: towerHeight },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aRadius;
      attribute float aSize;
      uniform float uTime;
      uniform float uTowerHeight;
      varying float vY;
      void main() {
        float speed = aSpeed;
        float y = mod(aPhase + uTime * speed, uTowerHeight);
        float angle = aPhase + uTime * 0.4;
        vec3 pos = vec3(aRadius * cos(angle), y, aRadius * sin(angle));
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = aSize * (300.0 / length(mvPos.xyz));
        vY = y / uTowerHeight;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vY;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float glow = 1.0 - d * 2.0;
        float alpha = glow * smoothstep(0.0, 0.12, vY) * (1.0 - smoothstep(0.75, 1.0, vY));
        gl_FragColor = vec4(0.4, 1.0, 0.95, alpha * 0.35);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particlePoints = new THREE.Points(particleGeo, particleMat);
  particlePoints.castShadow = false;
  particlePoints.receiveShadow = false;
  group.add(particlePoints);

  /* ══════════════════════════════════════════════════════════
   *  3. Emissive Idle Pulse + Proximity PointLight
   *     0 draw calls — material updates + 1 light
   * ════════════════════════════════════════════════════════ */

  const tipLight = new THREE.PointLight(COL_CYAN, 0.1, 8.0);
  tipLight.position.set(0, towerTopY, 0);
  tipLight.castShadow = false;
  group.add(tipLight);

  /* ══════════════════════════════════════════════════════════
   *  4. Holographic Rings — ghostly drifting planes
   *     3 draw calls (share one material instance)
   * ════════════════════════════════════════════════════════ */

  const ringMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uProximity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec3 pos = position;
        // Very subtle surface ripple
        pos.z += sin(pos.x * 8.0 + uTime * 2.0) * 0.008;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uProximity;
      varying vec2 vUv;
      void main() {
        // Low-contrast scanlines — texture, not stripe
        float scan = 0.7 + 0.3 * sin(vUv.x * 40.0 + uTime * 3.0);
        // Soft inner/outer edge fade
        float edgeFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        vec3 col = vec3(0.3, 0.9, 1.0);
        // Base opacity 0.08, proximity brings up to ~0.22
        float alpha = (0.08 + uProximity * 0.14) * edgeFade * scan;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // [yFraction, innerR, outerR, speed (rad/s — reduced 30%)]
  const ringSpecs: [number, number, number, number][] = [
    [0.20, 0.55, 0.85,  0.21],
    [0.38, 0.65, 1.05, -0.35],
    [0.55, 0.45, 0.70,  0.56],
  ];

  const ringMeshes: THREE.Mesh[] = [];
  const ringSpeeds: number[] = [];

  for (const [yFrac, innerR, outerR, speed] of ringSpecs) {
    const geo = new THREE.RingGeometry(innerR, outerR, 48, 1);
    const mesh = new THREE.Mesh(geo, ringMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = towerHeight * yFrac;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    ringMeshes.push(mesh);
    ringSpeeds.push(speed);
  }

  /* ── Add to scene ───────────────────────────────────────── */

  scene.add(group);

  /* ══════════════════════════════════════════════════════════
   *  Per-frame update
   * ════════════════════════════════════════════════════════ */

  function update(time: number, playerPosition: THREE.Vector3): void {
    const distance = playerPosition.distanceTo(SPIRE_POS);
    const proximity = computeProximityFactor(distance, PROX_OUTER, PROX_INNER);

    /* ── Beacon ─────────────────────────────────────────── */
    beaconMat.uniforms.uTime.value = time;
    beaconMat.uniforms.uProximity.value = proximity;

    /* ── Particles ──────────────────────────────────────── */
    particleMat.uniforms.uTime.value = time;

    /* ── Rings ──────────────────────────────────────────── */
    ringMat.uniforms.uTime.value = time;
    ringMat.uniforms.uProximity.value = proximity;

    for (let i = 0; i < ringMeshes.length; i++) {
      ringMeshes[i].rotation.z = time * ringSpeeds[i];
    }

    /* ── Emissive pulse (narrow breathing) ──────────────── */
    const pulse = 0.1 + 0.08 * Math.sin(time * 0.8);
    const finalIntensity = pulse + proximity * 0.4;
    for (const mesh of emissiveMeshes) {
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        mesh.userData._baseEmissive + finalIntensity;
    }

    /* ── PointLight ─────────────────────────────────────── */
    tipLight.intensity = 0.1 + proximity * 1.5;
  }

  return { group, update, stopData: SPIRE_STOP_DATA, collisionRadius: 1.2 };
}
