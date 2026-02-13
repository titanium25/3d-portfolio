import * as THREE from "three";
import { createScene } from "./scene/createScene";
import { createGround } from "./scene/createGround";
import { CharacterController } from "./scene/CharacterController";
import { IntroSequence } from "./scene/introSequence";
import {
  createStops,
  updateStopAnimations,
  updateStopLighting,
} from "./scene/createStops";
import { initKeyboard, isKeyPressed } from "./controls/keyboardController";
import { checkProximityAndInteract } from "./collision/checkCollisions";
import { openTransition, isTransitionOpen } from "./ui/transition";
import { updateProximityUI, hideProximity } from "./ui/proximityUI";
import {
  showLoadingScreen,
  assetLoaded,
  hideLoadingScreen,
} from "./ui/loadingScreen";
import type { Stop } from "./scene/types";

const CAMERA_HEIGHT = 3;
const CAMERA_DISTANCE = 5;
const CAMERA_OFFSET_X = 3;
const CAMERA_LERP = 0.045;

// Post-wave: smooth transition from wave camera to gameplay camera
const POST_WAVE_DURATION = 3.0; // seconds for the transition

export async function initApp(container: HTMLElement): Promise<void> {
  showLoadingScreen();

  const { scene, camera, composer } = createScene(container);
  createGround(scene);
  const character = await CharacterController.create(scene, assetLoaded);
  const stops = createStops(scene);

  initKeyboard();

  // Create intro before hiding loading screen so overlay is ready
  const intro = new IntroSequence(camera, scene, character);

  await hideLoadingScreen();
  let lastEPressed = false;
  let lastTime = performance.now();

  // Track wave → gameplay camera transition
  let wasWaving = false;
  let postWaveElapsed = POST_WAVE_DURATION; // Start "complete" so no transition on init
  let postWaveStartPos = new THREE.Vector3();
  let postWaveStartLookAt = new THREE.Vector3();

  function animate(time: number): void {
    requestAnimationFrame((t) => animate(t));

    const deltaSec = (time - lastTime) / 1000;
    lastTime = time;

    const introActive = intro.update(deltaSec);

    if (introActive) {
      character.updateMixer(deltaSec);
    } else if (!isTransitionOpen()) {
      character.update(deltaSec, stops);
    }

    updateStopAnimations(stops, time * 0.001);
    updateStopLighting(stops, character.group.position);

    if (!introActive && !isTransitionOpen()) {
      const isWaving = character.isWaving();

      // Detect when wave just ended → start smooth transition
      if (wasWaving && !isWaving) {
        postWaveElapsed = 0;
        postWaveStartPos.copy(camera.position);
        postWaveStartLookAt.set(
          character.group.position.x,
          character.group.position.y + 0.3,
          character.group.position.z,
        );
      }
      wasWaving = isWaving;

      if (isWaving) {
        // Hold camera on character during wave (intro already placed it here)
        camera.position.set(0, 1.7, 4.0);
        camera.lookAt(
          character.group.position.x,
          0.3,
          character.group.position.z,
        );
      } else if (postWaveElapsed < POST_WAVE_DURATION) {
        // Smooth, natural transition from wave camera to gameplay camera
        postWaveElapsed += deltaSec;
        const t = Math.min(1, postWaveElapsed / POST_WAVE_DURATION);
        // Ease-in-out for natural acceleration and deceleration
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        const gameplayPos = new THREE.Vector3(
          character.group.position.x + CAMERA_OFFSET_X,
          CAMERA_HEIGHT,
          character.group.position.z + CAMERA_DISTANCE,
        );
        const gameplayLookAt = new THREE.Vector3(
          character.group.position.x + CAMERA_OFFSET_X * 0.3,
          0.0,
          character.group.position.z + CAMERA_DISTANCE * 0.2,
        );

        camera.position.lerpVectors(postWaveStartPos, gameplayPos, ease);
        const currentLookAt = postWaveStartLookAt
          .clone()
          .lerp(gameplayLookAt, ease);
        camera.lookAt(currentLookAt);
      } else {
        // Normal gameplay camera
        const targetX = character.group.position.x + CAMERA_OFFSET_X;
        const targetZ = character.group.position.z + CAMERA_DISTANCE;
        camera.position.x += (targetX - camera.position.x) * CAMERA_LERP;
        camera.position.y += (CAMERA_HEIGHT - camera.position.y) * CAMERA_LERP;
        camera.position.z += (targetZ - camera.position.z) * CAMERA_LERP;
        const lookX = character.group.position.x + CAMERA_OFFSET_X * 0.3;
        const lookZ = character.group.position.z + CAMERA_DISTANCE * 0.2;
        camera.lookAt(lookX, 0.0, lookZ);
      }
    }

    const ePressed = isKeyPressed("KeyE");
    const eJustPressed = ePressed && !lastEPressed;
    lastEPressed = ePressed;

    if (!introActive) {
      checkProximityAndInteract(
        character.group,
        stops,
        eJustPressed,
        isTransitionOpen()
          ? () => {}
          : (stop, distance) =>
              updateProximityUI(stop.data, stop.group, distance, camera),
        isTransitionOpen() ? () => {} : hideProximity,
        (stop: Stop) => {
          hideProximity();
          const worldPos = new THREE.Vector3();
          stop.group.getWorldPosition(worldPos);
          openTransition(stop.data, worldPos, camera, undefined, () => ({
            position: new THREE.Vector3(
              character.group.position.x + CAMERA_OFFSET_X,
              CAMERA_HEIGHT,
              character.group.position.z + CAMERA_DISTANCE,
            ),
            lookAt: new THREE.Vector3(
              character.group.position.x + CAMERA_OFFSET_X * 0.3,
              0.5,
              character.group.position.z + CAMERA_DISTANCE * 0.2,
            ),
          }));
        },
      );
    }

    composer.render();
  }

  animate(performance.now());
}
