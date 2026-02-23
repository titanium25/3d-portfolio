import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createScene } from "./scene/createScene";
import { createGround } from "./scene/createGround";
import { createSpawnPad } from "./scene/createSpawnPad";
import { PlayerCharacter, DogCompanion } from "./scene/characters";
import { IntroSequence } from "./scene/introSequence";
import {
  createStops,
  updateStopAnimations,
  updateStopLighting,
} from "./scene/createStops";
import {
  createTimelineStops,
  updateTimelineAnimations,
  updateTimelineLighting,
  markStopCompleted,
} from "./scene/timeline";
import { initKeyboard, isKeyPressed } from "./controls/keyboardController";
import { checkProximityAndInteract } from "./collision/checkCollisions";
import { openTransition, isTransitionOpen } from "./ui/transition";
import { updateProximityUI, hideProximity } from "./ui/proximityUI";
import {
  createProgressIndicator,
  setTotalAssets,
  assetLoaded,
  hideProgressIndicator,
} from "./ui/loadingScreen";
import type { Stop } from "./scene/types";

const CAMERA_HEIGHT = 3;
const CAMERA_DISTANCE = 6;
const CAMERA_OFFSET_X = 3;
const CAMERA_LERP = 0.045;

// Post-wave: smooth transition from wave camera to gameplay camera
const POST_WAVE_DURATION = 3.0; // seconds for the transition

