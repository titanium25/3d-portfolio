import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Scene } from 'three';
import type { PerspectiveCamera } from 'three';
import type { WebGLRenderer } from 'three';

export function createPostProcessing(
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  return composer;
}
