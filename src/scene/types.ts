import type { Group, Mesh, PointLight } from "three";

export interface StopData {
  id: string;
  title: string;
  description: string;
}

export interface Stop {
  group: Group;
  mesh: Mesh;
  position: [number, number, number];
  data: StopData;
  baseY: number;
  ringMesh: Mesh;
  particlesGroup: Group;
  pointLight?: PointLight;
}
