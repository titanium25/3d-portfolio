// ── Photo Lightbox — reusable FLIP zoom for any image ────────────────────────
// Usage:
//   openPhotoLightbox(src, triggerEl, { shape: 'circle', caption: '...' })
//   closePhotoLightbox()
//   attachZoomHint(el, () => src, () => caption, options)  → returns detach fn

export interface PhotoLightboxOptions {
  shape?: "circle" | "rect"; // default: 'rect'
  caption?: string;
}

let lbEl: HTMLDivElement | null = null;
let lbImgEl: HTMLImageElement | null = null;
let lbCaptionEl: HTMLSpanElement | null = null;
let lbCloseEl: HTMLButtonElement | null = null;
let isOpen = false;
let lastTriggerEl: HTMLElement | null = null;

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("plb-styles")) return;
  const s = document.createElement("style");
  s.id = "plb-styles";
  s.textContent = `
    /* ── Lightbox overlay ── */
    #plb-overlay {
      position: fixed;
      inset: 0;
      z-index: 3001;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0);
      backdrop-filter: blur(0px) saturate(1);
      -webkit-backdrop-filter: blur(0px) saturate(1);
      transition:
        background 0.35s ease,
        backdrop-filter 0.35s ease,
        -webkit-backdrop-filter 0.35s ease;
      cursor: zoom-out;
    }
    #plb-overlay.plb-open {
      background: rgba(4,6,16,0.9);
      backdrop-filter: blur(24px) saturate(1.3);
      -webkit-backdrop-filter: blur(24px) saturate(1.3);
    }

    /* ── Inner wrapper (positions close btn relative to image) ── */
    #plb-inner {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      cursor: default;
    }

    /* ── The image ── */
    #plb-img {
      display: block;
      object-fit: cover;
      object-position: center top;
      border: 2.5px solid rgba(0,229,204,0.5);
      box-shadow:
        0 0 0 1px rgba(0,229,204,0.1),
        0 0 60px rgba(0,229,204,0.25),
        0 0 120px rgba(0,229,204,0.08),
        0 32px 80px rgba(0,0,0,0.8);
      will-change: transform;
      user-select: none;
      -webkit-user-drag: none;
    }
    /* circle variant */
    #plb-img.plb-circle {
      width: min(360px, 82vmin);
      height: min(360px, 82vmin);
      border-radius: 50%;
    }
    /* rect variant */
    #plb-img.plb-rect {
      width: min(380px, 72vw);
      max-height: 80vh;
      border-radius: 12px;
      object-fit: contain;
      object-position: center center;
    }

    /* ── Caption ── */
    #plb-caption {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.04em;
      color: rgba(255,255,255,0.38);
      text-align: center;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.3s ease 0.22s, transform 0.3s ease 0.22s;
      pointer-events: none;
      user-select: none;
    }
    #plb-overlay.plb-open #plb-caption {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Close button ── */
    #plb-close {
      position: absolute;
      top: -0.6rem;
      right: -0.6rem;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.6);
      font-size: 1rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.65);
      transition: opacity 0.25s ease 0.18s, transform 0.25s ease 0.18s,
                  background 0.15s, color 0.15s, border-color 0.15s;
      z-index: 1;
      font-family: system-ui, sans-serif;
    }
    #plb-overlay.plb-open #plb-close {
      opacity: 1;
      transform: scale(1);
    }
    #plb-close:hover {
      background: rgba(0,229,204,0.15);
      border-color: rgba(0,229,204,0.4);
      color: #fff;
    }

    /* ── ESC hint ── */
    #plb-esc-hint {
      position: fixed;
      bottom: 1.4rem;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 0.63rem;
      color: rgba(255,255,255,0.2);
      letter-spacing: 0.07em;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease 0.3s;
      white-space: nowrap;
    }
    #plb-overlay.plb-open #plb-esc-hint { opacity: 1; }

    /* ── Zoom hint affordance (attached to trigger containers) ── */
    .plb-trigger {
      position: relative;
      cursor: zoom-in;
    }
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
      background: rgba(0,0,0,0.36);
      opacity: 1;
    }
    .plb-trigger-hint svg {
      filter: drop-shadow(0 1px 4px rgba(0,0,0,0.6));
    }
  `;
  document.head.appendChild(s);
}

// ── DOM ───────────────────────────────────────────────────────────────────────

