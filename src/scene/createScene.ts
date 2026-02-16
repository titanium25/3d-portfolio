import * as THREE from 'three';
import { createPostProcessing } from './postProcessing';
import { loadEnvironment } from './environment';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
}

export function createScene(container: HTMLElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(0x1a1d2e, 0.052);

  const camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(5, 4, 8);
  camera.lookAt(0, 0.5, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xfff5e6, 0.6);
  directionalLight.position.set(12, 22, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -15;
  directionalLight.shadow.camera.right = 15;
  directionalLight.shadow.camera.top = 15;
  directionalLight.shadow.camera.bottom = -15;
  directionalLight.shadow.bias = -0.0002;
  directionalLight.shadow.normalBias = 0.02;
  scene.add(directionalLight);

  const fillLight = new THREE.DirectionalLight(0xaaccff, 0.2);
  fillLight.position.set(-8, 10, -5);
  scene.add(fillLight);

  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d4a5e, 0.25);
  scene.add(hemisphereLight);

  const rimLight = new THREE.DirectionalLight(0xb8d4f1, 0.2);
  rimLight.position.set(-6, 4, -8);
  scene.add(rimLight);

  const composer = createPostProcessing(scene, camera, renderer);
  loadEnvironment(scene, renderer);

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
  });

  return { scene, camera, renderer, composer };
}
