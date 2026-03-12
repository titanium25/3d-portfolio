// ── Photo Lightbox — cinematic album viewer ───────────────────────────────────
// API:
//   openLightboxAlbum(photos, startIndex, triggerEl, options?)
//   openPhotoLightbox(src, triggerEl, options?)   ← backward-compat single photo
//   closePhotoLightbox()
//   attachZoomHint(container, getSrc, options?)   ← adds hover hint + click

export interface LightboxPhoto {
  src: string;
  caption?: string;
  objectPosition?: string;
}

export interface PhotoLightboxOptions {
  shape?: "circle" | "rect";
  caption?: string;
  album?: LightboxPhoto[];
  albumIndex?: number;
  hintSize?: number;
}

// ── State ─────────────────────────────────────────────────────────────────────

let lbEl:        HTMLDivElement   | null = null;
let lbImgEl:     HTMLImageElement | null = null;
let lbImgWrap:   HTMLDivElement   | null = null;
let lbSkeleton:  HTMLDivElement   | null = null;
let lbErrorEl:   HTMLDivElement   | null = null;
let lbCaptionEl: HTMLDivElement   | null = null;
let lbCounterEl: HTMLDivElement   | null = null;
let lbDotsEl:    HTMLDivElement   | null = null;
let lbPrevBtn:   HTMLButtonElement| null = null;
let lbNextBtn:   HTMLButtonElement| null = null;
let lbProgressEl:HTMLDivElement   | null = null;

let isOpen        = false;
let currentAlbum: LightboxPhoto[] = [];
let currentIdx    = 0;
let currentShape: "circle" | "rect" = "rect";
let lastTriggerEl: HTMLElement | null = null;
// isLoading is tracked via lbSkeleton CSS class, not a JS flag

