import * as THREE from "three";
import type { Scene } from "three";
import type { Stop } from "../types";
import { TIMELINE_STOPS, type TimelineStopData } from "./timelineConfig";
import { buildTimelinePositions } from "./timelineLayout";
import {
  loadPortalModel,
  createTimelineCheckpoint,
} from "./createTimelineCheckpoint";
import {
  PROXIMITY_RADIUS,
  INTERACT_RADIUS,
} from "../../collision/checkCollisions";

const COL_ACCENT = 0x00e5cc;

/* ── Completion state ─────────────────────────────────────────── */

const completedStops = new Set<string>();

export function markStopCompleted(id: string): void {
  completedStops.add(id);
}

export function isStopCompleted(id: string): boolean {
  return completedStops.has(id);
}

/* ── Map timeline data → existing StopData shape ──────────────── */

function mapToStopData(item: TimelineStopData): Stop["data"] {
  return {
    id: item.id,
    title: `${item.year} — ${item.title}`,
    description: item.subtitle,
    subtitle: item.subtitle,
    bullets: item.bullets,
    links: item.links,
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
  });
}

/* ── Proximity lighting (smooth lerp, stronger glow on approach) ───────── */

const BASE_LIGHT_INTENSITY = 0.5;
const MAX_LIGHT_INTENSITY = 4.0;
const BASE_FILL_INTENSITY = 0.2;
const MAX_FILL_INTENSITY = 2.5;
const BASE_EMISSIVE = 0.3;
const MAX_EMISSIVE = 1.25;
const COMPLETED_EMISSIVE_BOOST = 0.2;
const PROXIMITY_CURVE = 0.6; // power curve: lower = ramp up sooner from distance

export function updateTimelineLighting(
  stops: Stop[],
  playerPosition: THREE.Vector3,
): void {
  stops.forEach((stop) => {
    const worldPos = new THREE.Vector3();
    stop.group.getWorldPosition(worldPos);
    const distance = playerPosition.distanceTo(worldPos);
    const completed = completedStops.has(stop.data.id);

    // Proximity factor 0..1 (closer = higher)
    let t = 0;
    if (distance < PROXIMITY_RADIUS) {
      t =
        1 -
        (distance - INTERACT_RADIUS) / (PROXIMITY_RADIUS - INTERACT_RADIUS);
      t = Math.max(0, Math.min(1, t));
      // Power curve: glow ramps up sooner as you approach
      t = Math.pow(t, PROXIMITY_CURVE);
    }

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
  });
}
