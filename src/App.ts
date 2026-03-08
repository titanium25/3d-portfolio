import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createScene } from "./scene/createScene";
import { createGround } from "./scene/createGround";
import { createSpawnPad } from "./scene/createSpawnPad";
import { createArenaProps } from "./scene/createArenaProps";
import { boostEmissive, restoreEmissive } from "./scene/emissiveUtils";
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
  isStopCompleted,
  pulseGateOnUnlock,
} from "./scene/timeline";
import { TIMELINE_STOPS } from "./scene/timeline/timelineConfig";
import { initKeyboard, isKeyPressed } from "./controls/keyboardController";
import {
  checkProximityAndInteract,
  getNearbyStop,
  INTERACT_RADIUS,
} from "./collision/checkCollisions";
import { computeProximityFactor } from "./collision/proximityUtils";
import { openTransition, isTransitionOpen } from "./ui/transition";
import { updateProximityUI, hideProximity } from "./ui/proximityUI";
import { initGatePanel, updateGatePanel } from "./ui/gatePanel";
import {
  createProgressIndicator,
  setTotalAssets,
  assetLoaded,
  hideProgressIndicator,
  preloadImages,
} from "./ui/loadingScreen";
import { initCVPanel } from "./ui/cvPanel";
import { initGateUnlockAnimation, playCinematicUnlock } from "./ui/gateUnlockAnimation";
import { startOnboarding, updateOnboarding } from "./ui/onboardingHints";
import {
  initWorldTooltip,
  registerTooltipTarget,
  updateWorldTooltip,
} from "./ui/worldTooltip";
import { markDiscovered } from "./ui/discoveryTracker";
import type { Stop } from "./scene/types";

const CAMERA_HEIGHT = 3;
const CAMERA_DISTANCE = 6;
const CAMERA_OFFSET_X = 3;
const CAMERA_LERP = 0.045;

// Post-wave: smooth transition from wave camera to gameplay camera
const POST_WAVE_DURATION = 3.0; // seconds for the transition