// Touch swipe tracking
let touchStartX = 0;
let touchStartY = 0;
let swipeLocked  = false;

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("plb-styles")) return;
  const s = document.createElement("style");
  s.id = "plb-styles";
  s.textContent = `
    /* ══════════════════════════════════════════════
       LIGHTBOX OVERLAY
    ══════════════════════════════════════════════ */
    #plb-overlay {
      position: fixed;
      inset: 0;
      z-index: 9000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(4,6,16,0);
      cursor: zoom-out;
      overscroll-behavior: none;
      -webkit-tap-highlight-color: transparent;
    }
    /* Radial vignette + backdrop */
    #plb-overlay::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(4,6,16,0.45) 100%),
        rgba(4,6,16,0);
      transition: background 0.38s ease;
      pointer-events: none;
    }
    #plb-overlay.plb-open::before {
      background:
        radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(4,6,16,0.6) 100%),
        rgba(4,6,16,0.96);
    }
    /* Noise grain texture overlay */
    #plb-overlay::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.38s ease;
    }
    #plb-overlay.plb-open::after { opacity: 1; }

    /* ── Progress bar (top of viewport) ── */
    #plb-progress-bar {
      position: absolute;
      top: 0; left: 0;
      height: 2px;
      background: linear-gradient(to right, rgba(0,229,204,0.9), rgba(0,229,204,0.4));
      box-shadow: 0 0 10px rgba(0,229,204,0.6);
      width: 0%;
      transition: width 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease;
      opacity: 0;
      z-index: 2;
      pointer-events: none;
    }
    #plb-overlay.plb-open #plb-progress-bar { opacity: 1; }

    /* ── Top bar ── */
    #plb-topbar {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: env(safe-area-inset-top, 0px) 1.2rem 0;
      padding-top: max(env(safe-area-inset-top, 0px), 1rem);
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 10;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-8px);
      transition: opacity 0.3s ease 0.15s, transform 0.35s ease 0.15s;
    }
    #plb-overlay.plb-open #plb-topbar {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    #plb-counter {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.38);
      line-height: 1;
      user-select: none;
    }
    #plb-close {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 0;
    }
    #plb-close svg { width: 14px; height: 14px; stroke: currentColor; display: block; }
    #plb-close:hover {
      background: rgba(239,68,68,0.14);
      border-color: rgba(239,68,68,0.45);
      color: rgba(252,165,165,0.9);
      transform: rotate(90deg);
    }
    #plb-close:focus-visible { outline: 2px solid rgba(0,229,204,0.6); outline-offset: 3px; }

    /* ── Stage (contains nav + image) ── */
    #plb-stage {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex: 1;
      cursor: default;
      gap: 0;
    }

    /* ── Nav arrows ── */
    .plb-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 48px; height: 48px;
      border-radius: 50%;
      background: rgba(10,14,26,0.7);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 5;
      opacity: 0;
      transition:
        opacity 0.25s ease,
        background 0.18s,
        border-color 0.18s,
        color 0.18s,
        transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
        box-shadow 0.2s ease;
      padding: 0;
    }
    .plb-nav-btn svg { width: 18px; height: 18px; stroke: currentColor; display: block; }
    #plb-overlay.plb-open .plb-nav-btn { opacity: 1; }
    #plb-prev { left: clamp(0.75rem, 3vw, 2.5rem); transform: translateY(-50%) translateX(0); }
    #plb-next { right: clamp(0.75rem, 3vw, 2.5rem); transform: translateY(-50%) translateX(0); }
    .plb-nav-btn:hover {
      background: rgba(0,229,204,0.12);
      border-color: rgba(0,229,204,0.42);
      color: #00e5cc;
      box-shadow: 0 0 24px rgba(0,229,204,0.22);
    }
    #plb-prev:hover { transform: translateY(-50%) translateX(-2px); }
    #plb-next:hover { transform: translateY(-50%) translateX(2px); }
    .plb-nav-btn:disabled {
      opacity: 0.18 !important;
      cursor: default;
      pointer-events: none;
    }
    .plb-nav-btn:focus-visible { outline: 2px solid rgba(0,229,204,0.6); outline-offset: 3px; }
    /* Hide arrows when only 1 photo */
    #plb-overlay.plb-single .plb-nav-btn { display: none; }

    /* ── Image wrapper ── */
    #plb-img-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
    }
    #plb-img-wrap.plb-circle {
      width: min(360px, 80vmin);
      height: min(360px, 80vmin);
      border-radius: 50%;
    }
    #plb-img-wrap.plb-rect {
      max-width: min(680px, 88vw);
      max-height: 72vh;
      border-radius: 14px;
      overflow: hidden;
    }

    /* ── The image ── */
    #plb-img {
      display: block;
      object-fit: cover;
      will-change: transform, opacity;
      user-select: none;
      -webkit-user-drag: none;
      border: 1.5px solid rgba(0,229,204,0.25);
      box-shadow:
        0 0 0 1px rgba(0,229,204,0.06),
        0 0 60px rgba(0,229,204,0.12),
        0 40px 100px rgba(0,0,0,0.85);
      transition: opacity 0.22s ease, transform 0.22s ease;
    }
    #plb-img-wrap.plb-circle #plb-img {
      width: 100%; height: 100%;
      border-radius: 50%;
      object-position: center top;
    }
    #plb-img-wrap.plb-rect #plb-img {
      max-width: min(680px, 88vw);
      max-height: 72vh;
      border-radius: 14px;
      width: auto; height: auto;
      object-fit: contain;
    }

    /* ── Loading skeleton ── */
    #plb-skeleton {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      background: rgba(255,255,255,0.03);
      border: 1.5px solid rgba(255,255,255,0.07);
    }
    #plb-skeleton.plb-loading { opacity: 1; }
    #plb-skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        108deg,
        transparent 20%,
        rgba(255,255,255,0.045) 45%,
        rgba(255,255,255,0.09) 50%,
        rgba(255,255,255,0.045) 55%,
        transparent 80%
      );
      background-size: 280% 100%;
      animation: plbShimmer 1.8s ease-in-out infinite;
    }
    @keyframes plbShimmer {
      0%   { background-position: 240% 0; }
      100% { background-position: -240% 0; }
    }
    /* Skeleton placeholder lines */
    #plb-skeleton::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 50% 50%, rgba(0,229,204,0.04) 0%, transparent 60%);
    }

    /* ── Error state ── */
    #plb-error-state {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      border-radius: inherit;
      background: rgba(255,255,255,0.02);
      border: 1.5px solid rgba(255,255,255,0.07);
      padding: 1.5rem;
    }
    #plb-error-state.plb-show { display: flex; }
    .plb-error-icon {
      color: rgba(255,255,255,0.2);
    }
    .plb-error-icon svg { width: 40px; height: 40px; stroke: currentColor; display: block; }
    .plb-error-msg {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.22);
      text-align: center;
    }
    #plb-retry {
      padding: 0.4rem 1rem;
      border-radius: 20px;
      border: 1px solid rgba(0,229,204,0.3);
      background: rgba(0,229,204,0.06);
      color: rgba(0,229,204,0.75);
      font-size: 0.6rem;
      font-family: 'Courier New', Courier, monospace;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.18s, border-color 0.18s, color 0.18s;
    }
    #plb-retry:hover {
      background: rgba(0,229,204,0.14);
      border-color: rgba(0,229,204,0.55);
      color: #00e5cc;
    }

    /* ── Bottom bar: caption + dots ── */
    #plb-bottom {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 0 2rem max(env(safe-area-inset-bottom, 0px), 1.4rem);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.7rem;
      pointer-events: none;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.3s ease 0.2s, transform 0.35s ease 0.2s;
      z-index: 10;
    }
    #plb-overlay.plb-open #plb-bottom {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    #plb-caption {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 0.7rem;
      font-weight: 400;
      font-style: italic;
      color: rgba(255,255,255,0.35);
      text-align: center;
      max-width: 520px;
      line-height: 1.55;
      min-height: 1rem;
      transition: opacity 0.2s ease;
    }
    #plb-dots {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .plb-dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: rgba(255,255,255,0.22);
      cursor: pointer;
      transition: background 0.2s, transform 0.2s, width 0.25s cubic-bezier(0.34,1.56,0.64,1);
      pointer-events: auto;
    }
    .plb-dot.active {
      background: #00e5cc;
      width: 18px;
      border-radius: 3px;
      box-shadow: 0 0 8px rgba(0,229,204,0.7);
    }
    .plb-dot:hover:not(.active) {
      background: rgba(255,255,255,0.45);
      transform: scale(1.3);
    }
    /* Hide dots bar when single photo */
    #plb-overlay.plb-single #plb-dots { display: none; }

    /* ── Slide transition classes ── */
    #plb-img.plb-exit-left   { opacity: 0; transform: translateX(-28px) scale(0.97); }
    #plb-img.plb-exit-right  { opacity: 0; transform: translateX( 28px) scale(0.97); }
    #plb-img.plb-enter-left  { opacity: 0; transform: translateX( 22px) scale(0.98); }
    #plb-img.plb-enter-right { opacity: 0; transform: translateX(-22px) scale(0.98); }

    /* ── Keyboard hint (bottom center) ── */
    #plb-hint {
      position: absolute;
      bottom: 1.4rem;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.55rem;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.15);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease 0.35s;
      z-index: 1;
    }
    #plb-overlay.plb-open #plb-hint { opacity: 1; }
    /* Hide hint on touch devices */
    @media (hover: none) { #plb-hint { display: none; } }
    /* Hide hint for single photo — nothing to navigate */
    #plb-overlay.plb-single #plb-hint { display: none; }
    /* Reposition hint when dots are showing */
    #plb-overlay:not(.plb-single) #plb-hint { bottom: 3.8rem; }

    /* ── Zoom hint affordance (attached to trigger containers) ── */
    .plb-trigger { position: relative; cursor: zoom-in; }
    .plb-trigger-hint {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0);
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
      pointer-events: none;
      z-index: 2;
    }
    .plb-trigger:hover .plb-trigger-hint {
      background: rgba(0,0,0,0.32);
      opacity: 1;
    }
    .plb-trigger-hint svg { filter: drop-shadow(0 1px 5px rgba(0,0,0,0.7)); }

    /* ── Mobile: full-width image ── */
    @media (max-width: 480px) {
      #plb-img-wrap.plb-rect {
        max-width: 96vw;
        border-radius: 10px;
      }
      #plb-img-wrap.plb-rect #plb-img {
        max-width: 96vw;
        border-radius: 10px;
      }
      .plb-nav-btn { width: 40px; height: 40px; }
      #plb-prev { left: 0.4rem; }
      #plb-next { right: 0.4rem; }
    }
  `;
  document.head.appendChild(s);
}

