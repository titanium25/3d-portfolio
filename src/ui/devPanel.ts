/**
 * devPanel.ts — Developer overlay panel
 *
 * Features:
 *  - Draggable floating panel (top-left default)
 *  - Collapsible sections with persisted state
 *  - FPS colour-coded (green/amber/red)
 *  - Click any value row to copy to clipboard
 *  - Mobile FAB (bottom-left "DEV" pill) for touch devices
 *  - Backtick key toggles on desktop; FAB toggles on mobile
 */

import * as THREE from "three";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DevPanelDeps {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  getCharacter: () => { getDebugInfo(): Record<string, string> } | null;
  getDog: () => { getDebugInfo(): Record<string, string> } | null;
  getCompletedGateCount: () => number;
  getDiscoveryCount: () => number;
  /** Teleport camera to position and point it at target. */
  setCameraLookAt: (
    camPos: [number, number, number],
    target: [number, number, number],
  ) => void;
  /** Get the current orbit target (for display). */
  getOrbitTarget: () => THREE.Vector3;
}

// ── State ─────────────────────────────────────────────────────────────────────

let deps: DevPanelDeps | null = null;
let panel: HTMLElement | null = null;
let fab: HTMLElement | null = null;
let visible = false;

// FPS tracking
let fpsFrames = 0;
let fpsLastTime = performance.now();
let fpsDisplay = 0;
let frameTimeDisplay = 0;
let lastFrameTime = performance.now();

// Collapsed state per section
const collapsed: Record<string, boolean> = {
  device:      false,
  performance: false,
  camera:      false,
  flyto:       false,
  player:      false,
  dog:         false,
  world:       false,
};

// Device info — static, built once
let deviceInfoCache: Record<string, string> | null = null;

