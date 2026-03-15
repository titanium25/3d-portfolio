import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { assetPath } from '../utils/assetPath';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(assetPath('/draco/'));

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

export { gltfLoader };
