import { useRef, useState, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import {
  Layers,
  Server,
  Activity,
  Database,
  Sparkles,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Reveal from "./Reveal";

interface Domain {
  icon: LucideIcon;
  title: string;
  techs: string[];
  description: string;
  accent: string;
  highlight: string;
}

const DOMAINS: Domain[] = [
  {
    icon: Layers,
    title: "Frontend Architecture",
    techs: ["React", "TypeScript", "React Query", "MUI", "AntD", "Storybook", "i18n"],
    description:
      "Standardized React Query company-wide. Built the MUI foundation — theme, tokens, patterns — aligning engineering with Figma.",
    accent: "#00e5cc",
    highlight: "React Query|MUI|company-wide|Figma",
  },
  {
    icon: Server,
    title: "Backend & Services",
    techs: ["Node.js", "NestJS", "REST", "BullMQ", "Redis", "Microservices", "Nx"],
    description:
      "Owned 3 microservices end-to-end. Eliminated rate-limit failures with Redis cache-first architecture, reducing API costs to 30–40%.",
    accent: "#6366f1",
    highlight: "3 microservices|end-to-end|30–40%|Redis cache",
  },
  {
    icon: Activity,
    title: "Infrastructure & Observability",
    techs: ["Docker", "GitHub Actions", "Grafana", "Prometheus", "Sentry", "Coralogix"],
    description:
      "Drove CI/CD adoption at Restigo. Production monitoring across 20+ services in a high-traffic trading platform.",
    accent: "#10b981",
    highlight: "CI/CD|20+ services|high-traffic",
  },
  {
    icon: Database,
    title: "Data",
    techs: ["MongoDB", "SQL", "Redis"],
    description:
      "Designed SQL schemas for product features. Cache-first retrieval for high-frequency trading data with time-series candle caching.",
    accent: "#f59e0b",
    highlight: "SQL schemas|Cache-first|high-frequency",
  },
  {
    icon: Sparkles,
    title: "AI-Augmented Workflow",
    techs: ["Cursor", "Claude Code"],
    description:
      "Agent workflows for planning, refactors, code review, and test generation. Integrated into daily development cycle.",
    accent: "#ec4899",
    highlight: "Agent workflows|code review|test generation",
  },
  {
    icon: ShieldCheck,
    title: "Quality & Process",
    techs: ["SOLID", "Clean Architecture", "Jest", "Agile/Scrum"],
    description:
      "Architecture/training for 6 teams (~18–24 developers) on structure, rules, theming, i18n, UX states, and best practices.",
    accent: "#8b5cf6",
    highlight: "6 teams|18–24 developers|training",
  },
];

/* ── Highlight keywords ────────────────────────── */
function highlightText(text: string, patterns: string, color: string): React.ReactNode {
  const parts = patterns.split("|").filter(Boolean);
  if (parts.length === 0) return text;
  const regex = new RegExp(
    `(${parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const segments = text.split(regex);
  return (
    <>
      {segments.map((seg, i) =>
        parts.some((p) => p.toLowerCase() === seg.toLowerCase()) ? (
          <span key={i} className="font-medium" style={{ color }}>{seg}</span>
        ) : (
          seg
        )
      )}
    </>
  );
}

/* ── Spring config ─────────────────────────────── */
const spring = { stiffness: 80, damping: 25 };

/* ═══════════════════════════════════════════════════
   MagicBento Card — receives mouse position from parent
   ═══════════════════════════════════════════════════ */
function MagicCard({
  domain,
  index,
  mouseX,
  mouseY,
}: {
  domain: Domain;
  index: number;
  mouseX: number;
  mouseY: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fromLeft = index % 2 === 0;

  // Scroll-driven entrance
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end 0.85"],
  });
  const rawProgress = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const progress = useSpring(rawProgress, spring);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const opacity = useTransform(progress, [0, 0.5, 1], [0, 0.6, 1]);
  const y = useTransform(progress, [0, 1], [isMobile ? 30 : 60, 0]);
  const x = useTransform(progress, [0, 1], [isMobile ? 0 : fromLeft ? -40 : 40, 0]);
  const scale = useTransform(progress, [0, 0.5, 1], [0.95, 0.98, 1]);
  const blur = useTransform(progress, [0, 0.6, 1], [isMobile ? 4 : 8, 1, 0]);
  const filterBlur = useTransform(blur, (v) => `blur(${v}px)`);
  const rotateY = useTransform(progress, [0, 1], [isMobile ? 0 : fromLeft ? -4 : 4, 0]);

  // Calculate mouse position relative to THIS card
  const rect = innerRef.current?.getBoundingClientRect();
  const localX = rect ? mouseX - rect.left : 0;
  const localY = rect ? mouseY - rect.top : 0;
  const isNear = rect
    ? localX > -100 && localX < rect.width + 100 && localY > -100 && localY < rect.height + 100
    : false;

  const Icon = domain.icon;
  const accent = domain.accent;

  return (
    <motion.div
      ref={cardRef}
      className="h-full"
      style={{ opacity, y, x, scale, filter: filterBlur, rotateY, perspective: 800 }}
    >
      <div
        ref={innerRef}
        className="group relative h-full rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
        style={{
          background: "linear-gradient(135deg, #131729 0%, #0f1320 50%, #131729 100%)",
          border: `1px solid ${isNear ? `${accent}25` : "#1e234050"}`,
          transition: "border-color 0.4s",
        }}
      >
        {/* ── MagicBento spotlight — tracks parent mouse across all cards ── */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-500"
          style={{
            opacity: isNear ? 1 : 0,
            background: `radial-gradient(600px circle at ${localX}px ${localY}px, ${accent}12, transparent 40%)`,
          }}
        />

        {/* ── MagicBento border glow — shared flashlight border effect ── */}
        <div
          className="pointer-events-none absolute -inset-[1px] rounded-2xl transition-opacity duration-500"
          style={{
            opacity: isNear ? 1 : 0,
            background: `radial-gradient(400px circle at ${localX}px ${localY}px, ${accent}30, transparent 40%)`,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            padding: "1px",
            borderRadius: "1rem",
          }}
        />

        {/* Top accent line */}
        <div className="absolute top-0 inset-x-0 h-px" style={{
          background: `linear-gradient(90deg, transparent, ${accent}${isNear ? "60" : "20"} 50%, transparent)`,
          transition: "all 0.4s",
        }} />

        {/* Shine sweep */}
        <div
          className="absolute inset-0 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-[1200ms] ease-in-out pointer-events-none"
          style={{
            background: `linear-gradient(105deg, transparent 40%, ${accent}06 45%, ${accent}0a 50%, ${accent}06 55%, transparent 60%)`,
          }}
        />

        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none transition-opacity duration-500"
          style={{ opacity: isNear ? 0.8 : 0, borderTop: `1.5px solid ${accent}35`, borderLeft: `1.5px solid ${accent}35`, borderTopLeftRadius: "1rem" }} />
        <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none transition-opacity duration-500"
          style={{ opacity: isNear ? 0.8 : 0, borderBottom: `1.5px solid ${accent}35`, borderRight: `1.5px solid ${accent}35`, borderBottomRightRadius: "1rem" }} />

        {/* Card content */}
        <div className="relative p-5 md:p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
                style={{
                  background: `${accent}${isNear ? "18" : "0c"}`,
                  border: `1px solid ${accent}${isNear ? "30" : "15"}`,
                  boxShadow: isNear ? `0 0 20px ${accent}15` : "none",
                }}
              >
                <Icon
                  size={18}
                  style={{ color: accent }}
                  className="transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <h3 className="font-display font-semibold text-sm text-text-primary tracking-tight">
                {domain.title}
              </h3>
            </div>
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded-full transition-all duration-300"
              style={{
                color: `${accent}${isNear ? "cc" : "80"}`,
                background: `${accent}${isNear ? "15" : "08"}`,
                border: `1px solid ${accent}${isNear ? "25" : "10"}`,
              }}
            >
              {domain.techs.length}
            </span>
          </div>

          {/* Description */}
          <p className="text-[13px] text-text-secondary/80 leading-relaxed mb-4 flex-1">
            {highlightText(domain.description, domain.highlight, accent)}
          </p>

          {/* Divider */}
          <div className="h-px mb-4 mt-auto"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}18, transparent)` }} />

          {/* Tech pills */}
          <div className="flex flex-wrap gap-1.5">
            {domain.techs.map((t) => (
              <span
                key={t}
                className="inline-flex items-center font-mono text-[10px] leading-none px-2.5 py-1.5 rounded-md transition-all duration-200 hover:brightness-130"
                style={{
                  color: accent,
                  background: `${accent}0c`,
                  border: `1px solid ${accent}15`,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom glow */}
        <div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-2xl pointer-events-none transition-opacity duration-500"
          style={{ background: accent, opacity: isNear ? 0.05 : 0 }}
        />
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Stack section — MagicBento grid with shared mouse
   ═══════════════════════════════════════════════════ */
export default function Stack() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Single mousemove handler on the grid — the "magic" of MagicBento
  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <section id="stack" ref={sectionRef} className="relative py-20 md:py-28 px-4 md:px-6 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-[30%] left-[10%] w-[50vw] max-w-[400px] h-[50vw] max-h-[300px] rounded-full bg-accent-cyan/[0.015] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[45vw] max-w-[350px] h-[45vw] max-h-[250px] rounded-full bg-[#6366f1]/[0.015] blur-[80px] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal x={60}>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-text-primary whitespace-nowrap">
              Tech Stack
            </h2>
            <div className="section-divider flex-1" />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-text-secondary text-sm mb-4 max-w-lg">
            Not what I know — what I&apos;ve built with it.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="flex items-center gap-3 mb-10 md:mb-12">
            <div className="flex items-center gap-1.5 font-mono text-xs text-text-dim">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              {DOMAINS.reduce((sum, d) => sum + d.techs.length, 0)} technologies
            </div>
            <span className="text-text-dim/30">·</span>
            <span className="font-mono text-xs text-text-dim">
              {DOMAINS.length} domains
            </span>
          </div>
        </Reveal>

        {/* MagicBento grid — single mousemove on container */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 max-w-5xl items-stretch"
          onMouseMove={handleMouseMove}
        >
          {DOMAINS.map((domain, i) => (
            <MagicCard
              key={domain.title}
              domain={domain}
              index={i}
              mouseX={mousePos.x}
              mouseY={mousePos.y}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
