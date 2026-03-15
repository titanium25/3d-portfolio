/**
 * chipUtils — shared skill-chip categorisation + HTML renderer.
 *
 * Categories map known tech skills to a color dot so chips are visually
 * scannable by domain without adding text labels.
 *
 * Each chip exposes CSS custom properties so hover states are
 * category-aware (glow and border match the dot color):
 *   --chip-dot          dot fill color
 *   --chip-glow         hover outer glow  (dot color @ 0.20 alpha)
 *   --chip-border-h     hover border      (dot color @ 0.48 alpha)
 */

export interface ChipStyle {
  dot: string;
  bg: string;
  border: string;
}

// ── Category palettes ─────────────────────────────────────────────────────

const FRONTEND: ChipStyle = {
  dot: "#60a5fa",
  bg: "rgba(96,165,250,0.08)",
  border: "rgba(96,165,250,0.22)",
};
const BACKEND: ChipStyle = {
  dot: "#4ade80",
  bg: "rgba(74,222,128,0.08)",
  border: "rgba(74,222,128,0.22)",
};
const DATABASE: ChipStyle = {
  dot: "#fbbf24",
  bg: "rgba(251,191,36,0.08)",
  border: "rgba(251,191,36,0.22)",
};
const DEVOPS: ChipStyle = {
  dot: "#fb923c",
  bg: "rgba(251,146,60,0.08)",
  border: "rgba(251,146,60,0.22)",
};
const HARDWARE: ChipStyle = {
  dot: "#c084fc",
  bg: "rgba(192,132,252,0.08)",
  border: "rgba(192,132,252,0.22)",
};
const LEADERSHIP: ChipStyle = {
  dot: "#00e5cc",
  bg: "rgba(0,229,204,0.08)",
  border: "rgba(0,229,204,0.22)",
};
const DEFAULT_STYLE: ChipStyle = {
  dot: "rgba(255,255,255,0.28)",
  bg: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.12)",
};

// ── Skill → category lookup ───────────────────────────────────────────────

const LOOKUP = new Map<string, ChipStyle>([
  // Frontend
  ["react",                FRONTEND],
  ["vue.js",               FRONTEND],
  ["vue",                  FRONTEND],
  ["typescript",           FRONTEND],
  ["javascript",           FRONTEND],
  ["html",                 FRONTEND],
  ["css",                  FRONTEND],
  ["redux",                FRONTEND],
  ["mui",                  FRONTEND],
  ["storybook",            FRONTEND],
  ["react query",          FRONTEND],
  ["nx monorepo",          FRONTEND],
  ["figma",                FRONTEND],
  ["frontend architecture",FRONTEND],
  ["next.js",              FRONTEND],
  ["angular",              FRONTEND],
  ["svelte",               FRONTEND],
  ["tailwind",             FRONTEND],

  // Backend
  ["node.js",              BACKEND],
  ["php",                  BACKEND],
  ["laravel",              BACKEND],
  ["nestjs",               BACKEND],
  ["python",               BACKEND],
  ["express",              BACKEND],
  ["rest apis",            BACKEND],
  ["graphql",              BACKEND],
  ["fastapi",              BACKEND],
  ["microservices",        BACKEND],
  ["spring",               BACKEND],
  ["django",               BACKEND],

  // Database
  ["mysql",                DATABASE],
  ["mongodb",              DATABASE],
  ["redis",                DATABASE],
  ["postgresql",           DATABASE],
  ["postgres",             DATABASE],
  ["sql",                  DATABASE],
  ["dynamodb",             DATABASE],
  ["firebase",             DATABASE],
  ["supabase",             DATABASE],
  ["sqlite",               DATABASE],

  // DevOps / Infra
  ["ci/cd",                DEVOPS],
  ["git",                  DEVOPS],
  ["aws",                  DEVOPS],
  ["docker",               DEVOPS],
  ["kubernetes",           DEVOPS],
  ["linux / unix",         DEVOPS],
  ["linux",                DEVOPS],
  ["unix",                 DEVOPS],
  ["system administration",DEVOPS],
  ["bash",                 DEVOPS],
  ["terraform",            DEVOPS],
  ["nginx",                DEVOPS],

  // Hardware / Science
  ["matlab",               HARDWARE],
  ["euv / duv lithography",HARDWARE],
  ["euv/duv lithography",  HARDWARE],
  ["hardware troubleshooting", HARDWARE],
  ["root cause analysis",  HARDWARE],
  ["semiconductor manufacturing", HARDWARE],
  ["technical training",   HARDWARE],

  // Leadership / Process
  ["team leadership",      LEADERSHIP],
  ["agile / scrum",        LEADERSHIP],
  ["agile",                LEADERSHIP],
  ["scrum",                LEADERSHIP],
  ["agile/scrum",          LEADERSHIP],
]);