// ── DOM ───────────────────────────────────────────────────────────────────────

function createDOM(): void {
  if (lbEl) return;
  injectStyles();

  const lb = document.createElement("div");
  lb.id = "plb-overlay";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Photo viewer");

  lb.innerHTML = `
    <div id="plb-progress-bar"></div>

    <div id="plb-topbar">
      <div id="plb-counter"></div>
      <button id="plb-close" aria-label="Close photo viewer">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div id="plb-stage">
      <button class="plb-nav-btn" id="plb-prev" aria-label="Previous photo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      <div id="plb-img-wrap">
        <div id="plb-skeleton" aria-hidden="true"></div>
        <div id="plb-error-state" aria-hidden="true">
          <div class="plb-error-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <p class="plb-error-msg">Photo unavailable</p>
          <button id="plb-retry">Retry</button>
        </div>
        <img id="plb-img" alt="" draggable="false" />
      </div>

      <button class="plb-nav-btn" id="plb-next" aria-label="Next photo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>

    <div id="plb-bottom">
      <div id="plb-caption"></div>
      <div id="plb-dots"></div>
    </div>

    <div id="plb-hint">← → navigate · ESC close · click outside to dismiss</div>
  `;

  document.body.appendChild(lb);

  // Cache refs
  lbEl         = lb;
  lbImgWrap    = lb.querySelector<HTMLDivElement>("#plb-img-wrap")!;
  lbImgEl      = lb.querySelector<HTMLImageElement>("#plb-img")!;
  lbSkeleton   = lb.querySelector<HTMLDivElement>("#plb-skeleton")!;
  lbErrorEl    = lb.querySelector<HTMLDivElement>("#plb-error-state")!;
  lbCaptionEl  = lb.querySelector<HTMLDivElement>("#plb-caption")!;
  lbCounterEl  = lb.querySelector<HTMLDivElement>("#plb-counter")!;
  lbDotsEl     = lb.querySelector<HTMLDivElement>("#plb-dots")!;
  lbPrevBtn    = lb.querySelector<HTMLButtonElement>("#plb-prev")!;
  lbNextBtn    = lb.querySelector<HTMLButtonElement>("#plb-next")!;
  lbProgressEl = lb.querySelector<HTMLDivElement>("#plb-progress-bar")!;

  // ── Event listeners ──

  // Close on backdrop click (but not on image or controls)
  lb.addEventListener("click", (e) => {
    if (e.target === lb || (e.target as HTMLElement).id === "plb-stage") {
      closePhotoLightbox();
    }
  });

  lb.querySelector<HTMLButtonElement>("#plb-close")!
    .addEventListener("click", (e) => { e.stopPropagation(); closePhotoLightbox(); });

  lbPrevBtn.addEventListener("click", (e) => { e.stopPropagation(); navigatePhoto(-1); });
  lbNextBtn.addEventListener("click", (e) => { e.stopPropagation(); navigatePhoto(1); });

  lb.querySelector<HTMLButtonElement>("#plb-retry")!
    .addEventListener("click", (e) => { e.stopPropagation(); retryLoad(); });

  // Keyboard navigation
  document.addEventListener("keydown", handleKeyDown, true);

  // Touch swipe
  lb.addEventListener("touchstart", onTouchStart, { passive: true });
  lb.addEventListener("touchmove",  onTouchMove,  { passive: false });
  lb.addEventListener("touchend",   onTouchEnd,   { passive: true });
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function handleKeyDown(e: KeyboardEvent): void {
  if (!isOpen) return;
  if (e.code === "Escape") { e.stopImmediatePropagation(); closePhotoLightbox(); return; }
  if (e.code === "ArrowLeft")  { e.preventDefault(); navigatePhoto(-1); }
  if (e.code === "ArrowRight") { e.preventDefault(); navigatePhoto(1); }
}

// ── Touch swipe ───────────────────────────────────────────────────────────────

function onTouchStart(e: TouchEvent): void {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  swipeLocked = false;
}

function onTouchMove(e: TouchEvent): void {
  if (swipeLocked) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  // If more vertical than horizontal, don't swipe
  if (Math.abs(dy) > Math.abs(dx)) { swipeLocked = true; return; }
  if (Math.abs(dx) > 8) e.preventDefault();
}

function onTouchEnd(e: TouchEvent): void {
  if (swipeLocked || currentAlbum.length <= 1) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 44) {
    navigatePhoto(dx < 0 ? 1 : -1);
  }
}

