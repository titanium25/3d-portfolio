/**
 * discoveryTracker.ts
 * Session-only state for 3D object discoveries on the spawn pad.
 * Works identically to the gate-completion pattern: markDiscovered() returns
 * true only on first-time discovery, enabling one-shot rewards.
 */

import { showGameToast, addDiscoveryToBadge } from "./gateUnlockAnimation";

export const DISCOVERY_IDS = [
  "bmw", "mtb", "meny", "monogram",
  "lego", "gym", "twins",
] as const;
export type DiscoveryId = (typeof DISCOVERY_IDS)[number];

const DISCOVERY_LABELS: Record<DiscoveryId, string> = {
  bmw:     "BMW S1000RR",
  mtb:     "MTB Bicycle",
  meny:    "Meny",
  monogram: "AL Monogram",
  lego:    "✦ LEGO Collection",
  gym:     "✦ The Iron Temple",
  twins:   "✦ The Masterpiece",
};

const DISCOVERY_SUBTITLES: Record<DiscoveryId, string> = {
  bmw:      "199hp of weekend therapy — found on the spawn pad",
  mtb:      "Friday morning chariot — found on the spawn pad",
  meny:     "Named after Manny from Ice Age — he's been following you",
  monogram: "The author of this world — found on the spawn pad",
  lego:     "Still building things, one brick at a time",
  gym:      "5 days a week, no exceptions",
  twins:    "By Tomer & Alma, age 6",
};

const DISCOVERY_HINTS: Partial<Record<DiscoveryId, string>> = {
  bmw:   "📸 Photos unlocked · Check the About tab",
  mtb:   "📸 Photos unlocked · Check the About tab",
  meny:  "📸 Photos unlocked · Check the About tab",
  lego:  "📸 Photos unlocked · Check the About tab",
};

const discovered = new Set<string>();
let bonusShown = false;

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true on first-time discovery, false if already discovered. */
export function markDiscovered(id: DiscoveryId): boolean {
  if (discovered.has(id)) return false;
  discovered.add(id);

  // Don't show during overlays
  if (
    document.body.classList.contains("transition-open") ||
    document.getElementById("cv-overlay")?.classList.contains("cv-visible")
  ) {
    return true;
  }

  addDiscoveryToBadge();

  const iconDiscover = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 4h3.5M4 4v3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M18 4h-3.5M18 4v3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M18 18h-3.5M18 18v-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 18h3.5M4 18v-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="11" cy="11" r="2.2" fill="currentColor"/><line x1="11" y1="7.5" x2="11" y2="9.3" stroke="currentColor" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/><line x1="11" y1="12.7" x2="11" y2="14.5" stroke="currentColor" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/><line x1="7.5" y1="11" x2="9.3" y2="11" stroke="currentColor" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/><line x1="12.7" y1="11" x2="14.5" y2="11" stroke="currentColor" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/></svg>`;
  const iconAllFound  = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2L13.8 8.2L20.5 8.2L15.2 12.3L17.4 18.8L11 15L4.6 18.8L6.8 12.3L1.5 8.2L8.2 8.2Z" fill="currentColor"/></svg>`;

  showGameToast({
    icon: iconDiscover,
    category: "OBJECT DISCOVERED",
    title: DISCOVERY_LABELS[id],
    subtitle: DISCOVERY_SUBTITLES[id],
    hint: DISCOVERY_HINTS[id],
    holdMs: 2600,
    tab: 'about',
    targetId: id,
  });

  // Check for all-discoveries bonus (spawn pad + arena)
  if (discovered.size === DISCOVERY_IDS.length && !bonusShown) {
    bonusShown = true;
    setTimeout(() => {
      showGameToast({
        icon: iconAllFound,
        category: "ALL SECRETS FOUND",
        title: "Portfolio — Fully Explored",
        subtitle: "Every hidden object discovered · Check the About tab",
        isFinal: true,
        holdMs: 3500,
        tab: 'about',
      });
    }, 2900);
  }

  return true;
}

export function isDiscovered(id: string): boolean {
  return discovered.has(id);
}

export function getDiscoveryCount(): number {
  return discovered.size;
}
