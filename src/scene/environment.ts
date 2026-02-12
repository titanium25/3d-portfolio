import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import type { Scene } from "three";
import type { WebGLRenderer } from "three";

const HDRI_URL =
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr";

export function loadEnvironment(
  scene: Scene,
  renderer: WebGLRenderer,
): Promise<void> {
  return new Promise((resolve) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const loader = new RGBELoader();
    loader.load(
      HDRI_URL,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        scene.environment = envMap;
        texture.dispose();
        pmremGenerator.dispose();
        resolve();
      },
      undefined,
      () => {
        pmremGenerator.dispose();
        resolve();
      },
    );
  });
}