function buildDeviceInfo(): Record<string, string> {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number } };
  const ua = navigator.userAgent;

  // Platform detection
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua) || (isMobile && Math.min(screen.width, screen.height) > 480);
  const platformGuess = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  // OS detection from UA
  let os = "unknown";
  if (/Windows NT/.test(ua))       os = "Windows " + (ua.match(/Windows NT (\d+\.\d+)/)?.[1] ?? "");
  else if (/Mac OS X/.test(ua))    os = "macOS " + (ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
  else if (/Android/.test(ua))     os = "Android " + (ua.match(/Android ([\d.]+)/)?.[1] ?? "");
  else if (/iPhone|iPad/.test(ua)) os = "iOS " + (ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
  else if (/Linux/.test(ua))       os = "Linux";

  // Browser detection
  let browser = "unknown";
  if (/Edg\//.test(ua))    browser = "Edge " + (ua.match(/Edg\/([\d.]+)/)?.[1] ?? "");
  else if (/Chrome\//.test(ua))  browser = "Chrome " + (ua.match(/Chrome\/([\d.]+)/)?.[1] ?? "");
  else if (/Firefox\//.test(ua)) browser = "Firefox " + (ua.match(/Firefox\/([\d.]+)/)?.[1] ?? "");
  else if (/Safari\//.test(ua))  browser = "Safari";

  // GPU info via WebGL
  let gpu = "n/a";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string ?? "n/a";
    }
  } catch {}

  const info: Record<string, string> = {
    platform:  platformGuess,
    os,
    browser,
    "viewport": `${window.innerWidth} × ${window.innerHeight}`,
    "screen":   `${screen.width} × ${screen.height}`,
    "dpr":      String(window.devicePixelRatio),
    "touch":    navigator.maxTouchPoints > 0 ? `yes (${navigator.maxTouchPoints} pts)` : "no",
    gpu,
  };

  if (nav.deviceMemory !== undefined) info["ram"] = `${nav.deviceMemory} GB`;
  if (nav.hardwareConcurrency)        info["cores"] = String(nav.hardwareConcurrency);
  if (nav.connection?.effectiveType)  info["network"] = `${nav.connection.effectiveType}${nav.connection.downlink ? ` · ${nav.connection.downlink} Mbps` : ""}`;

  return info;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ACCENT = "#00e5cc";
const SECTION_COLORS: Record<string, string> = {
  device:      "#f87c7c",
  performance: "#7cacf8",
  camera:      "#f8c87c",
  flyto:       "#f8a07c",
  player:      "#7cf8a4",
  dog:         "#c87cf8",
  world:       ACCENT,
};

function injectStyles(): void {
  if (document.getElementById("dp-styles")) return;
  const s = document.createElement("style");
  s.id = "dp-styles";
  s.textContent = `
    /* ── Panel ── */
    #dp-panel {
      position: fixed;
      top: 12px;
      left: 12px;
      width: 300px;
      max-height: calc(100dvh - 24px);
      display: flex;
      flex-direction: column;
      background: rgba(8, 10, 18, 0.94);
      border: 1px solid rgba(0, 229, 204, 0.18);
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,229,204,0.06) inset;
      backdrop-filter: blur(14px) saturate(1.4);
      -webkit-backdrop-filter: blur(14px) saturate(1.4);
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', ui-monospace, monospace;
      font-size: 11px;
      color: #c8ccd8;
      z-index: 9999;
      overflow: hidden;
      user-select: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    #dp-panel.dp-hidden {
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
      pointer-events: none;
    }

    /* ── Header ── */
    #dp-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px 8px;
      background: rgba(0, 229, 204, 0.06);
      border-bottom: 1px solid rgba(0, 229, 204, 0.12);
      cursor: grab;
      flex-shrink: 0;
    }
    #dp-header:active { cursor: grabbing; }

    #dp-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: ${ACCENT};
      background: rgba(0, 229, 204, 0.1);
      border: 1px solid rgba(0, 229, 204, 0.25);
      border-radius: 4px;
      padding: 1px 6px;
    }

    #dp-fps {
      font-size: 13px;
      font-weight: 700;
      min-width: 54px;
      transition: color 0.3s;
    }

    #dp-frametime {
      font-size: 10px;
      color: #505468;
      flex: 1;
    }

    #dp-close {
      margin-left: auto;
      width: 20px;
      height: 20px;
      border: none;
      background: rgba(255,255,255,0.06);
      color: #7a7e8e;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      line-height: 1;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    #dp-close:hover { background: rgba(255,60,60,0.18); color: #ff6464; }

    /* ── Scrollable body ── */
    #dp-body {
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.08) transparent;
    }
    #dp-body::-webkit-scrollbar { width: 4px; }
    #dp-body::-webkit-scrollbar-track { background: transparent; }
    #dp-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

    /* ── Section ── */
    .dp-section { border-bottom: 1px solid rgba(255,255,255,0.04); }

    .dp-section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px 6px;
      cursor: pointer;
      transition: background 0.12s;
    }
    .dp-section-header:hover { background: rgba(255,255,255,0.03); }

    .dp-chevron {
      font-size: 9px;
      opacity: 0.45;
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .dp-chevron.collapsed { transform: rotate(-90deg); }

    .dp-section-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    /* ── Rows ── */
    .dp-rows {
      padding: 2px 0 6px;
      overflow: hidden;
      transition: max-height 0.2s ease, opacity 0.2s ease;
    }
    .dp-rows.collapsed { max-height: 0 !important; opacity: 0; padding: 0; }

    .dp-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 2px 12px 2px 22px;
      gap: 8px;
      cursor: pointer;
      border-radius: 3px;
      margin: 0 4px;
      transition: background 0.1s;
    }
    .dp-row:hover { background: rgba(255,255,255,0.05); }
    .dp-row:hover .dp-val::after {
      content: ' ⎘';
      font-size: 9px;
      opacity: 0.4;
    }

    .dp-key {
      color: #50546a;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .dp-val {
      color: #c8ccd8;
      text-align: right;
      word-break: break-all;
    }

    /* ── Footer ── */
    #dp-footer {
      padding: 6px 12px;
      font-size: 10px;
      color: #33364a;
      text-align: center;
      border-top: 1px solid rgba(255,255,255,0.04);
      letter-spacing: 0.06em;
      flex-shrink: 0;
    }

    /* ── Copy toast ── */
    #dp-copy-toast {
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%) translateY(8px);
      background: rgba(0, 229, 204, 0.15);
      border: 1px solid rgba(0, 229, 204, 0.3);
      color: ${ACCENT};
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 11px;
      padding: 5px 12px;
      border-radius: 20px;
      opacity: 0;
      transition: opacity 0.2s, transform 0.2s;
      z-index: 10000;
      pointer-events: none;
      white-space: nowrap;
    }
    #dp-copy-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* ── Mobile FAB ── */
    #dp-fab {
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 9998;
      background: rgba(8, 10, 18, 0.82);
      border: 1px solid rgba(0, 229, 204, 0.22);
      border-radius: 20px;
      color: ${ACCENT};
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      padding: 6px 12px;
      cursor: pointer;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
      opacity: 0.55;
    }
    #dp-fab:hover, #dp-fab:active { opacity: 1; background: rgba(0, 229, 204, 0.12); }
    #dp-fab.dp-fab-active {
      opacity: 1;
      background: rgba(0, 229, 204, 0.14);
      border-color: rgba(0, 229, 204, 0.45);
    }

    /* ── Fly-To section ── */
    .dp-preset-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px 8px 8px;
    }

    .dp-preset-btn {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 5px;
      color: #6a7080;
      font-family: inherit;
      font-size: 10px;
      padding: 6px 8px;
      cursor: pointer;
      text-align: left;
      line-height: 1.3;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    .dp-preset-btn:hover, .dp-preset-btn:active {
      background: rgba(0, 229, 204, 0.08);
      border-color: rgba(0, 229, 204, 0.28);
      color: ${ACCENT};
    }
    .dp-preset-btn .dp-preset-sub {
      display: block;
      font-size: 9px;
      opacity: 0.45;
      margin-top: 1px;
    }

    .dp-coord-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 8px 8px;
    }
    .dp-coord-label {
      color: #50546a;
      font-size: 10px;
      flex-shrink: 0;
    }
    .dp-coord-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 4px;
      color: #c8ccd8;
      font-family: inherit;
      font-size: 10px;
      padding: 4px 5px;
      min-width: 0;
      outline: none;
      transition: border-color 0.12s;
    }
    .dp-coord-input:focus {
      border-color: rgba(0, 229, 204, 0.4);
    }
    .dp-teleport-go {
      background: rgba(0, 229, 204, 0.1);
      border: 1px solid rgba(0, 229, 204, 0.28);
      border-radius: 4px;
      color: ${ACCENT};
      font-family: inherit;
      font-size: 10px;
      padding: 4px 8px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s;
      flex-shrink: 0;
    }
    .dp-teleport-go:hover { background: rgba(0, 229, 204, 0.18); }

    .dp-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.05);
      margin: 4px 8px;
    }

    @media (max-width: 600px) {
      #dp-panel {
        width: calc(100vw - 24px);
        top: auto;
        bottom: 48px;
        left: 12px;
        right: 12px;
        max-height: 60dvh;
        border-radius: 12px;
      }
    }
  `;
  document.head.appendChild(s);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function makeCopyToast(): HTMLElement {
  const el = document.createElement("div");
  el.id = "dp-copy-toast";
  el.textContent = "Copied!";
  document.body.appendChild(el);
  return el;
}

let copyToastEl: HTMLElement | null = null;
let copyToastTimer = 0;

function flashCopyToast(text: string): void {
  if (!copyToastEl) copyToastEl = makeCopyToast();
  copyToastEl.textContent = `Copied: ${text.slice(0, 30)}`;
  copyToastEl.classList.add("show");
  clearTimeout(copyToastTimer);
  copyToastTimer = window.setTimeout(() => copyToastEl?.classList.remove("show"), 1400);
}

function buildRow(key: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "dp-row";

  const k = document.createElement("span");
  k.className = "dp-key";
  k.textContent = key;

  const v = document.createElement("span");
  v.className = "dp-val";
  v.textContent = value;

  row.appendChild(k);
  row.appendChild(v);

  row.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value).catch(() => {});
    flashCopyToast(value);
  });

  return row;
}

function buildSection(
  id: string,
  title: string,
  data: Record<string, string>,
): HTMLElement {
  const color = SECTION_COLORS[id] ?? "#aaa";
  const isCollapsed = collapsed[id] ?? false;

  const section = document.createElement("div");
  section.className = "dp-section";
  section.dataset.sectionId = id;

  // Header
  const header = document.createElement("div");
  header.className = "dp-section-header";

  const chevron = document.createElement("span");
  chevron.className = "dp-chevron" + (isCollapsed ? " collapsed" : "");
  chevron.textContent = "▾";

  const titleEl = document.createElement("span");
  titleEl.className = "dp-section-title";
  titleEl.style.color = color;
  titleEl.textContent = title;

  header.appendChild(chevron);
  header.appendChild(titleEl);
  section.appendChild(header);

  // Rows container
  const rows = document.createElement("div");
  rows.className = "dp-rows" + (isCollapsed ? " collapsed" : "");

  for (const [k, v] of Object.entries(data)) {
    rows.appendChild(buildRow(k, v));
  }

  section.appendChild(rows);

  // Toggle collapse
  header.addEventListener("click", () => {
    collapsed[id] = !collapsed[id];
    chevron.classList.toggle("collapsed", collapsed[id]);
    rows.classList.toggle("collapsed", collapsed[id]);
  });

  return section;
}

// ── Fly-To presets ────────────────────────────────────────────────────────────

// Gate Z positions derived from layout constants (hardcoded approximate values
// matching buildTimelinePositions() in timelineLayout.ts):
//   BRIDGE_NEAR_Z ≈ 10.39,  BRIDGE_FAR_Z ≈ 30.39
//   spanFar  = 30.39 - 1.5 = 28.89  (oldest / spawn side)
//   spanNear = 10.39 + 1.5 = 11.89  (newest / arena side)
//   Gates evenly spaced: t = 0, 1/3, 2/3, 1

interface Preset {
  label: string;
  sub?: string;
  cam:    [number, number, number];
  target: [number, number, number];
}

const PRESETS: Preset[] = [
  { label: "Arena",      sub: "hub view",       cam: [7, 9, -9],      target: [0, 0, 0]      },
  { label: "Bird's Eye", sub: "overview",        cam: [0, 55, 15],     target: [0, 0, 12]     },
  { label: "Bridge",     sub: "full span",       cam: [9, 16, 20],     target: [0, 1, 18]     },
  { label: "Spawn Pad",  sub: "start area",      cam: [6, 8, 40],      target: [0, 0, 33]     },
  { label: "Gate 2018",  sub: "oldest — spawn",  cam: [5, 5, 33],      target: [0, 1, 28.9]   },
  { label: "Gate 2019",  sub: "",                cam: [5, 5, 27.5],    target: [0, 1, 23.2]   },
  { label: "Gate 2022",  sub: "",                cam: [5, 5, 21.5],    target: [0, 1, 17.6]   },
  { label: "Gate 2024",  sub: "newest — arena",  cam: [5, 5, 15],      target: [0, 1, 11.9]   },
];

function buildFlyToSection(): HTMLElement {
  const color = "#f8a07c";
  const id = "flyto";
  const isCollapsed = collapsed[id] ?? false;

  const section = document.createElement("div");
  section.className = "dp-section";
  section.dataset.sectionId = id;

  // Header
  const header = document.createElement("div");
  header.className = "dp-section-header";

  const chevron = document.createElement("span");
  chevron.className = "dp-chevron" + (isCollapsed ? " collapsed" : "");
  chevron.textContent = "▾";

  const titleEl = document.createElement("span");
  titleEl.className = "dp-section-title";
  titleEl.style.color = color;
  titleEl.textContent = "Fly To";

  header.appendChild(chevron);
  header.appendChild(titleEl);
  section.appendChild(header);

  // Content wrapper (collapsible)
  const content = document.createElement("div");
  content.className = "dp-rows" + (isCollapsed ? " collapsed" : "");

  // Preset grid
  const grid = document.createElement("div");
  grid.className = "dp-preset-grid";

  for (const preset of PRESETS) {
    const btn = document.createElement("button");
    btn.className = "dp-preset-btn";

    const labelEl = document.createElement("span");
    labelEl.textContent = preset.label;

    if (preset.sub) {
      const subEl = document.createElement("span");
      subEl.className = "dp-preset-sub";
      subEl.textContent = preset.sub;
      btn.appendChild(labelEl);
      btn.appendChild(subEl);
    } else {
      btn.textContent = preset.label;
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deps?.setCameraLookAt(preset.cam, preset.target);
    });
    grid.appendChild(btn);
  }
  content.appendChild(grid);

  // Divider
  const hr = document.createElement("hr");
  hr.className = "dp-divider";
  content.appendChild(hr);

  // Manual coordinate inputs
  const coordRow = document.createElement("div");
  coordRow.className = "dp-coord-row";

  const mkInput = (placeholder: string, defaultVal: string) => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "dp-coord-input";
    inp.placeholder = placeholder;
    inp.value = defaultVal;
    inp.addEventListener("click", (e) => e.stopPropagation());
    inp.addEventListener("keydown", (e) => e.stopPropagation());
    return inp;
  };

  const xIn = mkInput("x", "0");
  const yIn = mkInput("y", "8");
  const zIn = mkInput("z", "0");

  const goBtn = document.createElement("button");
  goBtn.className = "dp-teleport-go";
  goBtn.textContent = "Go →";
  goBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const x = parseFloat(xIn.value);
    const y = parseFloat(yIn.value);
    const z = parseFloat(zIn.value);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      const target = deps?.getOrbitTarget();
      deps?.setCameraLookAt(
        [x, y, z],
        target ? [target.x, target.y, target.z] : [0, 0, 0],
      );
    }
  });

  const xLbl = document.createElement("span"); xLbl.className = "dp-coord-label"; xLbl.textContent = "x";
  const yLbl = document.createElement("span"); yLbl.className = "dp-coord-label"; yLbl.textContent = "y";
  const zLbl = document.createElement("span"); zLbl.className = "dp-coord-label"; zLbl.textContent = "z";

  coordRow.appendChild(xLbl); coordRow.appendChild(xIn);
  coordRow.appendChild(yLbl); coordRow.appendChild(yIn);
  coordRow.appendChild(zLbl); coordRow.appendChild(zIn);
  coordRow.appendChild(goBtn);
  content.appendChild(coordRow);

  section.appendChild(content);

  // Toggle collapse
  header.addEventListener("click", () => {
    collapsed[id] = !collapsed[id];
    chevron.classList.toggle("collapsed", collapsed[id]);
    content.classList.toggle("collapsed", collapsed[id]);
  });

  return section;
}

