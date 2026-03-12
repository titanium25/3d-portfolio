import * as THREE from "three";
import type { PerspectiveCamera, Scene } from "three";
import type { PlayerCharacter } from "./characters";
import { SPAWN_CENTER_X, SPAWN_CENTER_Z } from "./layoutConstants";

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

const IDENT_HOLD = 4;
const PULLBACK_DURATION = 4;

const CAMERA_OFFSET_X = 3;
const CAMERA_HEIGHT = 3;
const CAMERA_DISTANCE = 6;

const CLOSEUP_POS = new THREE.Vector3(1.5, 1.8, SPAWN_CENTER_Z + 3);
const CLOSEUP_LOOK = new THREE.Vector3(SPAWN_CENTER_X, 0.5, SPAWN_CENTER_Z);

export interface IntroState {
  phase: "text" | "ident" | "pullback" | "complete";
  elapsed: number;
}

export interface IntroSequenceOptions {
  heroReady?: Promise<void>;
}

export class IntroSequence {
  private state: IntroState = { phase: "text", elapsed: 0 };
  private fadeOverlay: HTMLElement;
  private cinematicWindow: HTMLElement;
  private imageContainer: HTMLElement;
  private lineEl: HTMLElement;
  private introIdent: HTMLElement | null = null;
  private camera: PerspectiveCamera;
  private scene: Scene;
  private character: PlayerCharacter | null;
  private closeupLight: THREE.SpotLight | null = null;
  private isComplete = false;
  private heroResolved = false;

  constructor(
    camera: PerspectiveCamera,
    scene: Scene,
    character: PlayerCharacter | null = null,
    options: IntroSequenceOptions = {},
  ) {
    this.camera = camera;
    this.scene = scene;
    this.character = character;

    this.camera.position.copy(CLOSEUP_POS);
    this.camera.lookAt(CLOSEUP_LOOK);

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

    this.cinematicWindow.style.opacity = "1";
    this.imageContainer.style.opacity = "1";

    options.heroReady?.then(() => {
      this.heroResolved = true;
    });
  }

  update(deltaSec: number): boolean {
    if (this.isComplete) return false;

    this.state.elapsed += deltaSec;
    const t = this.state.elapsed;

    switch (this.state.phase) {
      case "text": {
        if (!this.heroResolved) {
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
              Math.max(0, (LINE_DURATION - localT) / FADE_OUT_DURATION),
            );
          }
          return true;
        }

        setTimeout(() => {
          this.cinematicWindow.style.opacity = "0";
          this.imageContainer.style.opacity = "0";
        }, 300);
        this.fadeOverlay.style.opacity = "0";

        this.setupCloseupLight();
        this.introIdent = this.createIntroIdent();
        document.body.appendChild(this.introIdent);
        this.introIdent.style.opacity = "1";
        if (this.character) this.character.playWave(false);

        this.state.phase = "ident";
        this.state.elapsed = 0;
        break;
      }

      case "ident": {
        this.camera.position.copy(CLOSEUP_POS);
        this.camera.lookAt(CLOSEUP_LOOK);

        if (t >= IDENT_HOLD) {
          if (this.introIdent) {
            this.introIdent.style.transition = "opacity 0.5s ease-out";
            this.introIdent.style.opacity = "0";
          }
          if (this.closeupLight) {
            this.scene.remove(this.closeupLight);
            this.scene.remove(this.closeupLight.target);
            this.closeupLight.dispose();
            this.closeupLight = null;
          }
          this.state.phase = "pullback";
          this.state.elapsed = 0;
        }
        break;
      }

