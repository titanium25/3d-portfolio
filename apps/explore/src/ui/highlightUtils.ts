/**
 * highlightUtils.ts
 *
 * Wraps key words and metrics in bullet text / context paragraphs with
 * visually distinct spans so a recruiter scanning quickly sees the numbers
 * and impact phrases immediately.
 *
 * Two tiers:
 *   hl-metric  — amber/gold  — quantified achievements (100K+, 30–40%, etc.)
 *   hl-key     — cyan-tinted — qualitative highlights  (Team Lead, AI, etc.)
 *
 * Both tiers use:
 *   • clip-path left-to-right reveal animation on mount
 *   • --hl-i CSS custom property for staggered timing per-text-block
 *   • smooth hover micro-interactions
 */

// ── CSS ───────────────────────────────────────────────────────────────────────

export function injectHighlightStyles(): void {
  if (document.getElementById("hl-styles")) return;
  const s = document.createElement("style");
  s.id = "hl-styles";
  s.textContent = `

    /* ── Keyframes ──────────────────────────────────────────────────── */

    /* Metric pill: slide up + fade in */
    @keyframes hlMetricIn {
      from {
        opacity: 0;
        transform: translateY(4px) scale(0.88);
        box-shadow: none;
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Metric: periodic breathing glow */
    @keyframes hlMetricGlow {
      0%, 100% {
        box-shadow:
          0 0  0   0   rgba(251,191,36,0.00),
          inset 0 0 0 0 rgba(251,191,36,0.00);
      }
      50% {
        box-shadow:
          0 0 12px 2px rgba(251,191,36,0.16),
          inset 0 0 6px 0 rgba(251,191,36,0.06);
      }
    }

    /* Key phrase: underline draws in left-to-right */
    @keyframes hlUnderIn {
      from { transform: scaleX(0); opacity: 0.4; }
      to   { transform: scaleX(1); opacity: 1;   }
    }

    /* Key phrase: reveal on parent mount */
    @keyframes hlKeyIn {
      from { opacity: 0; transform: translateY(3px); }
      to   { opacity: 1; transform: translateY(0);   }
    }


    /* ── Metric highlight — amber pill ─────────────────────────────── */

    .hl-metric {
      display: inline;
      position: relative;

      /* Typography */
      color: #fbbf24;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;

      /* Pill chrome */
      padding: 0.05em 0.38em 0.09em;
      border-radius: 4px;
      background: rgba(251,191,36,0.10);
      border: 1px solid rgba(251,191,36,0.26);
      line-height: inherit;

      /* Reveal animation — delay staggered by --hl-i */
      animation:
        hlMetricIn   0.4s  cubic-bezier(0.16,1,0.3,1) calc(0.06s + var(--hl-i,0) * 0.06s) both,
        hlMetricGlow 4s    ease-in-out                 calc(0.5s  + var(--hl-i,0) * 0.06s) infinite;

      /* Smooth hover */
      transition: background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, color 0.15s ease;
    }

    .hl-metric:hover {
      background:   rgba(251,191,36,0.20);
      border-color: rgba(251,191,36,0.55);
      color: #fde68a;
      box-shadow:
        0 0 18px 4px rgba(251,191,36,0.22),
        0 2px  8px 0   rgba(251,191,36,0.14),
        inset 0 1px 0  rgba(255,255,255,0.06);
      animation-play-state: paused;   /* freeze glow pulse on hover */
    }


    /* ── Key highlight — cyan underline sweep ───────────────────────── */

    .hl-key {
      display: inline;
      position: relative;

      /* Typography */
      color: #dff8f5;
      font-weight: 600;

      /* Reveal animation */
      animation: hlKeyIn 0.38s cubic-bezier(0.16,1,0.3,1) calc(0.10s + var(--hl-i,0) * 0.06s) both;

      /* Smooth hover */
      transition: color 0.2s ease;
    }

    /* Animated underline — draws left-to-right after text fades in */
    .hl-key::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 1.5px;
      background: linear-gradient(90deg, #00e5cc 0%, rgba(0,229,204,0.35) 100%);
      border-radius: 1px;
      transform: scaleX(0);
      transform-origin: left center;
      animation: hlUnderIn 0.52s cubic-bezier(0.16,1,0.3,1) calc(0.22s + var(--hl-i,0) * 0.06s) both;
      transition: background 0.2s ease, height 0.2s ease;
    }

    .hl-key:hover {
      color: #00e5cc;
    }

    .hl-key:hover::after {
      background: linear-gradient(90deg, #00e5cc 0%, rgba(0,229,204,0.65) 100%);
      height: 2px;
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
 *
 * Each span receives `--hl-i` CSS custom property (0-based index across
 * the string) so animations stagger naturally left-to-right.
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
  let hlIndex = 0;
  for (const { start, end, cls } of matches) {
    out += text.slice(cursor, start);
    out += `<span class="${cls}" style="--hl-i:${hlIndex++}">${text.slice(start, end)}</span>`;
    cursor = end;
  }
  out += text.slice(cursor);
  return out;
}