// ── Dragging ──────────────────────────────────────────────────────────────────

function attachDrag(header: HTMLElement, el: HTMLElement): void {
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  header.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).id === "dp-close") return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = el.offsetLeft;
    startTop = el.offsetTop;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
    const newTop  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
    el.style.left = `${newLeft}px`;
    el.style.top  = `${newTop}px`;
  });

  document.addEventListener("mouseup", () => { dragging = false; });
}

// ── Build / render ─────────────────────────────────────────────────────────────

function buildPanel(): HTMLElement {
  const el = document.createElement("div");
  el.id = "dp-panel";
  el.classList.add("dp-hidden");

  // Header
  const header = document.createElement("div");
  header.id = "dp-header";

  const badge = document.createElement("span");
  badge.id = "dp-badge";
  badge.textContent = "DEV";

  const fps = document.createElement("span");
  fps.id = "dp-fps";
  fps.textContent = "-- FPS";

  const ft = document.createElement("span");
  ft.id = "dp-frametime";
  ft.textContent = "--ms";

  const closeBtn = document.createElement("button");
  closeBtn.id = "dp-close";
  closeBtn.title = "Close (`)";
  closeBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  closeBtn.addEventListener("click", () => setVisible(false));

  header.appendChild(badge);
  header.appendChild(fps);
  header.appendChild(ft);
  header.appendChild(closeBtn);
  el.appendChild(header);

  // Body (sections populated on update)
  const body = document.createElement("div");
  body.id = "dp-body";
  el.appendChild(body);

  // Footer
  const footer = document.createElement("div");
  footer.id = "dp-footer";
  footer.textContent = "LMB/1-finger pan · RMB/2-finger orbit · scroll zoom · WASD QE move · ` toggle";
  el.appendChild(footer);

  attachDrag(header, el);
  document.body.appendChild(el);
  return el;
}

