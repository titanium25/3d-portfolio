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
  meny:     "Chief Morale Officer — he's been following you",
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

  showGameToast({
    icon: "◆",
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
        icon: "★",
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
