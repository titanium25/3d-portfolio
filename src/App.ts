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
  initMobileControls,
  showMobileInteract,
  hideMobileInteract,
} from "./ui/mobileControls";
import { initMobileTapHint, updateMobileTapHint } from "./ui/mobileTapHint";
import {
  initWorldTooltip,
  registerTooltipTarget,
  updateWorldTooltip,
} from "./ui/worldTooltip";
import { markDiscovered, getDiscoveryCount } from "./ui/discoveryTracker";
import {
  initDevPanel,
  updateDevPanel,
  isDevPanelVisible,
} from "./ui/devPanel";
import {
  registerDiscoverableBeacon,
  updateDiscoverableBeacons,
} from "./scene/discoverableGlow";
import { logPerfDiagnostics } from "./utils/perfDiagnostics";
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
  initMobileControls();
  initMobileTapHint();

  // ── Scene (synchronous — no awaits needed) ──────────────────────────────
  const { scene, camera, renderer, render: renderScene } = createScene(container);
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
      registerDiscoverableBeacon({
        object: group, discoveryId: "bmw",
        radius: 0.7, count: 5, rise: 0.9,
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
      registerDiscoverableBeacon({
        object: group, discoveryId: "mtb",
        radius: 0.6, count: 5, rise: 0.8,
      });
    },
  });

  // ── Monogram tooltip (synchronous — mesh is ready immediately) ───────────
  registerTooltipTarget({
    object: ground.monogramMesh,
    title: "Alexander Lazarovich",
    subtitle: "Ra'anana, Israel · Full-stack engineer",
    yOffset: 0.3,
    discoveryId: "monogram",
    onClick: () => markDiscovered("monogram"),
    onHoverStart: () => {
      const mat = ground.monogramMesh.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.45;
    },
    onHoverEnd: () => {
      const mat = ground.monogramMesh.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.10;
    },
  });
  registerDiscoverableBeacon({
    object: ground.monogramMesh, discoveryId: "monogram",
    radius: 0.5, count: 3, rise: 0.4,
  });

  // Intro will be created after hero load promise; placeholder for reference
  let intro: IntroSequence;

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

  // ── Load all assets ──────────────────────────────────────────────────────
  // 1. Images — start first, network-only
  const imagePromise = preloadImages(ALL_IMAGES, assetLoaded);

  // 2. Player character
  const characterPromise = PlayerCharacter.create(scene, assetLoaded).then(
    (c) => {
      character = c;
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
        subtitle: "Named after Manny from Ice Age · Chief Morale Officer",
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
      registerDiscoverableBeacon({
        object: arenaProps.legoGroup, discoveryId: "lego",
        radius: 0.4, count: 4, rise: 0.5,
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
      registerDiscoverableBeacon({
        object: arenaProps.kettlebellGroup, discoveryId: "gym",
        radius: 0.4, count: 4, rise: 0.5,
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
      registerDiscoverableBeacon({
        object: arenaProps.drawingGroup, discoveryId: "twins",
        radius: 0.5, count: 4, rise: 0.6,
      });
      return arenaProps;
    },
  );

  // Intro: shows loading text on black screen until ALL assets are ready,
  // then hides the progress bar before the black overlay ever fades.
  const heroReadyPromise = Promise.all([
    imagePromise,
    characterPromise,
    dogPromise,
    timelinePromise,
    arenaPropsPromise,
  ]).then(async () => {
    if (character) intro.setCharacter(character);
    await hideProgressIndicator(); // "Ready" → fade out → THEN reveal 3D world
  }).catch((err) => console.error("Asset loading error:", err));

  intro = new IntroSequence(camera, scene, null, {
    heroReady: heroReadyPromise,
  });

  initKeyboard();
  let lastEPressed = false;
  let lastTime = performance.now();

  // ── Dev Mode: free camera with OrbitControls + debug HUD ──
  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enabled = false;
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.minDistance = 0.5;
  orbitControls.maxDistance = 120;
  orbitControls.maxPolarAngle = Math.PI; // allow full vertical range in dev mode
  orbitControls.screenSpacePanning = true; // pan parallel to screen, not world floor
  // Left-click/single-touch = pan  ·  right-click/two-touch = orbit
  orbitControls.mouseButtons = {
    LEFT:   THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT:  THREE.MOUSE.ROTATE,
  };
  orbitControls.touches = {
    ONE: THREE.TOUCH.PAN,
    TWO: THREE.TOUCH.DOLLY_ROTATE,
  };

  // Free-camera WASD velocity (dev mode only)
  const freeCamVel = new THREE.Vector3();
  const _camDir    = new THREE.Vector3();
  const _camRight  = new THREE.Vector3();
  const _up        = new THREE.Vector3(0, 1, 0);

  initDevPanel({
    camera,
    renderer,
    getCharacter: () => character,
    getDog: () => dog,
    getCompletedGateCount: () => TIMELINE_STOPS.filter((s) => isStopCompleted(s.id)).length,
    getDiscoveryCount,
    getOrbitTarget: () => orbitControls.target,
    setCameraLookAt: (camPos, target) => {
      camera.position.set(...camPos);
      orbitControls.target.set(...target);
      freeCamVel.set(0, 0, 0);
      orbitControls.update();
    },
  });

  // Sync orbit controls whenever dev panel visibility changes
  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote") {
      // visibility has already been toggled by devPanel's own keydown listener
      // (both listeners share the same event, so read state after a microtask)
      queueMicrotask(() => {
        const nowVisible = isDevPanelVisible();
        orbitControls.enabled = nowVisible;
        if (nowVisible && character) {
          const p = character.group.position;
          orbitControls.target.set(p.x, 0.5, p.z);
          orbitControls.update();
        } else {
          freeCamVel.set(0, 0, 0);
        }
      });
    }
  });

  // Track wave → gameplay camera transition
  let wasWaving = false;
  let wasIntroActive = true; // intro starts active
  let postWaveElapsed = POST_WAVE_DURATION; // Start "complete" so no transition on init
  let postWaveStartPos = new THREE.Vector3();
  let postWaveStartLookAt = new THREE.Vector3();
  
  function animate(time: number): void {
    requestAnimationFrame((t) => animate(t));

    const deltaSec = (time - lastTime) / 1000;
    lastTime = time;

    const introActive = intro.update(deltaSec);

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
    if (character) {
      updateDiscoverableBeacons(time * 0.001, character.group.position);
    }

    if (isDevPanelVisible()) {
      // ── Free camera WASD movement ────────────────────────────────────────
      const sprint   = isKeyPressed("ShiftLeft") || isKeyPressed("ShiftRight");
      const CAM_ACCEL = sprint ? 0.22 : 0.07;
      const CAM_DECEL = 0.82;

      camera.getWorldDirection(_camDir);
      _camDir.y = 0;
      if (_camDir.lengthSq() > 0.0001) _camDir.normalize();
      _camRight.crossVectors(_camDir, _up).normalize();

      if (isKeyPressed("KeyW") || isKeyPressed("ArrowUp"))    freeCamVel.addScaledVector(_camDir,  CAM_ACCEL);
      if (isKeyPressed("KeyS") || isKeyPressed("ArrowDown"))  freeCamVel.addScaledVector(_camDir, -CAM_ACCEL);
      if (isKeyPressed("KeyA") || isKeyPressed("ArrowLeft"))  freeCamVel.addScaledVector(_camRight, -CAM_ACCEL);
      if (isKeyPressed("KeyD") || isKeyPressed("ArrowRight")) freeCamVel.addScaledVector(_camRight,  CAM_ACCEL);
      if (isKeyPressed("KeyE")) freeCamVel.y += CAM_ACCEL;
      if (isKeyPressed("KeyQ")) freeCamVel.y -= CAM_ACCEL;

      freeCamVel.multiplyScalar(CAM_DECEL);

      if (freeCamVel.lengthSq() > 0.00001) {
        orbitControls.target.add(freeCamVel);
        camera.position.add(freeCamVel);
      }

      orbitControls.update();
      updateDevPanel();
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
        // Hold camera at intro closeup position (character-relative)
        const cp = character.group.position;
        camera.position.set(cp.x + 1.5, 1.8, cp.z + 3);
        camera.lookAt(cp.x, 0.5, cp.z);
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
        updateGatePanel(nearbyGate.stop.data, factor, canInteract, openGateOverlay, {
          stopIndex: TIMELINE_STOPS.findIndex((s) => s.id === nearbyGate.stop.data.id),
          totalStops: TIMELINE_STOPS.length,
          isCompleted: isStopCompleted(nearbyGate.stop.data.id),
        });
        if (canInteract) {
          showMobileInteract(openGateOverlay);
        } else {
          hideMobileInteract();
        }
        if (canInteract && eJustPressed) {
          openGateOverlay();
        }
      } else {
        updateGatePanel(null, 0);
        hideMobileInteract();
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
    if (character) {
      updateMobileTapHint(camera, character.group.position, renderer.domElement);
    }
    renderScene();
    logPerfDiagnostics(renderer, scene);
  }

  animate(performance.now());
}