function buildFab(): HTMLElement {
  const el = document.createElement("button");
  el.id = "dp-fab";
  el.textContent = "DEV";
  el.title = "Toggle dev panel";
  el.addEventListener("click", () => setVisible(!visible));
  document.body.appendChild(el);
  return el;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function initDevPanel(d: DevPanelDeps): void {
  deps = d;
  injectStyles();
  panel = buildPanel();
  fab = buildFab();

  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote") setVisible(!visible);
  });
}

export function setVisible(show: boolean): void {
  visible = show;
  if (!panel || !fab) return;
  panel.classList.toggle("dp-hidden", !show);
  fab.classList.toggle("dp-fab-active", show);
}

export function isDevPanelVisible(): boolean {
  return visible;
}

export function updateDevPanel(): void {
  if (!visible || !deps || !panel) return;

  // ── FPS / frame time ──────────────────────────────────────────────────────
  const now = performance.now();
  const frameMs = now - lastFrameTime;
  lastFrameTime = now;
  fpsFrames++;

  if (now - fpsLastTime >= 500) {
    fpsDisplay = Math.round((fpsFrames * 1000) / (now - fpsLastTime));
    frameTimeDisplay = parseFloat((1000 / Math.max(fpsDisplay, 1)).toFixed(1));
    fpsFrames = 0;
    fpsLastTime = now;
  }

  // Update header stats
  const fpsEl = panel.querySelector<HTMLElement>("#dp-fps");
  const ftEl  = panel.querySelector<HTMLElement>("#dp-frametime");
  if (fpsEl) {
    fpsEl.textContent = `${fpsDisplay} FPS`;
    fpsEl.style.color = fpsDisplay >= 55 ? "#7cf8a4" : fpsDisplay >= 30 ? "#f8c87c" : "#ff5a5a";
  }
  if (ftEl) ftEl.textContent = `${frameTimeDisplay}ms`;

  // ── Section data ──────────────────────────────────────────────────────────
  const {
    camera, renderer, getCharacter, getDog,
    getCompletedGateCount, getDiscoveryCount, getOrbitTarget,
  } = deps;
  const character = getCharacter();
  const dog = getDog();
  const ri = renderer.info;
  const cp = camera.position;
  const cr = camera.rotation;
  const ot = getOrbitTarget();

  // Device info (computed once, cached)
  if (!deviceInfoCache) deviceInfoCache = buildDeviceInfo();

  // null data = special section (flyto), handled separately in reconcile
  const sections: Array<{ id: string; title: string; data: Record<string, string> | null }> = [
    {
      id: "device",
      title: "Device",
      data: deviceInfoCache,
    },
    {
      id: "performance",
      title: "Performance",
      data: {
        fps:          `${fpsDisplay}`,
        "frame time": `${frameMs.toFixed(1)} ms`,
        triangles:    ri.render.triangles.toLocaleString(),
        "draw calls": String(ri.render.calls),
        geometries:   String(ri.memory.geometries),
        textures:     String(ri.memory.textures),
        "pixel ratio": String(renderer.getPixelRatio()),
      },
    },
    {
      id: "camera",
      title: "Camera",
      data: {
        "pos x":  cp.x.toFixed(2),
        "pos y":  cp.y.toFixed(2),
        "pos z":  cp.z.toFixed(2),
        "tgt x":  ot.x.toFixed(2),
        "tgt y":  ot.y.toFixed(2),
        "tgt z":  ot.z.toFixed(2),
        "rx":     `${THREE.MathUtils.radToDeg(cr.x).toFixed(1)}°`,
        "ry":     `${THREE.MathUtils.radToDeg(cr.y).toFixed(1)}°`,
        fov:      `${camera.fov.toFixed(0)}°`,
      },
    },
    { id: "flyto", title: "Fly To", data: null },
  ];

  if (character) {
    sections.push({ id: "player", title: "Player", data: character.getDebugInfo() });
  }

  if (dog) {
    sections.push({ id: "dog", title: "Dog", data: dog.getDebugInfo() });
  }

  sections.push({
    id: "world",
    title: "World",
    data: {
      gates:       `${getCompletedGateCount()} / 4`,
      discoveries: `${getDiscoveryCount()} / 7`,
    },
  });

  // ── Reconcile DOM ─────────────────────────────────────────────────────────
  const body = panel.querySelector<HTMLElement>("#dp-body")!;

  sections.forEach(({ id, title, data }) => {
    let section = body.querySelector<HTMLElement>(`[data-section-id="${id}"]`);

    if (!section) {
      // First render: build section
      section = data === null
        ? buildFlyToSection()
        : buildSection(id, title, data);
      body.appendChild(section);
    } else if (data !== null) {
      // Subsequent renders: update values in-place (no rebuild = no layout thrash)
      const rows = section.querySelectorAll<HTMLElement>(".dp-row");
      const entries = Object.entries(data);
      entries.forEach(([, v], i) => {
        const row = rows[i];
        if (!row) return;
        const valEl = row.querySelector<HTMLElement>(".dp-val");
        if (valEl && valEl.textContent !== v) valEl.textContent = v;
      });
    }
    // flyto section (data === null) is static — nothing to update
  });
}
