/**
 * mobileDetect.ts
 * Single source of truth for mobile detection used across perf-optimization paths.
 * Evaluated once at module load time.
 */

export const isMobile =
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  navigator.maxTouchPoints > 1 ||
  window.innerWidth < 768;
