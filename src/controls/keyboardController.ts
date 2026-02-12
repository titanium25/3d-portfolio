export interface Velocity {
  x: number;
  z: number;
}

export interface InputDirection {
  x: number;
  z: number;
}

const keys: Record<string, boolean> = {};

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
  const dir: InputDirection = { x: 0, z: 0 };

  if (keys['KeyW'] || keys['ArrowUp']) dir.z -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) dir.z += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) dir.x -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dir.x += 1;

  if (dir.x !== 0 && dir.z !== 0) {
    const norm = Math.SQRT1_2;
    dir.x *= norm;
    dir.z *= norm;
  }

  return dir;
}

export function isKeyPressed(code: string): boolean {
  return keys[code] ?? false;
}