export async function initApp(container: HTMLElement): Promise<void> {
  // ── Collect all images that need preloading ──────────────────────────────
  // Timeline stop logos + scene photos (derived from config so it stays in sync)
  const timelineImages: string[] = TIMELINE_STOPS.flatMap((s) => [
    s.logo,
    s.image,
  ]).filter((p): p is string => Boolean(p));
  // CV panel cover + avatar, and the intro character photo
  const miscImages: string[] = [
    "/img/alex-office.png",
    "/img/alex-headshot.png",
    "/img/Screenshot_20260209_175259_Photos-removebg-preview.png",
  ];
  const ALL_IMAGES = [...timelineImages, ...miscImages];

  // Calculate total assets: Player (5) + Dog (2) + Portal (1) + ArenaProps (3) + images
  const PLAYER_ASSETS = 5; // idle model + idle anim + walk + run + wave
  const DOG_ASSETS = 2; // model + walk animation
  const PORTAL_ASSETS = 1; // portal GLB (loaded once, cloned per checkpoint)
  const ARENA_PROP_ASSETS = 3; // LEGO, kettlebell, framed drawing
  const IMAGE_ASSETS = ALL_IMAGES.length;
  const TOTAL_ASSETS =
    PLAYER_ASSETS + DOG_ASSETS + PORTAL_ASSETS + ARENA_PROP_ASSETS + IMAGE_ASSETS;

  // Set total and create elegant progress indicator
  setTotalAssets(TOTAL_ASSETS);
  createProgressIndicator();
  initCVPanel();
  initGatePanel();
  initGateUnlockAnimation();
  initWorldTooltip();

  // ── Scene (synchronous — no awaits needed) ──────────────────────────────
  const { scene, camera, renderer, composer } = createScene(container);
  const ground = createGround(scene);
  const spawnPad = createSpawnPad(scene, {
    onBikeLoaded: (group) => {
      registerTooltipTarget({
        object: group,
        title: "BMW S1000RR · 2014",
        subtitle: "199hp of weekend therapy 🏍️",
        yOffset: 1.2,
        discoveryId: "bmw",
        onClick: () => markDiscovered("bmw"),
        onHoverStart: () => {
          group.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (!mat?.emissive) return;
            if (child.userData._origEmissive === undefined) {
              child.userData._origEmissive = mat.emissiveIntensity;
            }
            mat.emissiveIntensity = 0.5;
          });
        },
        onHoverEnd: () => {
          group.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat?.emissive && child.userData._origEmissive !== undefined) {
              mat.emissiveIntensity = child.userData._origEmissive;
            }
          });
        },
      });
    },
    onMtbLoaded: (group) => {
      registerTooltipTarget({
        object: group,
        title: "Friday Morning Ritual",
        subtitle: "80km before the world wakes up 🚴",
        yOffset: 1.0,
        discoveryId: "mtb",
        onClick: () => markDiscovered("mtb"),
      });
    },
  });

  // ── Monogram tooltip (synchronous — mesh is ready immediately) ───────────
  registerTooltipTarget({
    object: spawnPad.monogramMesh,
    title: "Alexander Lazarovich",
    subtitle: "Ra'anana, Israel · Full-stack engineer",
    yOffset: 0.3,
    discoveryId: "monogram",
    onClick: () => markDiscovered("monogram"),
    onHoverStart: () => {
      const mat = spawnPad.monogramMesh.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.45;
    },
    onHoverEnd: () => {
      const mat = spawnPad.monogramMesh.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.10;
    },
  });

  // ── Intro starts IMMEDIATELY — user sees text from frame one ─────────────
  // Character is injected later via intro.setCharacter() once the model loads.
  const intro = new IntroSequence(camera, scene);
  console.log("🎬 Intro started!");

  // ── Stop configuration ────────────────────────────────────────────────────
  const ENABLE_MOCK_STOPS = false;
  const ENABLE_TIMELINE_STOPS = true;
  const mockStops: Stop[] = ENABLE_MOCK_STOPS ? createStops(scene) : [];

  // Bike collision stops — groups are synchronously available from createSpawnPad.
  // stopCollision.ts only reads stop.group, so the cast is safe at runtime.
  const bikeStop = { group: spawnPad.bikeCollisionGroup } as unknown as Stop;
  const mtbStop  = { group: spawnPad.mtbCollisionGroup  } as unknown as Stop;

  // Mutable arrays — populated as async loads complete, read each frame
  let character: PlayerCharacter | null = null;
  let dog: DogCompanion | null = null;
  let timelineStops: Stop[] = [];
  let collisionStops: Stop[] = [...mockStops, bikeStop, mtbStop];
  // Timeline gates use proximity-based floating panel; only building stops use E-key
  const interactionStops: Stop[] = mockStops;
  let allAssetsLoaded = false;

  // ── Load all assets in parallel while the intro plays ────────────────────
  // 1. Images — start first, network-only
  const imagePromise = preloadImages(ALL_IMAGES, assetLoaded);

  // 2. Player character
  const characterPromise = PlayerCharacter.create(scene, assetLoaded).then(
    (c) => {
      character = c;
      intro.setCharacter(c); // unblocks text→pullback transition
      return c;
    },
  );

  // 3. Dog — needs character.group, so chain after character
  const dogPromise = characterPromise.then((c) =>
    DogCompanion.create(scene, c.group, assetLoaded).then((d) => {
      dog = d;

      // SkinnedMesh raycasting is unreliable — bounding spheres are computed from
      // the bind-pose geometry and don't track bone-deformed vertices. Use an
      // invisible proxy sphere parented to the dog's group instead.
      const dogProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      dogProxy.position.y = 0.3; // mid-body height for the dog
      d.group.add(dogProxy);

      registerTooltipTarget({
        object: dogProxy,
        title: "Meny 🐾",
        subtitle: "Alaskan Malamute · Chief Morale Officer",
        yOffset: 0.8,
        discoveryId: "meny",
        onClick: () => markDiscovered("meny"),
        onHoverStart: () => d.setExcited(true),
        onHoverEnd: () => d.setExcited(false),
      });
      return d;
    }),
  );

  // 4. Timeline stops (portal GLB)
  const timelinePromise = ENABLE_TIMELINE_STOPS
    ? createTimelineStops(scene, assetLoaded).then((stops) => {
        timelineStops = stops;
        collisionStops = [...mockStops, bikeStop, mtbStop, ...stops];
      })
    : Promise.resolve();

  // 5. Arena props (LEGO, kettlebell, framed drawing)
  const arenaPropsPromise = createArenaProps(scene, assetLoaded).then(
    (arenaProps) => {
      registerTooltipTarget({
        object: arenaProps.legoGroup,
        title: "LEGO Collection",
        subtitle: "Cities with the twins · click to discover",
        yOffset: 0.6,
        discoveryId: "lego",
        onClick: () => markDiscovered("lego"),
        onHoverStart: () => boostEmissive(arenaProps.legoGroup, 0.5),
        onHoverEnd: () => restoreEmissive(arenaProps.legoGroup),
      });
      registerTooltipTarget({
        object: arenaProps.kettlebellGroup,
        title: "32kg Cast Iron",
        subtitle: "5 days a week · click to discover",
        yOffset: 0.5,
        discoveryId: "gym",
        onClick: () => markDiscovered("gym"),
        onHoverStart: () => boostEmissive(arenaProps.kettlebellGroup, 0.5),
        onHoverEnd: () => restoreEmissive(arenaProps.kettlebellGroup),
      });
      registerTooltipTarget({
        object: arenaProps.drawingGroup,
        title: "The Masterpiece",
        subtitle: "Tomer & Alma · click to discover",
        yOffset: 0.7,
        discoveryId: "twins",
        onClick: () => markDiscovered("twins"),
        onHoverStart: () => boostEmissive(arenaProps.drawingGroup, 0.5),
        onHoverEnd: () => restoreEmissive(arenaProps.drawingGroup),
      });
      return arenaProps;
    },
  );

  Promise.all([
    imagePromise,
    characterPromise,
    dogPromise,
    timelinePromise,
    arenaPropsPromise,
  ])
    .then(() => {
      allAssetsLoaded = true;
      console.log("📦 All assets loaded!");
    })
    .catch((err) => console.error("Asset loading error:", err));

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
    if (character) {
      html += buildSection("Player", character.getDebugInfo(), "#7cf8a4");
    }

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

      if (devMode && character) {
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

    // When intro just ended: dog goes behind character in idle + start keyboard tutorial
    if (wasIntroActive && !introActive) {
      if (dog) dog.resetToIdleBehindPlayer();
      startOnboarding();
    }
    wasIntroActive = introActive;

    if (introActive) {
      if (character) character.updateMixer(deltaSec);
      if (dog) dog.updateIdleOnly(deltaSec);
    } else if (!isTransitionOpen()) {
      if (character) character.update(deltaSec, collisionStops);
      if (dog) dog.update(deltaSec, collisionStops);
      updateOnboarding(deltaSec);
    }

    if (character) {
      if (ENABLE_MOCK_STOPS) {
        updateStopAnimations(collisionStops, time * 0.001);
        updateStopLighting(collisionStops, character.group.position);
      }
      if (ENABLE_TIMELINE_STOPS) {
        updateTimelineAnimations(timelineStops, time * 0.001);
        updateTimelineLighting(timelineStops, character.group.position);
      }
    }
    ground.update(time * 0.001);
    spawnPad.update(time * 0.001);

    if (devMode) {
      orbitControls.update();
      updateDevHUD();
    } else if (!introActive && !isTransitionOpen() && character) {
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

    if (!introActive && character) {
      // Timeline gates: proximity-based floating panel + E-key / click to open cinematic overlay
      const nearbyGate = getNearbyStop(character.group, timelineStops);
      if (nearbyGate) {
        const factor = computeProximityFactor(nearbyGate.distance);
        const canInteract = nearbyGate.distance < INTERACT_RADIUS;
        const openGateOverlay = () => {
          const char = character;
          if (!isTransitionOpen() && char) {
            const stopId = nearbyGate.stop.data.id;
            const isFirstUnlock = markStopCompleted(stopId);
            const worldPos = new THREE.Vector3();
            nearbyGate.stop.group.getWorldPosition(worldPos);

            // Fire cinematic unlock on activation (E press), not on close
            if (isFirstUnlock) {
              const entry = TIMELINE_STOPS.find((s) => s.id === stopId);
              const company = entry
                ? entry.title.split(" \u2014 ")[0]
                : "";
              const year = entry ? entry.year : 0;

              pulseGateOnUnlock(stopId);
              const gatePos = new THREE.Vector3(
                worldPos.x,
                1.5,
                worldPos.z,
              );
              gatePos.project(camera);
              const screenX =
                (gatePos.x * 0.5 + 0.5) * window.innerWidth;
              const screenY =
                (-gatePos.y * 0.5 + 0.5) * window.innerHeight;
              const completed = TIMELINE_STOPS.filter((s) =>
                isStopCompleted(s.id),
              ).length;

              setTimeout(() => {
                playCinematicUnlock(
                  screenX,
                  screenY,
                  stopId,
                  year,
                  company,
                  completed,
                  TIMELINE_STOPS.length,
                );
              }, 600);
            }

            openTransition(
              nearbyGate.stop.data,
              worldPos,
              camera,
              undefined,
              () => ({
                position: new THREE.Vector3(
                  char.group.position.x + CAMERA_OFFSET_X,
                  CAMERA_HEIGHT,
                  char.group.position.z + CAMERA_DISTANCE,
                ),
                lookAt: new THREE.Vector3(
                  char.group.position.x + CAMERA_OFFSET_X * 0.3,
                  0.5,
                  char.group.position.z + CAMERA_DISTANCE * 0.2,
                ),
              }),
            );
          }
        };
        updateGatePanel(nearbyGate.stop.data, factor, canInteract, openGateOverlay);
        if (canInteract && eJustPressed) {
          openGateOverlay();
        }
      } else {
        updateGatePanel(null, 0);
      }

      // Building stops: E-key interaction with cinematic overlay
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
          const char = character;
          if (!char) return;
          hideProximity();
          markStopCompleted(stop.data.id);
          const worldPos = new THREE.Vector3();
          stop.group.getWorldPosition(worldPos);
          openTransition(stop.data, worldPos, camera, undefined, () => ({
            position: new THREE.Vector3(
              char.group.position.x + CAMERA_OFFSET_X,
              CAMERA_HEIGHT,
              char.group.position.z + CAMERA_DISTANCE,
            ),
            lookAt: new THREE.Vector3(
              char.group.position.x + CAMERA_OFFSET_X * 0.3,
              0.5,
              char.group.position.z + CAMERA_DISTANCE * 0.2,
            ),
          }));
        },
      );
    }

    updateWorldTooltip(camera, renderer.domElement);
    composer.render();
  }

  animate(performance.now());
}
