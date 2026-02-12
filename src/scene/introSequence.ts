import * as THREE from 'three';
import type { PerspectiveCamera, Scene } from 'three';
import type { CharacterController } from './CharacterController';

export interface IntroState {
  phase: 'closeup' | 'text1' | 'text2' | 'text3' | 'text4' | 'pullback' | 'hint' | 'complete';
  elapsed: number;
}

export class IntroSequence {
  private state: IntroState = { phase: 'closeup', elapsed: 0 };
  private fadeOverlay: HTMLElement;
  private terminalWindow: HTMLElement;
  private textContainer: HTMLElement;
  private hintContainer: HTMLElement;
  private camera: PerspectiveCamera;
  private scene: Scene;
  private character: CharacterController;
  private initialCameraPos: THREE.Vector3;
  private closeupLight: THREE.SpotLight | null = null;
  private isComplete = false;

  constructor(camera: PerspectiveCamera, scene: Scene, character: CharacterController) {
    this.camera = camera;
    this.scene = scene;
    this.character = character;
    this.initialCameraPos = camera.position.clone();

    // Set camera to closeup position immediately
    this.setupCloseupCamera();
    this.state.phase = 'closeup';

    this.fadeOverlay = document.createElement('div');
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

    // Add CRT scanline effect
    const scanlines = document.createElement('div');
    scanlines.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1002;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 255, 0, 0.03) 0px,
        rgba(0, 255, 0, 0.03) 1px,
        transparent 1px,
        transparent 2px
      );
      opacity: 0.5;
    `;
    document.body.appendChild(scanlines);

    // Old-school hacker terminal - fullscreen
    this.terminalWindow = document.createElement('div');
    this.terminalWindow.style.cssText = `
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
      padding: 40px;
      box-sizing: border-box;
    `;
    
    // Terminal content area
    const terminalContent = document.createElement('div');
    terminalContent.style.cssText = `
      max-width: 800px;
      width: 100%;
    `;
    
    this.textContainer = document.createElement('div');
    this.textContainer.style.cssText = `
      font-family: 'Courier New', 'Courier', monospace;
      font-size: 16px;
      font-weight: 400;
      color: #00ff00;
      line-height: 1.8;
      white-space: pre-wrap;
      word-wrap: break-word;
      text-shadow: 0 0 5px #00ff00;
      letter-spacing: 1px;
    `;
    
    terminalContent.appendChild(this.textContainer);
    this.terminalWindow.appendChild(terminalContent);
    document.body.appendChild(this.terminalWindow);

    this.hintContainer = document.createElement('div');
    this.hintContainer.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1001;
      pointer-events: none;
      font-family: 'Courier New', 'Courier', monospace;
      font-size: 0.85rem;
      color: #00ff00;
      text-align: center;
      opacity: 0;
      transition: opacity 1s ease-in;
      background: rgba(0, 0, 0, 0.8);
      padding: 10px 20px;
      border: 1px solid #00ff00;
      text-shadow: 0 0 5px #00ff00;
      letter-spacing: 1px;
    `;
    this.hintContainer.innerHTML = 'WASD / Arrow Keys • Shift to run • E to interact • M for map';
    document.body.appendChild(this.hintContainer);
  }

  update(deltaSec: number): boolean {
    if (this.isComplete) return false;

    this.state.elapsed += deltaSec;

    const t = this.state.elapsed;

    switch (this.state.phase) {
      case 'closeup':
        if (t >= 0.1) {
          this.state.phase = 'text1';
          this.state.elapsed = 0;
          this.terminalWindow.style.opacity = '1';
          this.typeText('> INITIALIZING SYSTEM...\n> ACCESS GRANTED\n> CONNECTING...\n\n', '', this.textContainer);
        }
        break;

      case 'text1':
        // Wait for typing to finish + reading time
        if (t >= 1.5) {
          this.state.phase = 'text2';
          this.state.elapsed = 0;
          this.appendText('\n> USER: Alex\n> STATUS: ONLINE\n\n', this.textContainer);
          this.typeText('> echo "Hi, I\'m Alex."', 'Hi, I\'m Alex.', this.textContainer);
        }
        break;

      case 'text2':
        // Wait for typing to finish + reading time
        if (t >= 1.3) {
          this.state.phase = 'text3';
          this.state.elapsed = 0;
          this.appendText('\n', this.textContainer);
          this.typeText('> echo "Welcome to Software City."', 'Welcome to Software City.', this.textContainer);
        }
        break;

      case 'text3':
        // Wait for typing to finish + reading time
        if (t >= 1.3) {
          this.state.phase = 'text4';
          this.state.elapsed = 0;
          this.appendText('\n', this.textContainer);
          this.typeText('> echo "Explore my work →"', 'Explore my work →', this.textContainer);
        }
        break;

      case 'text4':
        // Wait for typing to finish + reading time
        if (t >= 1.3) {
          this.state.phase = 'pullback';
          this.state.elapsed = 0;
          this.appendText('\n\n> SYSTEM READY\n> ENTERING WORLD...\n', this.textContainer);
          setTimeout(() => {
            this.terminalWindow.style.opacity = '0';
          }, 600);
        }
        break;

      case 'pullback':
        const pullbackT = Math.min(1, t / 0.8);
        const easeOut = 1 - Math.pow(1 - pullbackT, 3);
        this.camera.position.lerpVectors(
          new THREE.Vector3(0, 1.6, 3.5),
          this.initialCameraPos,
          easeOut
        );
        this.camera.lookAt(
          new THREE.Vector3(0, 0.7, 0).lerp(
            new THREE.Vector3(4 * 0.3, 0.5, 7 * 0.2),
            easeOut
          )
        );
        if (t >= 0.8) {
          this.state.phase = 'hint';
          this.state.elapsed = 0;
          this.hintContainer.style.opacity = '1';
        }
        break;

      case 'hint':
        // Start fading out the overlay smoothly after hint appears
        if (t >= 0.2) {
          this.fadeOverlay.style.opacity = '0';
        }
        if (t >= 0.5) {
          this.state.phase = 'complete';
          this.isComplete = true;
          // Play wave animation once the scene is revealed
          this.character.playWave(false);
          if (this.closeupLight) {
            this.scene.remove(this.closeupLight);
            this.scene.remove(this.closeupLight.target);
            this.closeupLight.dispose();
            this.closeupLight = null;
          }
          // Remove overlay elements after fade completes, but keep legend visible
          setTimeout(() => {
            if (this.fadeOverlay.parentNode) {
              this.fadeOverlay.remove();
            }
            if (this.terminalWindow.parentNode) {
              this.terminalWindow.remove();
            }
            // Remove scanlines
            const scanlines = document.querySelector('div[style*="repeating-linear-gradient"]');
            if (scanlines && scanlines.parentNode) {
              scanlines.remove();
            }
            // Don't remove hintContainer - keep legend visible
          }, 1500); // Wait for transition to complete
          return false;
        }
        break;
    }

    return true;
  }

  private setupCloseupCamera(): void {
    this.camera.position.set(0, 1.6, 3.5);
    this.camera.lookAt(0, 0.72, 0);

    this.closeupLight = new THREE.SpotLight(0xfff5e6, 2, 10, Math.PI / 5, 0.3, 1);
    this.closeupLight.position.set(0, 1.7, 3.0);
    this.closeupLight.target.position.set(0, 0.72, 0);
    this.scene.add(this.closeupLight);
    this.scene.add(this.closeupLight.target);
  }

  private typeText(command: string, output: string, element: HTMLElement): void {
    let i = 0;
    const cursor = document.createElement('span');
    cursor.textContent = '_';
    cursor.style.cssText = `
      color: #00ff00;
      animation: blink 1s infinite;
      text-shadow: 0 0 5px #00ff00;
    `;
    
    // Add CSS animation for cursor blink
    if (!document.getElementById('intro-cursor-style')) {
      const style = document.createElement('style');
      style.id = 'intro-cursor-style';
      style.textContent = `
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    element.appendChild(cursor);
    
    const typeChar = () => {
      if (i < command.length) {
        cursor.remove();
        element.textContent += command[i];
        element.appendChild(cursor);
        i++;
        
        // Very fast typing speed
        const delay = 10 + Math.random() * 10;
        if (Math.random() < 0.05 && i > 2) {
          // Occasional brief pause
          setTimeout(typeChar, delay + 30);
        } else {
          setTimeout(typeChar, delay);
        }
      } else {
        // Command finished, show output after a brief pause
        cursor.remove();
        setTimeout(() => {
          if (output) {
            const outputSpan = document.createElement('span');
            outputSpan.style.color = '#00ff00';
            outputSpan.style.textShadow = '0 0 5px #00ff00';
            outputSpan.textContent = '\n' + output;
            element.appendChild(outputSpan);
          }
        }, 100);
      }
    };
    
    typeChar();
  }

  private appendText(text: string, element: HTMLElement): void {
    const span = document.createElement('span');
    span.style.color = '#00ff00';
    span.style.textShadow = '0 0 5px #00ff00';
    span.textContent = text;
    element.appendChild(span);
  }

  isActive(): boolean {
    return !this.isComplete;
  }

  dispose(): void {
    if (this.fadeOverlay.parentNode) {
      this.fadeOverlay.remove();
    }
    if (this.terminalWindow.parentNode) {
      this.terminalWindow.remove();
    }
    const scanlines = document.querySelector('div[style*="repeating-linear-gradient"]');
    if (scanlines && scanlines.parentNode) {
      scanlines.remove();
    }
    // Keep hintContainer (legend) visible - don't remove it
  }
}
