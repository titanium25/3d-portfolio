const TOTAL_ASSETS = 5; // idle model + idle anim + walk + run + wave

let overlay: HTMLElement;
let progressBar: HTMLElement;
let progressText: HTMLElement;
let loaded = 0;

export function showLoadingScreen(): void {
  loaded = 0;

  overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #000000;
    font-family: 'Courier New', 'Courier', monospace;
    transition: opacity 0.6s ease-out;
  `;

  // Add CRT scanline effect
  const scanlines = document.createElement('div');
  scanlines.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
  overlay.appendChild(scanlines);

  const title = document.createElement('div');
  title.textContent = '> LOADING SYSTEM...';
  title.style.cssText = `
    color: #00ff00;
    font-size: 1.2rem;
    font-weight: 400;
    letter-spacing: 2px;
    margin-bottom: 28px;
    text-shadow: 0 0 5px #00ff00;
  `;

  const track = document.createElement('div');
  track.style.cssText = `
    width: min(320px, 70vw);
    height: 4px;
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid rgba(0, 255, 0, 0.3);
    border-radius: 0;
    overflow: hidden;
  `;

  progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background: #00ff00;
    box-shadow: 0 0 10px #00ff00;
    transition: width 0.3s ease-out;
  `;
  track.appendChild(progressBar);

  progressText = document.createElement('div');
  progressText.textContent = '0%';
  progressText.style.cssText = `
    color: #00ff00;
    font-size: 0.9rem;
    margin-top: 16px;
    letter-spacing: 2px;
    text-shadow: 0 0 5px #00ff00;
  `;

  overlay.appendChild(title);
  overlay.appendChild(track);
  overlay.appendChild(progressText);
  document.body.appendChild(overlay);
}

/** Call once per asset that finishes loading */
export function assetLoaded(): void {
  loaded++;
  const pct = Math.round((loaded / TOTAL_ASSETS) * 100);
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressText) progressText.textContent = `${pct}%`;
}

/** Fade out and remove the overlay. Returns a promise that resolves when done. */
export function hideLoadingScreen(): Promise<void> {
  return new Promise((resolve) => {
    if (!overlay) {
      resolve();
      return;
    }
    overlay.style.opacity = '0';
    overlay.addEventListener('transitionend', () => {
      overlay.remove();
      resolve();
    }, { once: true });
    // Safety fallback in case transitionend doesn't fire
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
      resolve();
    }, 800);
  });
}