// ── Loading / Error ───────────────────────────────────────────────────────────

function showSkeleton(): void {
  lbImgEl!.style.opacity = "0";
  lbSkeleton!.classList.add("plb-loading");
  lbErrorEl!.classList.remove("plb-show");
  lbErrorEl!.setAttribute("aria-hidden", "true");
}

function hideSkeleton(): void {
  lbSkeleton!.classList.remove("plb-loading");
}

function showError(): void {
  lbSkeleton!.classList.remove("plb-loading");
  lbImgEl!.style.opacity = "0";
  lbErrorEl!.classList.add("plb-show");
  lbErrorEl!.setAttribute("aria-hidden", "false");
}

function retryLoad(): void {
  const photo = currentAlbum[currentIdx];
  if (!photo) return;
  lbErrorEl!.classList.remove("plb-show");
  loadPhoto(photo.src, photo.objectPosition);
}

function loadPhoto(src: string, objectPosition?: string): void {
  showSkeleton();

  const img = new Image();
  img.onload = () => {
    if (!isOpen) return;
    lbImgEl!.src = src;
    if (objectPosition) {
      lbImgEl!.style.objectPosition = objectPosition;
    } else {
      lbImgEl!.style.objectPosition = "";
    }
    hideSkeleton();
    requestAnimationFrame(() => {
      lbImgEl!.style.opacity = "1";
    });
  };
  img.onerror = () => {
    if (!isOpen) return;
    showError();
  };
  img.src = src;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigatePhoto(dir: -1 | 1): void {
  if (currentAlbum.length <= 1) return;
  const newIdx = currentIdx + dir;
  if (newIdx < 0 || newIdx >= currentAlbum.length) return;

  const exitClass  = dir > 0 ? "plb-exit-left"  : "plb-exit-right";
  const enterClass = dir > 0 ? "plb-enter-left"  : "plb-enter-right";

  // Animate out
  lbImgEl!.classList.add(exitClass);
  lbCaptionEl!.style.opacity = "0";

  setTimeout(() => {
    lbImgEl!.classList.remove(exitClass);
    lbImgEl!.classList.add(enterClass);
    lbImgEl!.style.transition = "none";

    currentIdx = newIdx;
    const photo = currentAlbum[currentIdx];

    loadPhoto(photo.src, photo.objectPosition);
    updateMeta();

    requestAnimationFrame(() => requestAnimationFrame(() => {
      lbImgEl!.style.transition = "";
      lbImgEl!.classList.remove(enterClass);
    }));

    setTimeout(() => {
      lbCaptionEl!.style.opacity = "";
    }, 80);
  }, 200);
}

function updateMeta(): void {
  const photo = currentAlbum[currentIdx];
  const total = currentAlbum.length;

  // Counter
  if (lbCounterEl) {
    lbCounterEl.textContent = total > 1 ? `${currentIdx + 1} / ${total}` : "";
  }

  // Caption
  if (lbCaptionEl) {
    lbCaptionEl.textContent = photo.caption ?? "";
  }

  // Dots
  if (lbDotsEl) {
    lbDotsEl.innerHTML = "";
    if (total > 1) {
      for (let i = 0; i < total; i++) {
        const dot = document.createElement("div");
        dot.className = `plb-dot${i === currentIdx ? " active" : ""}`;
        dot.setAttribute("aria-label", `Photo ${i + 1}`);
        const capturedIdx = i;
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          if (capturedIdx === currentIdx) return;
          navigatePhoto((capturedIdx - currentIdx) as -1 | 1);
        });
        lbDotsEl.appendChild(dot);
      }
    }
  }

  // Prev/next buttons
  if (lbPrevBtn) lbPrevBtn.disabled = currentIdx === 0;
  if (lbNextBtn) lbNextBtn.disabled = currentIdx === currentAlbum.length - 1;

  // Progress bar (position in album)
  if (lbProgressEl && total > 1) {
    const pct = total === 1 ? 100 : ((currentIdx + 1) / total) * 100;
    lbProgressEl.style.width = `${pct}%`;
  }
}

