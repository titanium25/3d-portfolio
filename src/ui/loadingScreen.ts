let progressContainer: HTMLElement | null = null;
let progressBar: HTMLElement | null = null;
let progressText: HTMLElement | null = null;
let loaded = 0;
let totalAssets = 0;

/**
 * Creates and returns a minimalistic progress bar that overlays at the bottom
 * of the intro sequence. No full-screen loader - better UX!
 */
export function createProgressIndicator(): HTMLElement {
  loaded = 0;

  progressContainer = document.createElement("div");
  progressContainer.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1003;
    padding: 0;
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.8s ease-out;
  `;

  // Elegant progress bar
  const track = document.createElement("div");
  track.style.cssText = `
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    position: relative;
    overflow: hidden;
  `;

  progressBar = document.createElement("div");
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.9));
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
  `;
  track.appendChild(progressBar);

  // Minimalistic percentage text
  progressText = document.createElement("div");
  progressText.textContent = "Loading... 0%";
  progressText.style.cssText = `
    font-family: 'Cormorant Garamond', 'Georgia', serif;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    padding: 12px 0 16px 0;
    letter-spacing: 0.15em;
    font-weight: 300;
  `;

  progressContainer.appendChild(progressText);
  progressContainer.appendChild(track);
  document.body.appendChild(progressContainer);

  return progressContainer;
}

/**
 * Sets the total number of assets that will be loaded.
 * Call this before assets start loading.
 */
export function setTotalAssets(total: number): void {
  totalAssets = total;
}

/**
 * Call once per asset that finishes loading.
 * Progress will be calculated dynamically based on totalAssets.
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
  if (progressText) {
    progressText.textContent = `Loading... ${pct}%`;
  }
}

/**
 * Smoothly fades out and removes the progress indicator.
 * Returns a promise that resolves when the animation completes.
 */
export function hideProgressIndicator(): Promise<void> {
  return new Promise((resolve) => {
    if (!progressContainer) {
      resolve();
      return;
    }

    // Update to show completion
    if (progressBar) {
      progressBar.style.width = "100%";
    }
    if (progressText) {
      progressText.textContent = "Ready";
    }

    // Fade out after a brief moment
    setTimeout(() => {
      if (progressContainer) {
        progressContainer.style.opacity = "0";
        setTimeout(() => {
          if (progressContainer?.parentNode) {
            progressContainer.remove();
          }
          progressContainer = null;
          progressBar = null;
          progressText = null;
          resolve();
        }, 800);
      } else {
        resolve();
      }
    }, 400);
  });
}

/**
 * Preloads an array of image URLs using the browser's image cache.
 * Calls `onEach` after every individual image settles (load or error)
 * so the progress bar advances in real time.
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

// Legacy functions for backwards compatibility (deprecated)
export function showLoadingScreen(): void {
  createProgressIndicator();
}

export function hideLoadingScreen(): Promise<void> {
  return hideProgressIndicator();
}