export async function initApp(container: HTMLElement): Promise<void> {
  // Calculate total assets: Player (5) + Dog (2) + Portal (1) = 8
  const PLAYER_ASSETS = 5; // idle model + idle anim + walk + run + wave
  const DOG_ASSETS = 2; // model + walk animation
  const PORTAL_ASSETS = 1; // portal GLB (loaded once, cloned per checkpoint)
  const TOTAL_ASSETS = PLAYER_ASSETS + DOG_ASSETS + PORTAL_ASSETS;

  // Set total and create elegant progress indicator
  setTotalAssets(TOTAL_ASSETS);
  createProgressIndicator();

  const { scene, camera, renderer, composer } = createScene(container);
  const ground = createGround(scene);
  createSpawnPad(scene);
  
  // Load character first (needed for intro sequence)
  const character = await PlayerCharacter.create(scene, assetLoaded);
  
  // Start intro sequence immediately - user sees content right away!
  const intro = new IntroSequence(camera, scene, character);
  console.log("🎬 Intro started!");
  
  // Load remaining assets in parallel with intro
  let dog: DogCompanion | null = null;
  let allAssetsLoaded = false;
  
  (async () => {
    dog = await DogCompanion.create(scene, character.group, assetLoaded);
    allAssetsLoaded = true;
    console.log("📦 All assets loaded!");
  })();

  const ENABLE_MOCK_STOPS = false;
  const ENABLE_TIMELINE_STOPS = true;

  const mockStops: Stop[] = ENABLE_MOCK_STOPS ? createStops(scene) : [];
  const timelineStops: Stop[] = ENABLE_TIMELINE_STOPS
    ? await createTimelineStops(scene, assetLoaded)
    : [];
  const collisionStops: Stop[] = [...mockStops, ...timelineStops];
  const interactionStops: Stop[] = collisionStops;
  initKeyboard();
  let lastEPressed = false;
  let lastTime = performance.now();

  // ── Dev Mode: free camera with OrbitControls + debug HUD ──
  let devMode = false;
  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enabled = false;
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.minDistance = 1;
  orbitControls.maxDistance = 60;
  orbitControls.maxPolarAngle = Math.PI * 0.85;

  // ── Debug HUD panel ──
  const devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "320px",
    maxHeight: "100vh",
    overflowY: "auto",
    background: "rgba(10, 10, 18, 0.88)",
    color: "#e0e0e0",
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontSize: "11px",
    lineHeight: "1.5",
    padding: "10px 14px",
    zIndex: "9999",
    pointerEvents: "none",
    display: "none",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(8px)",
    boxSizing: "border-box",
  });
  document.body.appendChild(devPanel);

  // FPS tracking
  let fpsFrames = 0;
  let fpsLastTime = performance.now();
  let fpsDisplay = 0;

  function buildSection(title: string, data: Record<string, string>, color: string): string {
    let html = `<div style="color:${color};font-weight:bold;font-size:12px;margin-top:8px;margin-bottom:3px;border-bottom:1px solid ${color}33;padding-bottom:2px">${title}</div>`;
    for (const [key, val] of Object.entries(data)) {
      html += `<div style="display:flex;justify-content:space-between"><span style="color:#888">${key}</span><span style="color:#ccc">${val}</span></div>`;
    }
    return html;
  }

  function updateDevHUD(): void {
    // FPS
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLastTime >= 500) {
      fpsDisplay = Math.round((fpsFrames * 1000) / (now - fpsLastTime));
      fpsFrames = 0;
      fpsLastTime = now;
    }

    const info = renderer.info;
    const cp = camera.position;

    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">` +
      `<span style="color:#ff3c3c;font-weight:bold;font-size:13px;letter-spacing:1px">DEV MODE</span>` +
      `<span style="color:#6f6;font-weight:bold;font-size:13px">${fpsDisplay} FPS</span></div>`;

    // Scene
    html += buildSection("Scene", {
      triangles: info.render.triangles.toLocaleString(),
      "draw calls": String(info.render.calls),
      geometries: String(info.memory.geometries),
      textures: String(info.memory.textures),
    }, "#7cacf8");

    // Camera
    html += buildSection("Camera", {
      position: `${cp.x.toFixed(2)}, ${cp.y.toFixed(2)}, ${cp.z.toFixed(2)}`,
      rotation: `${THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(camera.rotation.z).toFixed(1)}°`,
      fov: `${camera.fov.toFixed(0)}°`,
    }, "#f8c87c");

    // Player
    const playerDebug = character.getDebugInfo();
    html += buildSection("Player", playerDebug, "#7cf8a4");

    // Dog
    if (dog) {
      const dogDebug = dog.getDebugInfo();
      html += buildSection("Dog", dogDebug, "#c87cf8");
    }

    // Controls hint
    html += `<div style="margin-top:10px;color:#555;font-size:10px;text-align:center;border-top:1px solid #ffffff10;padding-top:6px">` +
      `drag to rotate · scroll to zoom · \` to exit</div>`;

    devPanel.innerHTML = html;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote") {
      devMode = !devMode;
      orbitControls.enabled = devMode;
      devPanel.style.display = devMode ? "block" : "none";

      if (devMode) {
        const p = character.group.position;
        orbitControls.target.set(p.x, 0.5, p.z);
        orbitControls.update();
      }
    }
  });

  // Track wave → gameplay camera transition
  let wasWaving = false;
  let wasIntroActive = true; // intro starts active
  let postWaveElapsed = POST_WAVE_DURATION; // Start "complete" so no transition on init
  let postWaveStartPos = new THREE.Vector3();
  let postWaveStartLookAt = new THREE.Vector3();
  
  // Track when to hide progress indicator
  let progressHidden = false;

  function animate(time: number): void {
    requestAnimationFrame((t) => animate(t));

    const deltaSec = (time - lastTime) / 1000;
    lastTime = time;

    const introActive = intro.update(deltaSec);

    // Hide progress indicator when BOTH intro is done AND all assets are loaded
    if (!progressHidden && !introActive && allAssetsLoaded) {
      console.log("🎉 Everything ready! Hiding progress indicator...");
      hideProgressIndicator();
      progressHidden = true;
    }

    // When intro just ended: dog goes behind character in idle
    if (wasIntroActive && !introActive && dog) {
      dog.resetToIdleBehindPlayer();
    }
    wasIntroActive = introActive;

    if (introActive) {
      character.updateMixer(deltaSec);
      if (dog) dog.updateIdleOnly(deltaSec);
    } else if (!isTransitionOpen()) {
      character.update(deltaSec, collisionStops);
      if (dog) dog.update(deltaSec, collisionStops);
    }

    if (ENABLE_MOCK_STOPS) {
      updateStopAnimations(collisionStops, time * 0.001);
      updateStopLighting(collisionStops, character.group.position);
    }
    if (ENABLE_TIMELINE_STOPS) {
      updateTimelineAnimations(timelineStops, time * 0.001);
      updateTimelineLighting(timelineStops, character.group.position);
    }
    ground.update(time * 0.001);

    if (devMode) {
      orbitControls.update();
      updateDevHUD();
    } else if (!introActive && !isTransitionOpen()) {
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
        interactionStops,
        eJustPressed,
        isTransitionOpen()
          ? () => {}
          : (stop, distance) =>
              updateProximityUI(stop.data, stop.group, distance, camera),
        isTransitionOpen() ? () => {} : hideProximity,
        (stop: Stop) => {
          hideProximity();
          markStopCompleted(stop.data.id);
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
