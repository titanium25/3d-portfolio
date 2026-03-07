import * as THREE from "three";
import { TIMELINE_STOPS } from "../scene/timeline/timelineConfig";
import { isStopCompleted } from "../scene/timeline/createTimelineStops";

/* ── Configuration ──────────────────────────────────────────── */

const MOTE_COUNT = 4;
const BURST_MS = 280;
const TRAVEL_MS = 520;

/* ── State ──────────────────────────────────────────────────── */

let stylesInjected = false;
let dotsCreated = false;
let firstTooltipShown = false;

/* ── Styles ─────────────────────────────────────────────────── */

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const s = document.createElement("style");
  s.id = "gate-unlock-styles";
  s.textContent = `
    #cv-btn-dots {
      display: flex;
      gap: 3px;
      justify-content: center;
      margin-top: 2px;
    }
    .cv-btn-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      transition: background 0.4s ease, box-shadow 0.4s ease;
    }
    .cv-btn-dot.filled {
      background: #00e5cc;
      box-shadow: 0 0 6px rgba(0,229,204,0.5);
    }

    #cv-btn.cv-btn-has-unlocks {
      border-color: rgba(0,229,204,0.5);
      box-shadow: 0 0 18px rgba(0,229,204,0.2);
    }

    @keyframes gateRingPulse {
      0%   { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
      100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
    }

    #gate-unlock-tooltip {
      position: fixed;
      z-index: 2002;
      pointer-events: none;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.4s ease, transform 0.4s ease;
      padding: 0.5rem 1rem;
      background: rgba(6, 10, 20, 0.85);
      border: 1px solid rgba(0,229,204,0.22);
      border-radius: 10px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.73rem;
      font-weight: 500;
      color: rgba(0,229,204,0.85);
      white-space: nowrap;
    }
    #gate-unlock-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(s);
}

/* ── Progress dots beneath the Resume button ────────────────── */

function ensureDots(): void {
  if (dotsCreated) return;
  const btn = document.getElementById("cv-btn");
  if (!btn) return;
  dotsCreated = true;

  const wrap = document.createElement("div");
  wrap.id = "cv-btn-dots";
  for (let i = 0; i < TIMELINE_STOPS.length; i++) {
    const dot = document.createElement("div");
    dot.className = "cv-btn-dot";
    dot.dataset.idx = String(i);
    wrap.appendChild(dot);
  }
  btn.appendChild(wrap);
}

export function refreshProgressDots(): void {
  ensureDots();

  let count = 0;
  TIMELINE_STOPS.forEach((stop, i) => {
    const dot = document.querySelector(`.cv-btn-dot[data-idx="${i}"]`);
    if (dot && isStopCompleted(stop.id)) {
      dot.classList.add("filled");
      count++;
    }
  });

  const btn = document.getElementById("cv-btn");
  if (btn) btn.classList.toggle("cv-btn-has-unlocks", count > 0);
}

/* ── First-unlock tooltip ───────────────────────────────────── */

function showFirstUnlockTooltip(): void {
  if (firstTooltipShown) return;
  firstTooltipShown = true;

  const btn = document.getElementById("cv-btn");
  if (!btn) return;

  const tip = document.createElement("div");
  tip.id = "gate-unlock-tooltip";
  tip.textContent = "Your dossier is building\u2026";
  document.body.appendChild(tip);

  const r = btn.getBoundingClientRect();
  tip.style.top = `${r.bottom + 12}px`;
  tip.style.right = `${window.innerWidth - r.right}px`;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => tip.classList.add("visible")),
  );

  setTimeout(() => {
    tip.classList.remove("visible");
    setTimeout(() => tip.remove(), 450);
  }, 3200);
}

/* ── Mote animation (3D gate → 2D Resume button) ───────────── */

export function triggerGateUnlock(
  gateWorldPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
): void {
  injectStyles();
  ensureDots();

  const btn = document.getElementById("cv-btn");
  if (!btn) return;

  // Project gate 3D position to screen coordinates
  const proj = gateWorldPos.clone().project(camera);
  const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;

  // Resume button center
  const br = btn.getBoundingClientRect();
  const ex = br.left + br.width / 2;
  const ey = br.top + br.height / 2;

  // Mote container
  const ctr = document.createElement("div");
  ctr.style.cssText =
    "position:fixed;inset:0;z-index:1999;pointer-events:none;overflow:hidden;";
  document.body.appendChild(ctr);

  interface Mote {
    el: HTMLDivElement;
    bx: number;
    by: number;
    cx: number;
    cy: number;
    delay: number;
  }

  const motes: Mote[] = [];

  for (let i = 0; i < MOTE_COUNT; i++) {
    const el = document.createElement("div");
    const sz = 5 + Math.random() * 4;
    el.style.cssText = `
      position:absolute;left:0;top:0;
      width:${sz}px;height:${sz}px;border-radius:50%;
      background:#00e5cc;
      box-shadow:0 0 ${8 + sz}px ${2 + sz / 2}px rgba(0,229,204,0.5),
                 0 0 ${18 + sz}px ${4 + sz}px rgba(0,229,204,0.15);
      opacity:0;will-change:transform,opacity;
    `;
    ctr.appendChild(el);

    // Burst scatter direction
    const angle =
      (Math.PI * 2 * i) / MOTE_COUNT + (Math.random() - 0.5) * 0.6;
    const dist = 20 + Math.random() * 35;
    const bx = sx + Math.cos(angle) * dist;
    const by = sy + Math.sin(angle) * dist;

    // Bezier control point for the arc
    const mx = (bx + ex) / 2;
    const my = (by + ey) / 2;
    const perpAngle = Math.atan2(ey - by, ex - bx) + Math.PI / 2;
    const arcOff = (Math.random() - 0.5) * 160;
    const cx = mx + Math.cos(perpAngle) * arcOff;
    const cy = my + Math.sin(perpAngle) * arcOff - 50 - Math.random() * 50;

    motes.push({ el, bx, by, cx, cy, delay: i * 0.06 });
  }

  const t0 = performance.now();

  function tick(): void {
    const dt = performance.now() - t0;

    for (const m of motes) {
      if (dt < BURST_MS) {
        // Phase 1: burst scatter
        const t = dt / BURST_MS;
        const e = 1 - (1 - t) ** 3;
        const x = sx + (m.bx - sx) * e;
        const y = sy + (m.by - sy) * e;
        m.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
        m.el.style.opacity = String(0.3 + t * 0.7);
      } else {
        // Phase 2: arc travel to button
        const raw = (dt - BURST_MS) / TRAVEL_MS;
        const staggered = Math.max(
          0,
          Math.min(1, (raw - m.delay) / (1 - (MOTE_COUNT - 1) * 0.06)),
        );
        const e =
          staggered < 0.5
            ? 2 * staggered * staggered
            : 1 - (-2 * staggered + 2) ** 2 / 2;

        const omt = 1 - e;
        const x = omt * omt * m.bx + 2 * omt * e * m.cx + e * e * ex;
        const y = omt * omt * m.by + 2 * omt * e * m.cy + e * e * ey;
        const scale = 1 - e * 0.5;

        m.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${scale})`;
        m.el.style.opacity = String(1 - e * 0.3);
      }
    }

    if (dt < BURST_MS + TRAVEL_MS) {
      requestAnimationFrame(tick);
    } else {
      ctr.remove();
      absorb();
    }
  }

  requestAnimationFrame(tick);

  /* Phase 3: button absorption */
  function absorb(): void {
    if (!btn) return;

    // Elastic scale pulse
    btn.style.transition =
      "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, border-color 0.2s ease";
    btn.style.transform = "translateY(-1px) scale(1.12)";
    btn.style.boxShadow =
      "0 0 32px rgba(0,229,204,0.5), 0 0 56px rgba(0,229,204,0.2)";
    btn.style.borderColor = "rgba(0,229,204,0.8)";
    btn.style.animation = "none";

    // Sonar ring pulse
    const ring = document.createElement("div");
    const rr = btn.getBoundingClientRect();
    ring.style.cssText = `
      position:fixed;z-index:2001;pointer-events:none;
      left:${rr.left + rr.width / 2}px;
      top:${rr.top + rr.height / 2}px;
      width:${rr.width + 20}px;height:${rr.height + 20}px;
      border-radius:28px;
      border:2px solid rgba(0,229,204,0.6);
      animation:gateRingPulse 0.65s ease-out forwards;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(ring);

    // Settle button scale
    setTimeout(() => {
      btn.style.transform = "";
      btn.style.transition =
        "transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease";
    }, 250);

    setTimeout(() => ring.remove(), 700);

    // Update progress dots
    refreshProgressDots();

    // Sustained glow then fade to persistent state
    setTimeout(() => {
      btn.style.boxShadow = "";
      btn.style.borderColor = "";
      btn.style.transition = "";
      btn.style.animation = "";
    }, 2500);

    // First unlock tooltip (only on the very first gate ever)
    const completed = TIMELINE_STOPS.filter((s) =>
      isStopCompleted(s.id),
    ).length;
    if (completed === 1) {
      showFirstUnlockTooltip();
    }
  }
}

/* ── Init (call once during app setup) ──────────────────────── */

export function initGateUnlockAnimation(): void {
  injectStyles();
  setTimeout(() => {
    ensureDots();
    refreshProgressDots();
  }, 200);
}
