import * as THREE from "three";
import type { PerspectiveCamera, Scene } from "three";
import type { PlayerCharacter } from "./characters";

const INTRO_IMAGE_PATH =
  "/img/Screenshot_20260209_175259_Photos-removebg-preview.png";
const INTRO_LINES = [
  "Hi, I'm Alex.",
  "Welcome to Software City.",
  "Explore my work.",
];

const FADE_IN_DURATION = 1;
const HOLD_DURATION = 1.5;
const FADE_OUT_DURATION = 0.8;
const LINE_DURATION = FADE_IN_DURATION + HOLD_DURATION + FADE_OUT_DURATION;

export interface IntroState {
  phase: "closeup" | "text" | "pullback" | "hint" | "complete";
  elapsed: number;
}

export class IntroSequence {
  private state: IntroState = { phase: "closeup", elapsed: 0 };
  private fadeOverlay: HTMLElement;
  private cinematicWindow: HTMLElement;
  private imageContainer: HTMLElement;
  private lineEl: HTMLElement;
  private hintContainer: HTMLElement;
  private camera: PerspectiveCamera;
  private scene: Scene;
  private character: PlayerCharacter;
  private closeupLight: THREE.SpotLight | null = null;
  private isComplete = false;

  constructor(
    camera: PerspectiveCamera,
    scene: Scene,
    character: PlayerCharacter,
  ) {
    this.camera = camera;
    this.scene = scene;
    this.character = character;

    this.setupCloseupCamera();
    this.state.phase = "closeup";

    this.fadeOverlay = document.createElement("div");
    this.fadeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000000;
      z-index: 1000;
      pointer-events: none;
      opacity: 1;
      transition: opacity 1.5s ease-out;
    `;
    document.body.appendChild(this.fadeOverlay);

    this.imageContainer = document.createElement("div");
    this.imageContainer.style.cssText = `
      position: fixed;
      left: min(6vw, 56px);
      bottom: -110px;
      z-index: 1002;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease-in;
    `;
    const img = document.createElement("img");
    img.src = INTRO_IMAGE_PATH;
    img.alt = "";
    img.style.cssText = `
      display: block;
      min-height: 100vh;
      width: auto;
      object-fit: contain;
      opacity: 0.35;
      filter: grayscale(0.1) contrast(1.1) brightness(0.9);
      mix-blend-mode: lighten;
    `;
    this.imageContainer.appendChild(img);
    document.body.appendChild(this.imageContainer);

    this.cinematicWindow = document.createElement("div");
    this.cinematicWindow.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1001;
      pointer-events: none;
      background: #000000;
      opacity: 0;
      transition: opacity 0.5s ease-in;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      box-sizing: border-box;
    `;

    const textWrap = document.createElement("div");
    textWrap.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
      z-index: 2;
    `;

    this.lineEl = document.createElement("div");
    this.lineEl.style.cssText = `
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: clamp(22px, 3.5vw, 32px);
      font-weight: 500;
      color: #ffffff;
      letter-spacing: 0.12em;
      white-space: nowrap;
      opacity: 0;
    `;

    textWrap.appendChild(this.lineEl);
    this.cinematicWindow.appendChild(textWrap);
    document.body.appendChild(this.cinematicWindow);

    this.hintContainer = document.createElement("div");
    this.hintContainer.style.cssText = `
      position: fixed;
      bottom: 36px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1001;
      pointer-events: none;
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      opacity: 0;
      transition: opacity 1s ease-in;
      letter-spacing: 0.08em;
    `;
    this.hintContainer.innerHTML =
      "WASD / Arrows • Shift run • E interact • M map";
    document.body.appendChild(this.hintContainer);
  }

  update(deltaSec: number): boolean {
    if (this.isComplete) return false;

    this.state.elapsed += deltaSec;
    const t = this.state.elapsed;

    switch (this.state.phase) {
      case "closeup":
        if (t >= 0.1) {
          this.state.phase = "text";
          this.state.elapsed = 0;
          this.cinematicWindow.style.opacity = "1";
          this.imageContainer.style.opacity = "1";
        }
        break;

      case "text": {
        const totalTextDuration = INTRO_LINES.length * LINE_DURATION;
        if (t >= totalTextDuration) {
          this.character.playWave(false);
          setTimeout(() => {
            this.cinematicWindow.style.opacity = "0";
            this.imageContainer.style.opacity = "0";
          }, 400);
          this.state.phase = "pullback";
          this.state.elapsed = 0;
          break;
        }

        const lineIndex = Math.min(
          Math.floor(t / LINE_DURATION),
          INTRO_LINES.length - 1,
        );
        const localT = t - lineIndex * LINE_DURATION;

        this.lineEl.textContent = INTRO_LINES[lineIndex] ?? "";

        if (localT < FADE_IN_DURATION) {
          this.lineEl.style.opacity = String(
            localT / FADE_IN_DURATION,
          );
        } else if (localT < FADE_IN_DURATION + HOLD_DURATION) {
          this.lineEl.style.opacity = "1";
        } else {
          this.lineEl.style.opacity = String(
            Math.max(
              0,
              (LINE_DURATION - localT) / FADE_OUT_DURATION,
            ),
          );
        }
        break;
      }

      case "pullback": {
        const pullbackDuration = 1.2;
        const pullbackT = Math.min(1, t / pullbackDuration);
        const easeOut = 1 - Math.pow(1 - pullbackT, 3);

        const closeupPos = new THREE.Vector3(0, 1.1, 3.5);
        const waveViewPos = new THREE.Vector3(0, 1.7, 4.0);
        this.camera.position.lerpVectors(closeupPos, waveViewPos, easeOut);

        const closeupLook = new THREE.Vector3(0, 0.2, 0);
        const waveViewLook = new THREE.Vector3(0, 0.3, 0);
        const currentLook = closeupLook.clone().lerp(waveViewLook, easeOut);
        this.camera.lookAt(currentLook);

        if (t >= 0.3) {
          this.fadeOverlay.style.opacity = "0";
        }

        if (t >= pullbackDuration) {
          this.state.phase = "hint";
          this.state.elapsed = 0;
          this.hintContainer.style.opacity = "1";
          if (this.closeupLight) {
            this.scene.remove(this.closeupLight);
            this.scene.remove(this.closeupLight.target);
            this.closeupLight.dispose();
            this.closeupLight = null;
          }
        }
        break;
      }

      case "hint":
        this.camera.position.set(0, 1.7, 4.0);
        this.camera.lookAt(0, 0.3, 0);

        if (t >= 0.8) {
          this.state.phase = "complete";
          this.isComplete = true;
          setTimeout(() => {
            if (this.fadeOverlay.parentNode) this.fadeOverlay.remove();
            if (this.cinematicWindow.parentNode)
              this.cinematicWindow.remove();
          }, 1500);
          return false;
        }
        break;
    }

    return true;
  }

  private setupCloseupCamera(): void {
    this.camera.position.set(0, 1.1, 3.5);
    this.camera.lookAt(0, 0.22, 0);

    this.closeupLight = new THREE.SpotLight(
      0xfff5e6,
      2,
      10,
      Math.PI / 5,
      0.3,
      1,
    );
    this.closeupLight.position.set(0, 1.2, 3.0);
    this.closeupLight.target.position.set(0, 0.22, 0);
    this.scene.add(this.closeupLight);
    this.scene.add(this.closeupLight.target);
  }

  isActive(): boolean {
    return !this.isComplete;
  }

  dispose(): void {
    if (this.fadeOverlay.parentNode) this.fadeOverlay.remove();
    if (this.cinematicWindow.parentNode) this.cinematicWindow.remove();
    if (this.imageContainer.parentNode) this.imageContainer.remove();
  }
}
