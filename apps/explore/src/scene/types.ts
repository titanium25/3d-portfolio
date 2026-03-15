import type { Group, Mesh, PointLight } from "three";

export interface StackLayer {
  id: string;
  label: string;
  accent: string;
  accentRgb: string;
  metric: string;
  pills: string[];
  bullets: string[];
}

export interface StopData {
  id: string;
  title: string;
  description: string;
  subtitle?: string;
  bullets?: string[];
  links?: { label: string; url: string }[];
  image?: string;
  imageCaption?: string;
  companyContext?: string;
  logo?: string;
  skills?: string[];
  // Stack Navigator fields (ops-center only)
  layers?: StackLayer[];
  leadershipBar?: string;
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
