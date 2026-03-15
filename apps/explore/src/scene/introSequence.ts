import * as THREE from "three";
import type { PerspectiveCamera, Scene } from "three";
import type { PlayerCharacter } from "./characters";
import { SPAWN_CENTER_X, SPAWN_CENTER_Z } from "./layoutConstants";
import { assetPath } from "../utils/assetPath";

const INTRO_IMAGE_PATH =
  assetPath("/img/Screenshot_20260209_175259_Photos-removebg-preview.png");
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

// Camera sits in FRONT of the character (character faces -Z toward bridge)
const CLOSEUP_POS = new THREE.Vector3(1.5, 1.8, SPAWN_CENTER_Z - 3);
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
    this.imageContainer.id = "intro-image-container";
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
    textWrap.id = "intro-text-wrap";
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

    this.injectMobileStyles();

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
        const totalTextDuration = INTRO_LINES.length * LINE_DURATION;
        const textComplete = t >= totalTextDuration;

        // Always run the full text animation regardless of asset load state
        if (!textComplete) {
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

        // Text fully done — hold black screen until assets finish loading
        if (!this.heroResolved) {
          this.lineEl.style.opacity = "0";
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
        // Cubic ease-in-out: lingers on the character's face, then sweeps away,
        // then decelerates smoothly into the gameplay camera position.
        const eased = pullbackT < 0.5
          ? 4 * pullbackT * pullbackT * pullbackT
          : 1 - Math.pow(-2 * pullbackT + 2, 3) / 2;

        const startPos = CLOSEUP_POS.clone();
        const endPos = new THREE.Vector3(
          SPAWN_CENTER_X + CAMERA_OFFSET_X,
          CAMERA_HEIGHT,
          SPAWN_CENTER_Z + CAMERA_DISTANCE,
        );
        this.camera.position.lerpVectors(startPos, endPos, eased);

        const startLook = CLOSEUP_LOOK.clone();
        const endLook = new THREE.Vector3(
          SPAWN_CENTER_X + CAMERA_OFFSET_X * 0.3,
          0.5,
          SPAWN_CENTER_Z + CAMERA_DISTANCE * 0.2,
        );
        const look = startLook.clone().lerp(endLook, eased);
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
      bottom: clamp(36px, 6vh, 56px);
      left: clamp(36px, 6vw, 72px);
      z-index: 1001;
      pointer-events: none;
      opacity: 0;
      animation: ident-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards;
    `;

    // Frosted strip
    const strip = document.createElement("div");
    strip.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      padding: 16px 32px 16px 26px;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-radius: 2px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    `;

    // Glowing accent line on left edge
    const accent = document.createElement("div");
    accent.style.cssText = `
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 2px;
      border-radius: 2px 0 0 2px;
      background: rgb(0, 229, 204);
      box-shadow: 0 0 10px rgba(0, 229, 204, 0.55);
    `;

    const texts = document.createElement("div");
    texts.style.cssText = `display: flex; flex-direction: column; gap: 7px;`;

    const nameEl = document.createElement("div");
    nameEl.style.cssText = `
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: clamp(18px, 2.2vw, 26px);
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #ffffff;
      white-space: nowrap;
      line-height: 1;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
    `;
    nameEl.textContent = "Alexander Lazarovich";

    const titleEl = document.createElement("div");
    titleEl.style.cssText = `
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: clamp(10px, 1.1vw, 13px);
      font-weight: 400;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.52);
      white-space: nowrap;
      line-height: 1;
    `;
    titleEl.textContent = "Full-Stack Engineer  \u00b7  Ra\u2019anana";

    texts.appendChild(nameEl);
    texts.appendChild(titleEl);
    strip.appendChild(accent);
    strip.appendChild(texts);
    el.appendChild(strip);

    this.injectIntroKeyframes();
    return el;
  }

  private injectIntroKeyframes(): void {
    if (document.getElementById("intro-keyframes")) return;
    const style = document.createElement("style");
    style.id = "intro-keyframes";
    style.textContent = `
      @keyframes ident-in {
        from { opacity: 0; transform: translateX(-110%); }
        to   { opacity: 1; transform: translateX(0);     }
      }
    `;
    document.head.appendChild(style);
  }

  private injectMobileStyles(): void {
    if (document.getElementById("intro-mobile-styles")) return;
    const style = document.createElement("style");
    style.id = "intro-mobile-styles";
    style.textContent = `
      @media (max-width: 600px) {
        /* Image: anchor to bottom, shrink to lower half of screen */
        #intro-image-container {
          left: 50% !important;
          bottom: 0 !important;
          transform: translateX(-50%);
        }
        #intro-image-container img {
          min-height: unset !important;
          height: 58vh;
          width: auto;
        }
        /* Text: move to upper portion, above the image */
        #intro-text-wrap {
          top: 22% !important;
          transform: translate(-50%, 0) !important;
        }
        /* Ident name card: anchor to top instead of bottom */
        #intro-ident {
          bottom: unset !important;
          top: clamp(24px, 5vh, 48px) !important;
          left: 50% !important;
          transform: translateX(-50%);
          animation: ident-in-mobile 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards !important;
        }
        @keyframes ident-in-mobile {
          from { opacity: 0; transform: translateX(-50%) translateY(-24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);     }
        }
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