// ── Public: Open album ────────────────────────────────────────────────────────

export function openLightboxAlbum(
  photos: LightboxPhoto[],
  startIndex: number,
  triggerEl: HTMLElement,
  options?: { shape?: "circle" | "rect" },
): void {
  if (!lbEl) createDOM();
  if (isOpen) closePhotoLightbox();
  if (!photos.length) return;

  isOpen = true;
  lastTriggerEl = triggerEl;
  currentAlbum  = photos;
  currentIdx    = Math.max(0, Math.min(startIndex, photos.length - 1));
  currentShape  = options?.shape ?? "rect";

  const isSingle = photos.length === 1;
  lbEl!.classList.toggle("plb-single", isSingle);

  // Set shape on wrapper
  lbImgWrap!.className = `plb-${currentShape}`;

  // Show overlay
  lbEl!.style.display = "flex";

  // Reset progress bar for multi-photo albums
  if (lbProgressEl) {
    lbProgressEl.style.transition = "none";
    lbProgressEl.style.width = "0%";
  }

  // FLIP: start from trigger center
  const rect = triggerEl.getBoundingClientRect();
  const ox = (rect.left + rect.width  / 2) - window.innerWidth  / 2;
  const oy = (rect.top  + rect.height / 2) - window.innerHeight / 2;

  lbImgEl!.style.transition = "none";
  lbImgEl!.style.transform  = `translate(${ox}px, ${oy}px) scale(0.08)`;
  lbImgEl!.style.opacity    = "0";

  updateMeta();

  // Animate in
  requestAnimationFrame(() => requestAnimationFrame(() => {
    lbImgEl!.style.transition = "transform 0.52s cubic-bezier(0.16,1,0.3,1), opacity 0.32s ease";
    lbImgEl!.style.transform  = "translate(0,0) scale(1)";
    lbEl!.classList.add("plb-open");

    // Load first photo
    const photo = currentAlbum[currentIdx];
    loadPhoto(photo.src, photo.objectPosition);

    // Animate progress bar in
    requestAnimationFrame(() => {
      if (lbProgressEl) lbProgressEl.style.transition = "";
      updateMeta(); // re-trigger width transition
    });
  }));
}

