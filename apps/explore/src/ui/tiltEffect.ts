/**
 * addTiltEffect — CSS 3D perspective tilt + live border light for card elements.
 *
 * Effects:
 *  - RAF-lerped rotateX/rotateY/scale following cursor (physical card feel)
 *  - Glossy shine overlay: radial gradient following mouse (light hitting surface)
 *  - Border light: conic-gradient ring around card edges, hot-spot tracks the
 *    light-source angle derived from cursor position — the edge closest to the
 *    mouse glows brightest, opposite edge is dark.
 *
 * Two modes:
 *  - Direct (default): attaches mouseenter/mousemove/mouseleave to the element.
 *  - Global mouse: attaches to window mousemove, checks bounds each frame.
 *    Use for pointer-events:none HUD elements.
 *
 * Returns a cleanup function.
 */

export interface TiltOptions {
  /** Max tilt angle in degrees. Default: 12 */
  maxRotation?: number;
  /** Scale factor on hover. Default: 1.04 */
  scale?: number;
  /** Perspective distance in px. Default: 900 */
  perspective?: number;
  /** Lerp smoothing 0–1. Default: 0.1 */
  lerpFactor?: number;
  /** Shine + border accent color. Default: cyan. */
  accentColor?: string;
  /** Use global window mousemove. Default: false */
  useGlobalMouse?: boolean;
  /** Only for useGlobalMouse — return false to suspend (element hidden). */
  isActive?: () => boolean;
}

export function addTiltEffect(
  element: HTMLElement,
  options: TiltOptions = {},
): () => void {
  const {
    maxRotation = 12,
    scale = 1.04,
    perspective = 900,
    lerpFactor = 0.1,
    accentColor = "0, 229, 204",   // r,g,b — used in rgba() calls
    useGlobalMouse = false,
    isActive,
  } = options;

  // ── State ─────────────────────────────────────────────────────────────────

  let curRotX = 0;
  let curRotY = 0;
  let curScale = 1;
  let tgtRotX = 0;
  let tgtRotY = 0;
  let tgtScale = 1;
  let hovered = false;
  let rafId: number | null = null;

  if (!element.style.position || element.style.position === "static") {
    element.style.position = "relative";
  }

  // ── Shine overlay — radial gradient that follows the cursor ───────────────

  const shine = document.createElement("div");
  shine.style.cssText = `
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 51;
    opacity: 0;
    transition: opacity 0.35s ease;
  `;
  element.appendChild(shine);

  // ── Border light — conic-gradient ring, hot-spot tracks light angle ────────
  //
  // Technique: absolutely-positioned div, inset: 0, padding: 1.5px.
  // CSS mask with mask-composite: exclude cuts out the content area, leaving
  // only the 1.5px border ring visible. The conic-gradient background rotates
  // its bright arc to the side facing the cursor.

  const borderLight = document.createElement("div");
  borderLight.style.cssText = `
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 52;
    padding: 1.5px;
    background: transparent;
    -webkit-mask:
      linear-gradient(#fff, #fff) content-box,
      linear-gradient(#fff, #fff);
    -webkit-mask-composite: destination-out;
    mask:
      linear-gradient(#fff, #fff) content-box,
      linear-gradient(#fff, #fff);
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.4s ease;
  `;
  element.appendChild(borderLight);

  // ── Update helpers ────────────────────────────────────────────────────────

  function updateEffects(nx: number, ny: number): void {
    const intensity = Math.min(1, Math.sqrt(nx * nx + ny * ny));

    // Shine: radial glow follows cursor position
    const px = (nx + 1) * 50;
    const py = (ny + 1) * 50;
    shine.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(${accentColor}, 0.09), transparent 62%)`;
    shine.style.opacity = "1";

    // Border light: conic gradient, hot-spot at angle toward cursor
    // atan2 gives angle from +X axis; CSS conic starts at top (12 o'clock) so +90°
    const angleDeg = Math.atan2(ny, nx) * (180 / Math.PI) + 90;
    const arc = 70; // half-width of the bright arc in degrees

    const peak = (intensity * 0.9).toFixed(2);
    const mid = (intensity * 0.55).toFixed(2);
    const edge = (intensity * 0.18).toFixed(2);

    borderLight.style.background = `conic-gradient(
      from ${(angleDeg - arc - 30).toFixed(1)}deg,
      transparent                              0deg,
      rgba(${accentColor}, 0)                  20deg,
      rgba(${accentColor}, ${edge})            35deg,
      rgba(${accentColor}, ${mid})             ${arc * 0.6}deg,
      rgba(255, 255, 255,  ${peak})            ${arc}deg,
      rgba(${accentColor}, ${mid})             ${arc * 1.4}deg,
      rgba(${accentColor}, ${edge})            ${arc * 2 - 5}deg,
      rgba(${accentColor}, 0)                  ${arc * 2 + 10}deg,
      transparent                              ${arc * 2 + 30}deg
    )`;
    borderLight.style.opacity = intensity > 0.04 ? "1" : "0";
  }

  function clearEffects(): void {
    shine.style.opacity = "0";
    borderLight.style.opacity = "0";
  }

  // ── Transform ─────────────────────────────────────────────────────────────

  function applyTransform(): void {
    element.style.transform = `perspective(${perspective}px) rotateX(${curRotX}deg) rotateY(${curRotY}deg) scale(${curScale})`;
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────

  function tick(): void {
    curRotX += (tgtRotX - curRotX) * lerpFactor;
    curRotY += (tgtRotY - curRotY) * lerpFactor;
    curScale += (tgtScale - curScale) * lerpFactor;

    applyTransform();

    const settled =
      Math.abs(tgtRotX - curRotX) < 0.015 &&
      Math.abs(tgtRotY - curRotY) < 0.015 &&
      Math.abs(tgtScale - curScale) < 0.0005;

    if (settled) {
      curRotX = tgtRotX;
      curRotY = tgtRotY;
      curScale = tgtScale;
      applyTransform();
      rafId = null;
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  function startTick(): void {
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  // ── Enter / leave / move ──────────────────────────────────────────────────

  function onEnter(): void {
    hovered = true;
    tgtScale = scale;
    startTick();
  }

  function onLeave(): void {
    hovered = false;
    tgtRotX = 0;
    tgtRotY = 0;
    tgtScale = 1;
    clearEffects();
    startTick();
  }

  function onMove(clientX: number, clientY: number): void {
    const rect = element.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    tgtRotY = nx * maxRotation;
    tgtRotX = ny * -maxRotation;
    updateEffects(nx, ny);
    startTick();
  }

  // ── Attach events ─────────────────────────────────────────────────────────

  if (useGlobalMouse) {
    const onGlobalMove = (e: MouseEvent): void => {
      const active = isActive ? isActive() : true;
      if (!active) {
        if (hovered) onLeave();
        return;
      }
      const rect = element.getBoundingClientRect();
      const inBounds =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (inBounds) {
        if (!hovered) onEnter();
        onMove(e.clientX, e.clientY);
      } else if (hovered) {
        onLeave();
      }
    };

    window.addEventListener("mousemove", onGlobalMove);
    return () => {
      window.removeEventListener("mousemove", onGlobalMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  } else {
    const handleEnter = () => onEnter();
    const handleLeave = () => onLeave();
    const handleMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);

    element.addEventListener("mouseenter", handleEnter);
    element.addEventListener("mousemove", handleMove);
    element.addEventListener("mouseleave", handleLeave);
    return () => {
      element.removeEventListener("mouseenter", handleEnter);
      element.removeEventListener("mousemove", handleMove);
      element.removeEventListener("mouseleave", handleLeave);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }
}
