let progressContainer: HTMLElement | null = null;
let progressBar: HTMLElement | null = null;
let statusLabel: HTMLElement | null = null;
let pctEl: HTMLElement | null = null;
let loaded = 0;
let totalAssets = 0;

const PHASES = [
  { at: 0,  msg: "Initializing" },
  { at: 18, msg: "Loading Terrain" },
  { at: 35, msg: "Placing Structures" },
  { at: 52, msg: "Summoning Characters" },
  { at: 70, msg: "Activating Portals" },
  { at: 88, msg: "Calibrating World" },
  { at: 99, msg: "Ready" },
];

function getPhaseMsg(pct: number): string {
  let msg = PHASES[0].msg;
  for (const p of PHASES) {
    if (pct >= p.at) msg = p.msg;
  }
  return msg;
}

function injectStyles(): void {
  if (document.getElementById("ls-styles")) return;
  const s = document.createElement("style");
  s.id = "ls-styles";
  s.textContent = `
    #ls-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1003;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.7s ease-out, transform 0.7s ease-out;
      animation: ls-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes ls-enter {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    #ls-inner {
      padding: 7px 28px calc(14px + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    #ls-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }

    #ls-status {
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: clamp(11px, 1.4vw, 12px);
      font-weight: 400;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.45);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 0.5s ease;
    }

    #ls-pct {
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: clamp(11px, 1.4vw, 12px);
      font-weight: 300;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.38);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      min-width: 3.2ch;
      text-align: right;
      transition: color 0.5s ease;
    }

    #ls-track {
      width: 100%;
      height: 2px;
      background: rgba(255, 255, 255, 0.10);
      position: relative;
      border-radius: 1px;
      overflow: hidden;
    }

    #ls-fill {
      height: 100%;
      width: 0%;
      background: rgba(255, 255, 255, 0.6);
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.35);
      transition: width 0.42s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 1px;
    }

    /* Complete state */
    #ls-fill.ls-done {
      background: rgba(0, 229, 204, 0.6);
      box-shadow: 0 0 8px rgba(0, 229, 204, 0.35);
    }

    #ls-status.ls-done,
    #ls-pct.ls-done {
      color: rgba(255, 255, 255, 0.45);
    }

    @keyframes ls-phase-swap {
      0%   { opacity: 1; }
      30%  { opacity: 0.3; }
      100% { opacity: 1; }
    }

    #ls-status.ls-phase-swap {
      animation: ls-phase-swap 0.4s ease both;
    }

    @media (max-width: 600px) {
      #ls-inner {
        padding: 9px 20px calc(13px + env(safe-area-inset-bottom, 0px));
        gap: 8px;
      }

      #ls-status {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.55);
      }

      #ls-pct {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
      }

      #ls-track {
        height: 3px;
        background: rgba(255, 255, 255, 0.12);
      }

      #ls-fill {
        background: rgba(0, 229, 204, 0.5);
        box-shadow: 0 0 8px rgba(0, 229, 204, 0.3);
      }
    }
  `;
  document.head.appendChild(s);
}

/**
 * Creates and returns a refined bottom-bar progress indicator.
 */
export function createProgressIndicator(): HTMLElement {
  loaded = 0;

  injectStyles();

  progressContainer = document.createElement("div");
  progressContainer.id = "ls-bar";

  const inner = document.createElement("div");
  inner.id = "ls-inner";

  // Text row
  const row = document.createElement("div");
  row.id = "ls-row";

  statusLabel = document.createElement("div");
  statusLabel.id = "ls-status";
  statusLabel.textContent = "Initializing";

  pctEl = document.createElement("div");
  pctEl.id = "ls-pct";
  pctEl.textContent = "0%";

  row.appendChild(statusLabel);
  row.appendChild(pctEl);

  // Track + fill
  const track = document.createElement("div");
  track.id = "ls-track";

  progressBar = document.createElement("div");
  progressBar.id = "ls-fill";

  track.appendChild(progressBar);
  inner.appendChild(row);
  inner.appendChild(track);
  progressContainer.appendChild(inner);
  document.body.appendChild(progressContainer);

  return progressContainer;
}

/**
 * Sets the total number of assets that will be loaded.
 */
export function setTotalAssets(total: number): void {
  totalAssets = total;
}

/**
 * Call once per asset that finishes loading.
 */
export function assetLoaded(): void {
  if (totalAssets === 0) {
    console.warn("Total assets not set. Call setTotalAssets() first.");
    return;
  }

  loaded++;
  const pct = Math.min(100, Math.round((loaded / totalAssets) * 100));

  if (progressBar) {
    progressBar.style.width = `${pct}%`;
  }

  if (statusLabel) {
    const nextMsg = getPhaseMsg(pct);
    if (statusLabel.textContent !== nextMsg) {
      statusLabel.classList.remove("ls-phase-swap");
      void statusLabel.offsetWidth; // force reflow to restart animation
      statusLabel.textContent = nextMsg;
      statusLabel.classList.add("ls-phase-swap");
      statusLabel.addEventListener("animationend", () => statusLabel!.classList.remove("ls-phase-swap"), { once: true });
    }
  }
  if (pctEl) pctEl.textContent = `${pct}%`;
}

/**
 * Smoothly fades out and removes the progress indicator.
 */
export function hideProgressIndicator(): Promise<void> {
  return new Promise((resolve) => {
    if (!progressContainer) {
      resolve();
      return;
    }

    // Snap to complete state
    if (progressBar) {
      progressBar.style.width = "100%";
      progressBar.classList.remove("ls-active");
      progressBar.classList.add("ls-done");
    }
    if (statusLabel) {
      statusLabel.textContent = "Ready";
      statusLabel.classList.add("ls-done");
    }
    if (pctEl) {
      pctEl.textContent = "100%";
      pctEl.classList.add("ls-done");
    }

    setTimeout(() => {
      if (progressContainer) {
        progressContainer.style.opacity = "0";
        progressContainer.style.transform = "translateY(8px)";
        setTimeout(() => {
          progressContainer?.remove();
          progressContainer = null;
          progressBar = null;
          statusLabel = null;
          pctEl = null;
          resolve();
        }, 700);
      } else {
        resolve();
      }
    }, 380);
  });
}

/**
 * Preloads an array of image URLs using the browser's image cache.
 */
export function preloadImages(
  paths: string[],
  onEach?: () => void,
): Promise<void> {
  return Promise.all(
    paths.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new window.Image();
          img.onload = img.onerror = () => {
            onEach?.();
            resolve();
          };
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}

// Legacy functions for backwards compatibility
export function showLoadingScreen(): void {
  createProgressIndicator();
}

export function hideLoadingScreen(): Promise<void> {
  return hideProgressIndicator();
}