// ── Public: Backward-compat single photo ─────────────────────────────────────

export function openPhotoLightbox(
  src: string,
  triggerEl: HTMLElement,
  options?: PhotoLightboxOptions,
): void {
  const photos: LightboxPhoto[] = (options?.album && options.album.length > 0)
    ? options.album
    : [{ src, caption: options?.caption }];
  const idx = options?.albumIndex ?? 0;
  openLightboxAlbum(photos, idx, triggerEl, { shape: options?.shape });
}

// ── Public: Close ─────────────────────────────────────────────────────────────

export function closePhotoLightbox(): void {
  if (!lbEl || !isOpen) return;
  isOpen = false;

  lbEl.classList.remove("plb-open");

  // FLIP close: shrink back toward trigger
  const trigger = lastTriggerEl;
  if (trigger && trigger.isConnected && trigger.offsetParent !== null) {
    const rect = trigger.getBoundingClientRect();
    const ox = (rect.left + rect.width  / 2) - window.innerWidth  / 2;
    const oy = (rect.top  + rect.height / 2) - window.innerHeight / 2;
    lbImgEl!.style.transition = "transform 0.36s cubic-bezier(0.4,0,0.8,0.3), opacity 0.26s ease";
    lbImgEl!.style.transform  = `translate(${ox}px,${oy}px) scale(0.08)`;
    lbImgEl!.style.opacity    = "0";
  } else {
    lbImgEl!.style.transition = "transform 0.3s ease-in, opacity 0.28s ease-in";
    lbImgEl!.style.transform  = "scale(0.75)";
    lbImgEl!.style.opacity    = "0";
  }

  setTimeout(() => {
    if (!isOpen) {
      lbEl!.style.display = "none";
      // Reset state for next open
      lbImgEl!.src = "";
      lbImgEl!.style.transition = "";
      lbImgEl!.style.transform  = "";
      lbImgEl!.style.opacity    = "1";
      lbSkeleton!.classList.remove("plb-loading");
      lbErrorEl!.classList.remove("plb-show");
      currentAlbum = [];
      if (lbProgressEl) {
        lbProgressEl.style.transition = "none";
        lbProgressEl.style.width = "0%";
      }
    }
  }, 400);
}

