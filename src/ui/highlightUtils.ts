/**
 * highlightUtils.ts
 *
 * Wraps key words and metrics in bullet text / context paragraphs with
 * visually distinct spans so a recruiter scanning quickly sees the numbers
 * and impact phrases immediately.
 *
 * Two tiers:
 *   hl-metric  — amber/gold  — quantified achievements (100K+, 30–40%, etc.)
 *   hl-key     — bright white — qualitative highlights  (Team Lead, AI, etc.)
 */

// ── CSS ───────────────────────────────────────────────────────────────────────

export function injectHighlightStyles(): void {
  if (document.getElementById("hl-styles")) return;
  const s = document.createElement("style");
  s.id = "hl-styles";
  s.textContent = `
    .hl-metric {
      color: #fbbf24;
      font-weight: 700;
      text-shadow: 0 0 10px rgba(251,191,36,0.38);
    }
    .hl-key {
      color: #fff;
      font-weight: 700;
    }
  `;
  document.head.appendChild(s);
}

// ── Highlight engine ──────────────────────────────────────────────────────────

type MatchRange = { start: number; end: number; cls: string };

const METRIC_PATTERNS: RegExp[] = [
  // Scale / user counts
  /100K\+\s*(?:registered\s+)?(?:users?|traders?)\s*\(70K\s*active\)/gi,
  /100K\+\s*(?:registered\s+)?(?:users?|traders?)/gi,
  /70K\s+active/gi,
  /~44K\s+employees/gi,
  // Infra scale
  /20\+\s+microservices/gi,
  /100\+\s+shared\s+libraries/gi,
  // Impact metrics
  /30[–\-]40%\s+API\s+cost\s+reduction/gi,
  /30[–\-]40%/gi,
  // Team sizes
  /\(~18[–\-]24\s+devs?\)/gi,
  /~18[–\-]24\s+devs?/gi,
  /6\s+teams?\b/gi,
  /3\s+developers\b/gi,
  // Integration count
  /8\+\s+API\s+integrations/gi,
  // Technology thresholds
  /sub-7nm\b/gi,
  // Generic number+unit fallback (e.g. "4 fabs", "5+ years")
  /\b\d+\+?\s+(?:yr|year|mos|month|fabs?|fab\s+sites?)\b/gi,
];

const KEY_PATTERNS: RegExp[] = [
  // Promotions / leadership
  /Development\s+Team\s+Lead/gi,
  /Team\s+Lead/gi,
  /Promoted\s+to\b/gi,
  // High-impact verbs
  /\bOwned\s+central\s+dashboards?\b/gi,
  /\bIntroduced\s+and\s+standardized\b/gi,
  /\bLed\s+(?:internal\s+)?training\b/gi,
  /\bLed\s+&\s+monitored\b/gi,
  // AI / product
  /\bAI\s+chat\s+systems?\b/gi,
  /\bAI\s+platforms?\b/gi,
  /\bAI-powered\b/gi,
  // Notable clients / brands
  /Intel,\s*TSMC,\s*and\s*Samsung/gi,
  /Burger\s+King,\s*Papa\s+Johns?,\s*and\s*Shake\s+Shack/gi,
  // Unique company descriptors
  /world['']?s\s+sole\s+manufacturer/gi,
  /global\s+proprietary\s+trading\s+firm/gi,
  /one\s+of\s+Israel['']?s\s+Big\s+Five\s+integrators/gi,
  // Key initiatives
  /React\s+Query\s+company-wide/gi,
  /CI\/CD\s+pipelines?\b/gi,
  /pull\s+request\s+culture\b/gi,
  // Locations / deployments
  /Intel\s+fabs?\s+worldwide/gi,
  // Core skill combos
  /React\s+&(?:amp;)?\s+TypeScript/gi,
];

/**
 * Returns `text` with metric and key phrases wrapped in highlight spans.
 * Safe to use as `innerHTML` — plain text in, HTML out.
 */
export function highlight(text: string): string {
  const matches: MatchRange[] = [];

  function collect(patterns: RegExp[], cls: string): void {
    for (const pat of patterns) {
      // Reset lastIndex so exec always scans from the start for each call
      pat.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pat.exec(text)) !== null) {
        const start = m.index;
        const end = m.index + m[0].length;
        const overlaps = matches.some(
          (r) => start < r.end && end > r.start,
        );
        if (!overlaps) matches.push({ start, end, cls });
        // Guard against zero-width matches causing infinite loops
        if (m[0].length === 0) { pat.lastIndex++; }
      }
    }
  }

  collect(METRIC_PATTERNS, "hl-metric");
  collect(KEY_PATTERNS, "hl-key");

  if (matches.length === 0) return text;

  matches.sort((a, b) => a.start - b.start);

  let out = "";
  let cursor = 0;
  for (const { start, end, cls } of matches) {
    out += text.slice(cursor, start);
    out += `<span class="${cls}">${text.slice(start, end)}</span>`;
    cursor = end;
  }
  out += text.slice(cursor);
  return out;
}