function createDOM(): void {
  const lb = document.createElement("div");
  lb.id = "plb-overlay";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Photo lightbox");

  lb.innerHTML = `
    <div id="plb-inner">
      <button id="plb-close" aria-label="Close photo">&times;</button>
      <img id="plb-img" alt="" draggable="false" />
      <span id="plb-caption"></span>
    </div>
    <span id="plb-esc-hint">ESC · click outside to close</span>
  `;

  document.body.appendChild(lb);
  lbEl = lb;
  lbImgEl = lb.querySelector<HTMLImageElement>("#plb-img")!;
  lbCaptionEl = lb.querySelector<HTMLSpanElement>("#plb-caption")!;
  lbCloseEl = lb.querySelector<HTMLButtonElement>("#plb-close")!;

  lbCloseEl.addEventListener("click", (e) => { e.stopPropagation(); closePhotoLightbox(); });
  lb.addEventListener("click", (e) => { if (e.target === lb) closePhotoLightbox(); });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && isOpen) {
      e.stopImmediatePropagation();
      closePhotoLightbox();
    }
  }, true); // capture phase — runs before other handlers
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initPhotoLightbox(): void {
  if (lbEl) return;
  injectStyles();
  createDOM();
}

export function openPhotoLightbox(
  src: string,
  triggerEl: HTMLElement,
  options?: PhotoLightboxOptions,
): void {
  if (!lbEl) initPhotoLightbox();
  if (isOpen) return;
  isOpen = true;
  lastTriggerEl = triggerEl;

  const isCircle = options?.shape === "circle";
  lbImgEl!.className = isCircle ? "plb-circle" : "plb-rect";
  lbImgEl!.src = src;
  lbCaptionEl!.textContent = options?.caption ?? "";

  // FLIP origin — start at trigger center, scaled down
  const rect = triggerEl.getBoundingClientRect();
  const ox = (rect.left + rect.width / 2) - window.innerWidth / 2;
  const oy = (rect.top + rect.height / 2) - window.innerHeight / 2;

  lbImgEl!.style.transition = "none";
  lbImgEl!.style.transform = `translate(${ox}px, ${oy}px) scale(0.12)`;
  lbEl!.style.display = "flex";

  requestAnimationFrame(() => requestAnimationFrame(() => {
    lbImgEl!.style.transition = "transform 0.46s cubic-bezier(0.16, 1, 0.3, 1)";
    lbImgEl!.style.transform = "translate(0, 0) scale(1)";
    lbEl!.classList.add("plb-open");
    lbCloseEl!.focus();
  }));
}

export function closePhotoLightbox(): void {
  if (!lbEl || !isOpen) return;
  isOpen = false;

  // FLIP close — shrink back toward the trigger's current position
  const trigger = lastTriggerEl;
  if (trigger && trigger.isConnected && trigger.offsetParent !== null) {
    const rect = trigger.getBoundingClientRect();
    const ox = (rect.left + rect.width / 2) - window.innerWidth / 2;
    const oy = (rect.top + rect.height / 2) - window.innerHeight / 2;
    lbImgEl!.style.transition = "transform 0.36s cubic-bezier(0.4, 0, 0.8, 0.3)";
    lbImgEl!.style.transform = `translate(${ox}px, ${oy}px) scale(0.12)`;
  } else {
    // trigger gone — just scale down in place
    lbImgEl!.style.transition = "transform 0.3s ease-in, opacity 0.3s ease-in";
    lbImgEl!.style.transform = "scale(0.7)";
  }

  lbEl!.classList.remove("plb-open");
  setTimeout(() => { if (!isOpen) lbEl!.style.display = "none"; }, 380);
}

// ── attachZoomHint ─────────────────────────────────────────────────────────────
// Adds cursor + hover magnifier hint to `container`, opens lightbox on click.
// Returns a detach function to remove listeners.

export function attachZoomHint(
  container: HTMLElement,
  getSrc: () => string,
  options?: PhotoLightboxOptions & { hintSize?: number },
): () => void {
  if (!lbEl) initPhotoLightbox();

  container.classList.add("plb-trigger");

  // Inject the magnifier overlay div
  const hint = document.createElement("div");
  hint.className = "plb-trigger-hint";
  hint.setAttribute("aria-hidden", "true");
  const sz = options?.hintSize ?? 20;
  hint.innerHTML = `
    <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none"
         stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  `;
  container.appendChild(hint);

  container.setAttribute("tabindex", "0");
  container.setAttribute("role", "button");
  container.setAttribute("aria-label", "View full photo");

  function handleClick(): void {
    const src = getSrc();
    if (!src) return;
    openPhotoLightbox(src, container, options);
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