      case "pullback": {
        const pullbackT = Math.min(1, t / PULLBACK_DURATION);
        const easeOut = 1 - Math.pow(1 - pullbackT, 2);

        const startPos = CLOSEUP_POS.clone();
        const endPos = new THREE.Vector3(
          SPAWN_CENTER_X + CAMERA_OFFSET_X,
          CAMERA_HEIGHT,
          SPAWN_CENTER_Z + CAMERA_DISTANCE,
        );
        this.camera.position.lerpVectors(startPos, endPos, easeOut);

        const startLook = CLOSEUP_LOOK.clone();
        const endLook = new THREE.Vector3(
          SPAWN_CENTER_X + CAMERA_OFFSET_X * 0.3,
          0.5,
          SPAWN_CENTER_Z + CAMERA_DISTANCE * 0.2,
        );
        const look = startLook.clone().lerp(endLook, easeOut);
        this.camera.lookAt(look);

        if (t >= 0.3 && this.introIdent?.parentNode) {
          this.introIdent.remove();
          this.introIdent = null;
        }

        if (t >= PULLBACK_DURATION) {
          this.state.phase = "complete";
          this.isComplete = true;
          setTimeout(() => {
            if (this.fadeOverlay.parentNode) this.fadeOverlay.remove();
            if (this.cinematicWindow.parentNode) this.cinematicWindow.remove();
            if (this.imageContainer.parentNode) this.imageContainer.remove();
          }, 500);
          return false;
        }
        break;
      }
    }

    return true;
  }

  private createIntroIdent(): HTMLElement {
    const el = document.createElement("div");
    el.id = "intro-ident";
    el.style.cssText = `
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 1001;
      pointer-events: none;
      padding: 32px 48px;
      border-left: 3px solid rgba(0, 229, 204, 0.6);
      border-right: 3px solid rgba(0, 229, 204, 0.6);
      background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.4) 20%, rgba(0, 0, 0, 0.5) 50%, rgba(0, 0, 0, 0.4) 80%, transparent 100%);
      box-shadow: 0 0 40px rgba(0, 229, 204, 0.08), inset 0 0 60px rgba(0, 0, 0, 0.3);
    `;

    const nameEl = document.createElement("div");
    nameEl.style.cssText = `
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: clamp(28px, 4.5vw, 42px);
      font-weight: 600;
      color: #ffffff;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      text-shadow: 0 0 30px rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.5);
      opacity: 0;
      animation: intro-name 1s ease-out 0.2s forwards;
    `;
    nameEl.textContent = "Alexander Lazarovich";

    const divider = document.createElement("div");
    divider.style.cssText = `
      width: 40px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(0, 229, 204, 0.6), transparent);
      margin: 16px auto;
      opacity: 0;
      animation: intro-line 0.6s ease-out 0.8s forwards;
    `;

    const titleEl = document.createElement("div");
    titleEl.style.cssText = `
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: clamp(13px, 1.6vw, 16px);
      font-weight: 400;
      color: rgba(0, 229, 204, 0.9);
      letter-spacing: 0.25em;
      text-transform: uppercase;
      opacity: 0;
      animation: intro-subtitle 0.8s ease-out 1s forwards;
    `;
    titleEl.textContent = "Full-Stack Engineer · Ra'anana";

    this.injectIntroKeyframes();
    el.appendChild(nameEl);
    el.appendChild(divider);
    el.appendChild(titleEl);
    return el;
  }

  private injectIntroKeyframes(): void {
    if (document.getElementById("intro-keyframes")) return;
    const style = document.createElement("style");
    style.id = "intro-keyframes";
    style.textContent = `
      @keyframes intro-name {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes intro-line {
        from { opacity: 0; width: 0; margin-left: 20px; margin-right: 20px; }
        to { opacity: 1; width: 40px; margin-left: auto; margin-right: auto; }
      }
      @keyframes intro-subtitle {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  private setupCloseupLight(): void {
    this.closeupLight = new THREE.SpotLight(
      0xfff5e6,
      2,
      12,
      Math.PI / 5,
      0.3,
      1,
    );
    this.closeupLight.position.set(
      SPAWN_CENTER_X,
      1.8,
      SPAWN_CENTER_Z - 1.5,
    );
    this.closeupLight.target.position.copy(CLOSEUP_LOOK);
    this.scene.add(this.closeupLight);
    this.scene.add(this.closeupLight.target);
  }

  setCharacter(character: PlayerCharacter): void {
    this.character = character;
  }

  isActive(): boolean {
    return !this.isComplete;
  }

  dispose(): void {
    if (this.fadeOverlay?.parentNode) this.fadeOverlay.remove();
    if (this.cinematicWindow?.parentNode) this.cinematicWindow.remove();
    if (this.imageContainer?.parentNode) this.imageContainer.remove();
    if (this.introIdent?.parentNode) this.introIdent.remove();
  }
}