export function getChipStyle(skill: string): ChipStyle {
  return LOOKUP.get(skill.toLowerCase().trim()) ?? DEFAULT_STYLE;
}

// ── Color helpers ─────────────────────────────────────────────────────────

/** Convert a hex or rgba color string to `rgba(r,g,b,alpha)`. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgba(")) {
    return color.replace(/[\d.]+\)$/, `${alpha})`);
  }
  if (color.startsWith("rgb(")) {
    return color.replace(/\)$/, `,${alpha})`).replace("rgb(", "rgba(");
  }
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const full = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

// ── HTML renderer ─────────────────────────────────────────────────────────

/**
 * Returns an HTML string for one chip.
 * `index` is used for the `--chip-i` stagger property (auto-passed by
 * Array.map as the second callback argument).
 * Call `injectChipStyles()` once per page before rendering chips.
 */
export function renderChip(skill: string, index = 0): string {
  const { dot, bg, border } = getChipStyle(skill);
  const glow        = withAlpha(dot, 0.20);
  const borderHover = withAlpha(dot, 0.48);
  const dotGlow     = withAlpha(dot, 0.50);

  return (
    `<span class="tech-chip" ` +
      `style="background:${bg};border-color:${border};` +
             `--chip-dot:${dot};--chip-glow:${glow};` +
             `--chip-border-h:${borderHover};--chip-i:${index}" ` +
      `data-dot="${dot}">` +
      `<span class="tech-chip-dot" style="background:${dot};box-shadow:0 0 5px ${dotGlow}"></span>` +
      `${skill}` +
    `</span>`
  );
}

// ── Shared CSS (injected once) ────────────────────────────────────────────

export function injectChipStyles(): void {
  if (document.getElementById("tech-chip-styles")) return;
  const s = document.createElement("style");
  s.id = "tech-chip-styles";
  s.textContent = `
    /* ── Chip entrance keyframe (used when JS stagger doesn't override) ── */
    @keyframes chipReveal {
      from { opacity: 0; transform: scale(0.72) translateY(5px); }
      to   { opacity: 1; transform: scale(1)    translateY(0);   }
    }

    .tech-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.22rem 0.6rem 0.22rem 0.46rem;
      border: 1px solid transparent;
      border-radius: 100px;
      font-size: 0.67rem;
      font-weight: 500;
      color: rgba(255,255,255,0.80);
      white-space: nowrap;
      cursor: default;

      /* Shimmer + glow require overflow:hidden + relative */
      position: relative;
      overflow: hidden;

      /* Hover transitions */
      transition:
        transform     0.22s cubic-bezier(0.16,1,0.3,1),
        border-color  0.2s  ease,
        box-shadow    0.2s  ease,
        color         0.18s ease;
      will-change: transform;
    }

    /* ── Shimmer sweep on hover ── */
    .tech-chip::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        108deg,
        transparent      25%,
        rgba(255,255,255,0.13) 50%,
        transparent      75%
      );
      transform: translateX(-110%);
      transition: transform 0.48s cubic-bezier(0.16,1,0.3,1);
      border-radius: inherit;
      pointer-events: none;
    }
    .tech-chip:hover::before {
      transform: translateX(110%);
    }

    /* ── Hover state — category-aware glow via CSS variables ── */
    .tech-chip:hover {
      transform:    translateY(-2px) scale(1.06);
      color:        #fff;
      border-color: var(--chip-border-h, rgba(255,255,255,0.3));
      box-shadow:
        0 4px 18px var(--chip-glow, rgba(255,255,255,0.08)),
        0 0   0 1px var(--chip-border-h, rgba(255,255,255,0.14));
    }
    .tech-chip:active {
      transform: scale(0.97);
      transition-duration: 0.1s;
    }

    /* ── Dot ── */
    .tech-chip-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: box-shadow 0.22s ease, transform 0.22s ease;
    }
    .tech-chip:hover .tech-chip-dot {
      transform:  scale(1.4);
      box-shadow: 0 0 8px 2px var(--chip-dot, rgba(255,255,255,0.3));
    }
  `;
  document.head.appendChild(s);
}
