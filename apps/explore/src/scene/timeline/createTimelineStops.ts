import * as THREE from "three";
import type { Scene } from "three";
import type { Stop } from "../types";
import { TIMELINE_STOPS, type TimelineStopData } from "./timelineConfig";
import { buildTimelinePositions } from "./timelineLayout";
import {
  loadPortalModel,
  createTimelineCheckpoint,
} from "./createTimelineCheckpoint";
import { INTERACT_RADIUS } from "../../collision/checkCollisions";
import { computeProximityFactor } from "../../collision/proximityUtils";

const COL_ACCENT = 0x00e5cc;

/* ── Completion state ─────────────────────────────────────────── */

const completedStops = new Set<string>();

export function markStopCompleted(id: string): boolean {
  if (completedStops.has(id)) return false;
  completedStops.add(id);
  return true;
}

export function isStopCompleted(id: string): boolean {
  return completedStops.has(id);
}

/* ── Gate unlock pulse (3D emissive flash on first completion) ── */

let pulseGateId: string | null = null;
let pulseStartTime = 0;
const PULSE_DURATION_MS = 500;

export function pulseGateOnUnlock(stopId: string): void {
  pulseGateId = stopId;
  pulseStartTime = performance.now();
}

/* ── Map timeline data → existing StopData shape ──────────────── */

function mapToStopData(item: TimelineStopData): Stop["data"] {
  return {
    id: item.id,
    title: `${item.year} — ${item.title}`,
    description: item.subtitle,
    subtitle: item.subtitle,
    bullets: item.bullets,
    image: item.image,
    imageCaption: item.imageCaption,
    companyContext: item.companyContext,
    logo: item.logo,
    skills: item.skills,
  };
}

/* ── Create all timeline stops ────────────────────────────────── */

export async function createTimelineStops(
  scene: Scene,
  onAssetLoaded?: () => void,
): Promise<Stop[]> {
  // Load portal model once (cloned per checkpoint)
  await loadPortalModel();
  onAssetLoaded?.();

  const stops: Stop[] = [];
  const placements = buildTimelinePositions(TIMELINE_STOPS.length);

  TIMELINE_STOPS.forEach((item, i) => {
    const { position: pos, rotationY } = placements[i];
    const { group, mainMesh, ringMesh } = createTimelineCheckpoint(item.year);
    group.position.set(pos[0], pos[1], pos[2]);
    group.rotation.y = rotationY;

    // Empty particles group (required by Stop interface, no visible particles)
    const particlesGroup = new THREE.Group();
    group.add(particlesGroup);

    /* ── Point lights (primary + softer fill for stronger proximity glow) ─ */

    const pointLight = new THREE.PointLight(COL_ACCENT, 0.5, 10);
    pointLight.position.set(0, 1.2, 0);
    group.add(pointLight);

    const fillLight = new THREE.PointLight(COL_ACCENT, 0.2, 6);
    fillLight.position.set(0, 0.8, 0);
    group.add(fillLight);
    group.userData.fillLight = fillLight;

    scene.add(group);

    stops.push({
      group,
      mesh: mainMesh,
      position: pos,
      data: mapToStopData(item),
      baseY: pos[1],
      ringMesh,
      particlesGroup,
      pointLight,
    });
  });

  return stops;
}

/* ── Animation update (called every frame) ────────────────────── */

const LABEL_BOB_SPEED = 1.8;
const LABEL_BOB_AMP = 0.045;

