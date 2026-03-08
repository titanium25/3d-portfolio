/**
 * discoveryTracker.ts
 * Session-only state for 3D object discoveries on the spawn pad.
 * Works identically to the gate-completion pattern: markDiscovered() returns
 * true only on first-time discovery, enabling one-shot rewards.
 */

import { showGameToast, addDiscoveryToBadge } from "./gateUnlockAnimation";

export const DISCOVERY_IDS = ["bmw", "mtb", "meny", "monogram"] as const;
export type DiscoveryId = (typeof DISCOVERY_IDS)[number];

const DISCOVERY_LABELS: Record<DiscoveryId, string> = {
  bmw: "BMW S1000RR",
  mtb: "MTB Bicycle",
  meny: "Meny",
  monogram: "AL Monogram",
};

const DISCOVERY_SUBTITLES: Record<DiscoveryId, string> = {
  bmw:      "199hp of weekend therapy — found on the spawn pad",
  mtb:      "Friday morning chariot — found on the spawn pad",
  meny:     "Chief Morale Officer — he's been following you",
  monogram: "The author of this world — found on the spawn pad",
};

const DISCOVERY_HINTS: Partial<Record<DiscoveryId, string>> = {
  bmw:  "📸 Photos unlocked · Check the About tab",
  mtb:  "📸 Photos unlocked · Check the About tab",
  meny: "📸 Photos unlocked · Check the About tab",
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
  });

  // Check for all-4 bonus
  if (discovered.size === DISCOVERY_IDS.length && !bonusShown) {
    bonusShown = true;
    setTimeout(() => {
      showGameToast({
        icon: "★",
        category: "ALL SECRETS FOUND",
        title: "Spawn Pad — Fully Explored",
        subtitle: "Every hidden object discovered · Check the About tab",
        isFinal: true,
        holdMs: 3500,
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
