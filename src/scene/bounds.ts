const SIZE = 12;
const SIDES = 6;

const HEX_VERTICES: Array<[number, number]> = [];
for (let i = 0; i < SIDES; i++) {
  const angle = (i / SIDES) * Math.PI * 2 - Math.PI / 6;
  HEX_VERTICES.push([Math.cos(angle) * SIZE, Math.sin(angle) * SIZE]);
}

function isInsideWithVertices(
  x: number,
  z: number,
  vertices: Array<[number, number]>,
): boolean {
  let inside = false;
  const n = vertices.length;
  let j = n - 1;

  for (let i = 0; i < n; i++) {
    const [xi, zi] = vertices[i];
    const [xj, zj] = vertices[j];

    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
    j = i;
  }

  return inside;
}

export function isInsideMap(x: number, z: number, margin: number): boolean {
  const innerSize = SIZE - margin;
  if (innerSize <= 0) return false;

  const innerVertices = HEX_VERTICES.map(([vx, vz]) => {
    const len = Math.hypot(vx, vz);
    const scale = innerSize / (len || 1);
    return [vx * scale, vz * scale] as [number, number];
  });

  return isInsideWithVertices(x, z, innerVertices);
}