// ── Public: init ─────────────────────────────────────────────────────────────

export function initPhotoLightbox(): void {
  if (lbEl) return;
  createDOM();
}

// ── attachZoomHint ─────────────────────────────────────────────────────────────

export function attachZoomHint(
  container: HTMLElement,
  getSrc: () => string,
  options?: PhotoLightboxOptions & { hintSize?: number },
): () => void {
  if (!lbEl) createDOM();

  container.classList.add("plb-trigger");

  const hint = document.createElement("div");
  hint.className = "plb-trigger-hint";
  hint.setAttribute("aria-hidden", "true");
  const sz = options?.hintSize ?? 20;
  hint.innerHTML = `
    <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none"
         stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8"  x2="11" y2="14"/>
      <line x1="8"  y1="11" x2="14" y2="11"/>
    </svg>
  `;
  container.appendChild(hint);
  container.setAttribute("tabindex", "0");
  container.setAttribute("role", "button");
  container.setAttribute("aria-label", "View full photo");

  function handleClick(): void {
    const src = getSrc();
    if (!src) return;
    if (options?.album && options.album.length > 0) {
      openLightboxAlbum(options.album, options.albumIndex ?? 0, container, { shape: options.shape });
    } else {
      openPhotoLightbox(src, container, options);
    }
  }
  function handleKey(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); }
  }

  container.addEventListener("click", handleClick);
  container.addEventListener("keydown", handleKey);

  return () => {
    container.removeEventListener("click", handleClick);
    container.removeEventListener("keydown", handleKey);
    container.classList.remove("plb-trigger");
    container.removeAttribute("tabindex");
    container.removeAttribute("role");
    container.removeAttribute("aria-label");
    hint.remove();
  };
}
