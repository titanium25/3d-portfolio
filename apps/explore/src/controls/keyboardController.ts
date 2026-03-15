export interface Velocity {
  x: number;
  z: number;
}

export interface InputDirection {
  x: number;
  z: number;
}

const keys: Record<string, boolean> = {};

// ── Touch / virtual input (set by mobileControls) ─────────────────────────
let touchDirX = 0;
let touchDirZ = 0;

/** Inject joystick direction from touch controls (-1..1 per axis). */
export function setTouchDirection(x: number, z: number): void {
  touchDirX = x;
  touchDirZ = z;
}

/** Simulate a key press/release from touch controls (e.g. ShiftLeft for sprint). */
export function setVirtualKey(code: string, pressed: boolean): void {
  keys[code] = pressed;
}

export function initKeyboard(): void {
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
}

export function getInputDirection(): InputDirection {
  // Keyboard axes
  let kx = 0;
  let kz = 0;
  if (keys['KeyW'] || keys['ArrowUp'])    kz -= 1;
  if (keys['KeyS'] || keys['ArrowDown'])  kz += 1;
  if (keys['KeyA'] || keys['ArrowLeft'])  kx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) kx += 1;
  // Normalize keyboard diagonal
  if (kx !== 0 && kz !== 0) { kx *= Math.SQRT1_2; kz *= Math.SQRT1_2; }

  // Merge with touch (touch is already normalized to unit circle)
  let x = kx + touchDirX;
  let z = kz + touchDirZ;

  // Clamp total to unit circle
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }

  return { x, z };
}

export function isKeyPressed(code: string): boolean {
  return keys[code] ?? false;
}