export function updateTimelineAnimations(stops: Stop[], time: number): void {
  stops.forEach((stop, i) => {
    const phase = i * 0.9;
    const completed = completedStops.has(stop.data.id);

    // Ring breathing (scale + opacity pulse)
    const breathBase = completed ? 1.0 : 0.92;
    const breathAmp = completed ? 0.04 : 0.08;
    const breathSpeed = completed ? 1.8 : 2.5;
    const pulseScale =
      breathBase + Math.sin(time * breathSpeed + phase) * breathAmp;
    stop.ringMesh.scale.setScalar(pulseScale);

    const ringMat = stop.ringMesh.material as THREE.MeshBasicMaterial;
    const baseOpacity = completed ? 0.45 : 0.15;
    const opacityAmp = completed ? 0.08 : 0.06;
    ringMat.opacity =
      baseOpacity + Math.sin(time * 2.0 + phase) * opacityAmp;

    // Trim line opacity mirrors ring
    const trimLine = stop.group.userData.trimLine as THREE.LineLoop | undefined;
    if (trimLine) {
      const trimMat = trimLine.material as THREE.LineBasicMaterial;
      trimMat.opacity =
        completed ? 0.55 : 0.3 + Math.sin(time * 2.0 + phase) * 0.05;
    }

    // Year label gentle bob
    const labelSprite = stop.group.userData.labelSprite as
      | THREE.Sprite
      | undefined;
    const labelBaseY = stop.group.userData.labelBaseY as number | undefined;
    if (labelSprite && labelBaseY !== undefined) {
      labelSprite.position.y =
        labelBaseY + Math.sin(time * LABEL_BOB_SPEED + phase) * LABEL_BOB_AMP;
    }

    // Ground glow disc gentle pulse (combines with proximity scale from lighting)
    const glowDisc = stop.group.userData.glowDisc as THREE.Mesh | undefined;
    if (glowDisc) {
      const glowPulse = 1.0 + Math.sin(time * 1.5 + phase) * 0.04;
      const baseScale = (stop.group.userData.glowDiscBaseScale as number) ?? 1;
      glowDisc.scale.setScalar(baseScale * glowPulse);
    }

    // Portal fill — advance time uniform
    const portalFillMat = stop.group.userData.portalFillMat as THREE.ShaderMaterial | undefined;
    if (portalFillMat) {
      portalFillMat.uniforms.time.value = time;
    }

    // Energy particles — slow fixed-speed rise, opacity controlled by proximity lighting
    const energyParticles = stop.group.userData.energyParticles as THREE.Points | undefined;
    const energyOffsets = stop.group.userData.energyOffsets as Float32Array | undefined;
    const energyBasePos = stop.group.userData.energyBasePositions as Float32Array | undefined;
    const energyRise = (stop.group.userData.energyRise as number | undefined) ?? 3.0;
    const ENERGY_RISE_SPEED = 0.08;
    if (energyParticles && energyOffsets && energyBasePos) {
      const posAttr = energyParticles.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let j = 0; j < energyOffsets.length; j++) {
        const off = energyOffsets[j];
        const riseY = ((time * ENERGY_RISE_SPEED + off * 0.159) % 1.0) * energyRise;
        posAttr.setY(j, riseY);
        posAttr.setX(j, energyBasePos[j * 3] + Math.sin(time * 0.2 + off) * 0.04);
        posAttr.setZ(j, energyBasePos[j * 3 + 2] + Math.cos(time * 0.15 + off) * 0.04);
      }
      posAttr.needsUpdate = true;
    }
  });
}

/* ── Proximity lighting (smooth lerp, stronger glow on approach) ───────── */

const TIMELINE_PROXIMITY_RADIUS = 6.0; // wider than the global 3.5 — gates start reacting sooner
const BASE_LIGHT_INTENSITY = 0.5;
const MAX_LIGHT_INTENSITY = 4.0;
const BASE_FILL_INTENSITY = 0.2;
const MAX_FILL_INTENSITY = 2.5;
const BASE_EMISSIVE = 0.3;
const MAX_EMISSIVE = 1.25;
const COMPLETED_EMISSIVE_BOOST = 0.2;
const PROXIMITY_CURVE = 0.55; // power curve: lower = ramp up sooner from distance

