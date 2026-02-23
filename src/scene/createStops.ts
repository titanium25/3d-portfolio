import * as THREE from "three";
import type { Scene } from "three";
import type { Stop } from "./types";
import {
  PROXIMITY_RADIUS,
  INTERACT_RADIUS,
} from "../collision/checkCollisions";
import { computeProximityFactor } from "../collision/proximityUtils";

const STOP_COLORS = [0x4ecdc4, 0xffe66d, 0x95e1d3];

const STOPS_CONFIG: Array<{
  position: [number, number, number];
  data: { id: string; title: string; description: string };
  shape: "box" | "cylinder";
}> = [
  {
    position: [3, 0.5, 2],
    data: {
      id: "1",
      title: "Project A",
      description: "A full-stack web application with React and Node.js.",
    },
    shape: "box",
  },
  {
    position: [-3, 0.5, -2],
    data: {
      id: "2",
      title: "Project B",
      description: "Mobile app development using React Native.",
    },
    shape: "cylinder",
  },
  {
    position: [-2, 0.5, 3],
    data: {
      id: "3",
      title: "Project C",
      description: "Data visualization dashboard with D3.js.",
    },
    shape: "box",
  },
];

export function createStops(scene: Scene): Stop[] {
  const stops: Stop[] = [];

  STOPS_CONFIG.forEach((config, i) => {
    const color = STOP_COLORS[i % STOP_COLORS.length];
    const group = new THREE.Group();
    group.position.set(...config.position);
    const baseY = config.position[1];

    const geometry =
      config.shape === "box"
        ? new THREE.BoxGeometry(0.8, 1, 0.8)
        : new THREE.CylinderGeometry(0.5, 0.5, 1, 8);

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.4,
      envMapIntensity: 0.5,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const ringGeometry = new THREE.RingGeometry(0.9, 1.2, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -0.5;
    group.add(ringMesh);

    const particlesGroup = new THREE.Group();
    const particleCount = 8;
    const particleGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });

    for (let p = 0; p < particleCount; p++) {
      const particle = new THREE.Mesh(
        particleGeometry,
        particleMaterial.clone(),
      );
      const angle = (p / particleCount) * Math.PI * 2;
      particle.position.set(
        Math.cos(angle) * 1.2,
        0.3 + (p % 3) * 0.2,
        Math.sin(angle) * 1.2,
      );
      particle.userData = { baseAngle: angle };
      particlesGroup.add(particle);
    }
    group.add(particlesGroup);

    const pointLight = new THREE.PointLight(color, 0.8, 4);
    pointLight.position.set(0, 0.5, 0);
    group.add(pointLight);

    scene.add(group);

    stops.push({
      group,
      mesh,
      position: config.position,
      data: config.data,
      baseY,
      ringMesh,
      particlesGroup,
      pointLight,
    });
  });

  return stops;
}

const BASE_LIGHT_INTENSITY = 0.8;
const MAX_LIGHT_INTENSITY = 2.2;
const BASE_EMISSIVE = 0.2;
const MAX_EMISSIVE = 0.45;

export function updateStopLighting(
  stops: Stop[],
  playerPosition: THREE.Vector3,
): void {
  stops.forEach((stop) => {
    const worldPos = new THREE.Vector3();
    stop.group.getWorldPosition(worldPos);
    const distance = playerPosition.distanceTo(worldPos);
    const t = computeProximityFactor(
      distance,
      PROXIMITY_RADIUS,
      INTERACT_RADIUS,
    );

    const lightIntensity =
      BASE_LIGHT_INTENSITY + (MAX_LIGHT_INTENSITY - BASE_LIGHT_INTENSITY) * t;
    const emissiveIntensity =
      BASE_EMISSIVE + (MAX_EMISSIVE - BASE_EMISSIVE) * t;

    if (stop.pointLight) {
      stop.pointLight.intensity = lightIntensity;
    }
    const mat = stop.mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = emissiveIntensity;
  });
}

export function updateStopAnimations(stops: Stop[], time: number): void {
  stops.forEach((stop, i) => {
    const phase = i * 0.7;
    const floatOffset = Math.sin(time * 2 + phase) * 0.12;
    stop.group.position.y = stop.baseY + floatOffset;

    const pulseScale = 0.85 + Math.sin(time * 3 + phase) * 0.15;
    stop.ringMesh.scale.setScalar(pulseScale);
    (stop.ringMesh.material as THREE.MeshBasicMaterial).opacity =
      0.4 + Math.sin(time * 2.5 + phase) * 0.2;

    stop.particlesGroup.rotation.y = time * 0.8 + phase;
    stop.particlesGroup.children.forEach((p, j) => {
      const mesh = p as THREE.Mesh;
      const bob = Math.sin(time * 4 + j * 0.5) * 0.05;
      mesh.position.y = 0.3 + (j % 3) * 0.2 + bob;
    });
  });
}
