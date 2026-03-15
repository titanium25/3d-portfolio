import * as THREE from 'three';
import { createPostProcessing } from './postProcessing';
import { loadEnvironment } from './environment';
import { isMobile } from '../utils/mobileDetect';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  /** Render one frame — bypasses EffectComposer on mobile for ~2× GPU savings. */
  render: () => void;
  isMobile: boolean;
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

  // On mobile: no MSAA (tileGPUs handle it badly), lower pixel ratio
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Fix 4: cap pixel ratio to 1.5 on mobile — S24 Ultra at 1.5× vs 2× saves ~44% fill
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  // Fix 2: BasicShadowMap on mobile (single sample vs PCFSoft's 9 samples)
  renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xfff5e6, 0.6);
  directionalLight.position.set(12, 22, 10);
  directionalLight.castShadow = true;
  // Fix 2: 1024² on mobile vs 2048² on desktop (4× fewer shadow texels to sample)
  const shadowMapSize = isMobile ? 1024 : 2048;
  directionalLight.shadow.mapSize.width = shadowMapSize;
  directionalLight.shadow.mapSize.height = shadowMapSize;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 60;
  // Fix 2: tighter frustum — covers arena (0,0,0) through spawn pad (Z≈30)
  // with light at (12,22,10): frustum centred on midpoint (0,0,15), span ±18
  directionalLight.shadow.camera.left = -18;
  directionalLight.shadow.camera.right = 18;
  directionalLight.shadow.camera.top = 18;
  directionalLight.shadow.camera.bottom = -18;
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

  // Fix 1: on mobile, skip EffectComposer entirely — renderer handles ACESFilmic
  // tone mapping + sRGB output natively, so OutputPass adds zero visual benefit
  // but costs a full extra scene-size framebuffer blit every frame.
  const render = isMobile
    ? () => renderer.render(scene, camera)
    : () => composer.render();

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (!isMobile) {
      composer.setSize(w, h);
      composer.setPixelRatio(renderer.getPixelRatio());
    }
  });

  return { scene, camera, renderer, composer, render, isMobile };
}