export function updateTimelineLighting(
  stops: Stop[],
  playerPosition: THREE.Vector3,
): void {
  stops.forEach((stop) => {
    const worldPos = new THREE.Vector3();
    stop.group.getWorldPosition(worldPos);
    const distance = playerPosition.distanceTo(worldPos);
    const completed = completedStops.has(stop.data.id);

    const t = computeProximityFactor(
      distance,
      TIMELINE_PROXIMITY_RADIUS,
      INTERACT_RADIUS,
      PROXIMITY_CURVE,
    );

    const completedBoost = completed ? COMPLETED_EMISSIVE_BOOST : 0;

    // Primary point light — strong ramp on approach
    const lightIntensity =
      BASE_LIGHT_INTENSITY +
      (MAX_LIGHT_INTENSITY - BASE_LIGHT_INTENSITY) * t +
      (completed ? 0.6 : 0);
    if (stop.pointLight) {
      stop.pointLight.intensity = lightIntensity;
    }

    // Fill point light — softer glow that also intensifies
    const fillLight = stop.group.userData.fillLight as THREE.PointLight | undefined;
    if (fillLight) {
      fillLight.intensity =
        BASE_FILL_INTENSITY +
        (MAX_FILL_INTENSITY - BASE_FILL_INTENSITY) * t +
        (completed ? 0.3 : 0);
    }

    // Accent material (pad trim, ring effects)
    const emissiveIntensity =
      BASE_EMISSIVE + (MAX_EMISSIVE - BASE_EMISSIVE) * t + completedBoost;
    const accentMat = stop.group.userData.accentMaterial as
      | THREE.MeshStandardMaterial
      | undefined;
    if (accentMat) {
      accentMat.emissiveIntensity = emissiveIntensity;
    }

    // Portal model emissive materials — scale proportionally
    const modelMats = stop.group.userData.emissiveMaterials as
      | THREE.MeshStandardMaterial[]
      | undefined;
    if (modelMats) {
      const proxScale = 0.5 + t * 1.2 + (completed ? 0.25 : 0);
      for (const mat of modelMats) {
        const base =
          (mat.userData.baseEmissiveIntensity as number | undefined) ?? 0.5;
        mat.emissiveIntensity = base * proxScale;
      }
    }

    // Ground glow disc — main proximity feedback, stronger ramp
    const glowDisc = stop.group.userData.glowDisc as THREE.Mesh | undefined;
    if (glowDisc) {
      const glowMat = glowDisc.material as THREE.MeshBasicMaterial;
      const glowBase = completed ? 0.2 : 0.02;
      glowMat.opacity = glowBase + t * 0.72;
      stop.group.userData.glowDiscBaseScale = 1.0 + t * 0.28; // animation applies pulse on top
    }

    // Ring opacity boost on proximity
    const ringMat = stop.ringMesh.material as THREE.MeshBasicMaterial;
    const ringBase = completed ? 0.45 : 0.1;
    ringMat.opacity = ringBase + t * 0.55;

    // Trim line — brighter when close
    const trimLine = stop.group.userData.trimLine as THREE.LineLoop | undefined;
    if (trimLine) {
      const trimMat = trimLine.material as THREE.LineBasicMaterial;
      trimMat.opacity = completed ? 0.7 : 0.35 + t * 0.5;
    }

    // Portal model scale — gentle grow on approach, smooth lerp
    const portalModel = stop.group.userData.portalModel as THREE.Group | undefined;
    const portalBaseScale = (stop.group.userData.portalBaseScale as number | undefined) ?? 1;
    if (portalModel) {
      const targetScale = portalBaseScale * (1.0 + t * 0.06);
      const cs = portalModel.scale.x;
      portalModel.scale.setScalar(cs + (targetScale - cs) * 0.08);
    }

    // Energy particles — only opacity scales with proximity (speed is fixed)
    const energyPts = stop.group.userData.energyParticles as THREE.Points | undefined;
    if (energyPts) {
      const eMat = energyPts.material as THREE.PointsMaterial;
      eMat.opacity = t * 0.7 + (completed ? 0.08 : 0);
    }

    // Portal fill opacity — fades OUT when player is inside the portal arch
    const fillMat = stop.group.userData.portalFillMat as THREE.ShaderMaterial | undefined;
    if (fillMat) {
      const insideThreshold = 1.2;
      const insideFade = distance < insideThreshold
        ? Math.max(0, (distance - 0.4) / (insideThreshold - 0.4))
        : 1.0;
      const fillBase = completed ? 0.12 : 0.06;
      const fillTarget = (fillBase + t * 0.15) * insideFade;
      const fillCurrent = fillMat.uniforms.opacity.value as number;
      fillMat.uniforms.opacity.value = fillCurrent + (fillTarget - fillCurrent) * 0.08;
    }

    // Gate unlock pulse — temporary emissive burst that lerps back down
    if (pulseGateId === stop.data.id) {
      const elapsed = performance.now() - pulseStartTime;
      if (elapsed < PULSE_DURATION_MS) {
        const pulseT = 1.0 - elapsed / PULSE_DURATION_MS;
        if (modelMats) {
          for (const mat of modelMats) {
            mat.emissiveIntensity += pulseT * 2.0;
          }
        }
        if (stop.pointLight) {
          stop.pointLight.intensity += pulseT * 8.0;
        }
      } else {
        pulseGateId = null;
      }
    }
  });
}
