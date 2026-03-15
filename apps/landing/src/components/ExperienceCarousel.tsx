import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { GraduationCap, Zap, BookOpen, Cpu, ChevronLeft, ChevronRight } from "lucide-react";
import type { RoleData } from "./RoleCard";
import Reveal from "./Reveal";

const ROLES: RoleData[] = [
  {
    company: "The5ers",
    title: "Full Stack Engineer",
    period: "2024 – PRESENT",
    context: "Core engineer in platform team · Nx monorepo · 100K+ user trading platform",
    bullets: [
      "Owned dashboards for 100K+ users with smart polling aligned to 30s backend sync.",
      "Introduced React Query company-wide — patterns, cache strategy, invalidation rules.",
      "Eliminated rate-limit failures; reduced API costs to 30–40% via Redis cache layer.",
      "Trained 6 teams (~18–24 developers) on company standards.",
    ],
    tech: ["React", "TypeScript", "React Query", "MUI", "NestJS", "Redis", "BullMQ", "Nx"],
    accent: "#00e5cc",
  },
  {
    company: "Triolla",
    title: "Full Stack Engineer",
    period: "2023 – 2024",
    context: "Client systems across frontend and backend · REST/SOAP integrations",
    bullets: [
      "Delivered client systems across frontend and backend (React, Node/Nest/Express, Laravel).",
      "Modernized deployments with Docker/AWS.",
    ],
    tech: ["React", "TypeScript", "NestJS", "Docker", "AWS"],
    accent: "#6366f1",
  },
  {
    company: "Restigo",
    title: "Full Stack Engineer",
    period: "2022 – 2023",
    context: "Team lead for 3 developers · Legacy modernization · CI/CD adoption",
    bullets: [
      "Led team of 3 developers; drove CI/CD adoption.",
      "Modernized legacy UI: jQuery → React. Designed new SQL schemas.",
    ],
    tech: ["React", "Node.js", "SQL", "CI/CD", "Docker"],
    accent: "#f59e0b",
  },
  {
    company: "ASML",
    title: "Field Service Engineer (Client: Intel)",
    period: "2018 – 2022",
    context: "Mission-critical semiconductor production at Intel fab",
    bullets: [
      "Supported mission-critical production at Intel; built the troubleshooting mindset that drives everything above.",
    ],
    tech: ["Linux / Unix", "MATLAB", "System Admin", "Hardware Troubleshooting"],
    isOriginStory: true,
    originQuote: "Where hardware discipline became software instinct.",
    accent: "#64748b",
  },
];

const CARD_HEIGHT = 480;

/* ═══════════════════════════════════════════════════
   Buzz word highlighter (same as RoleCard)
   ═══════════════════════════════════════════════════ */
const BUZZ_PATTERNS = [
  /(\d[\d,]*\+?\s*(?:K\+?|%|users|developers|microservices|services|teams|libraries))/gi,
  /(100K\+)/g, /(30[–-]40%)/g, /(React Query)/g, /(Redis cache)/gi,
  /(CI\/CD)/g, /(Docker\/AWS)/g,
  /(Owned|Led|Introduced|Eliminated|Trained|Delivered|Modernized|Supported)/g,
  /(end-to-end|company-wide|mission-critical)/gi, /(jQuery → React)/g,
];

function highlightBullet(text: string, accent: string): React.ReactNode {
  const highlights: { start: number; end: number }[] = [];
  for (const pattern of BUZZ_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      highlights.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  if (highlights.length === 0) return text;
  highlights.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const h of highlights) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end) last.end = Math.max(last.end, h.end);
    else merged.push({ ...h });
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < merged.length; i++) {
    const { start, end } = merged[i];
    if (cursor < start) parts.push(text.slice(cursor, start));
    parts.push(<span key={i} className="font-medium" style={{ color: accent }}>{text.slice(start, end)}</span>);
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/* ═══════════════════════════════════════════════════
   Experience Card (shared desktop + mobile)
   ═══════════════════════════════════════════════════ */
function ExperienceCard({
  role,
  index,
  className,
  style,
}: {
  role: RoleData;
  index: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const accent = role.accent || "#00e5cc";
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 snap-center shrink-0 ${className ?? ""}`}
      style={{
        background: "linear-gradient(135deg, #131729 0%, #0f1320 100%)",
        border: `1px solid ${isHovered ? `${accent}30` : "#1e234050"}`,
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${accent}10, transparent 50%)`,
        }}
      />

      {/* Top accent */}
      <div className="absolute top-0 inset-x-0 h-px" style={{
        background: `linear-gradient(90deg, transparent, ${accent}${isHovered ? "80" : "40"} 50%, transparent)`,
      }} />

      {/* Shine sweep */}
      <div
        className="absolute inset-0 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-[1200ms] ease-in-out pointer-events-none"
        style={{
          background: `linear-gradient(105deg, transparent 40%, ${accent}06 45%, ${accent}0a 50%, ${accent}06 55%, transparent 60%)`,
        }}
      />

      <div className="relative p-5 sm:p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold font-mono"
              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
            >
              {String(index + 1).padStart(2, "0")}
            </div>
            <span className="font-mono text-[10px] sm:text-[11px] tracking-widest text-text-dim uppercase">
              {role.period}
            </span>
          </div>
          {role.period.includes("PRESENT") && (
            <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-accent-cyan/80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan/60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-cyan" />
              </span>
              Active
            </span>
          )}
        </div>

        <h3 className="font-display font-bold text-xl sm:text-2xl text-text-primary mb-0.5 tracking-tight">
          {role.company}
        </h3>
        <p className="text-xs sm:text-sm text-text-secondary mb-0.5">{role.title}</p>
        {role.context && (
          <p className="font-mono text-[10px] sm:text-[11px] text-text-dim leading-relaxed mb-4">{role.context}</p>
        )}

        <div className="h-px mb-4" style={{ background: `linear-gradient(90deg, transparent, ${accent}20, transparent)` }} />

        {/* Bullets */}
        <ul className="space-y-2 sm:space-y-2.5 flex-1 min-h-0">
          {role.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2 sm:gap-2.5 text-xs sm:text-[13px] text-text-secondary/90 leading-relaxed">
              <span
                className="mt-[4px] sm:mt-[5px] shrink-0 w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full"
                style={{ background: accent, boxShadow: `0 0 6px ${accent}40` }}
              />
              <span>{highlightBullet(bullet, accent)}</span>
            </li>
          ))}
        </ul>

        {role.originQuote && (
          <p className="mt-3 text-xs sm:text-[13px] italic text-text-dim pl-3 sm:pl-4" style={{ borderLeft: `2px solid ${accent}30` }}>
            &ldquo;{role.originQuote}&rdquo;
          </p>
        )}

        {/* Tech pills */}
        {role.tech.length > 0 && (
          <div className="mt-auto pt-4">
            <div className="h-px mb-3" style={{ background: `linear-gradient(90deg, transparent, ${accent}15, transparent)` }} />
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {role.tech.map((t) => (
                <span
                  key={t}
                  className="font-mono text-[9px] sm:text-[10px] leading-none px-2 py-1 sm:py-1.5 rounded-md transition-all duration-200 hover:brightness-125"
                  style={{ color: accent, background: `${accent}0c`, border: `1px solid ${accent}15` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ borderTop: `1.5px solid ${accent}40`, borderLeft: `1.5px solid ${accent}40`, borderTopLeftRadius: "1rem" }} />
      <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ borderBottom: `1.5px solid ${accent}40`, borderRight: `1.5px solid ${accent}40`, borderBottomRightRadius: "1rem" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Education Card
   ═══════════════════════════════════════════════════ */
function EducationCard({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const eduAccent = "#8b5cf6";
  return (
    <div
      className={`relative rounded-2xl border border-border-subtle/50 overflow-hidden snap-center shrink-0 ${className ?? ""}`}
      style={{ background: "linear-gradient(135deg, #131729 0%, #0f1320 100%)", ...style }}
    >
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${eduAccent}40 50%, transparent)` }} />
      <div className="relative h-full p-6 sm:p-8 flex flex-col items-center justify-center text-center">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold font-mono mb-4 sm:mb-6"
          style={{ background: `${eduAccent}15`, color: eduAccent, border: `1px solid ${eduAccent}30` }}>05</div>
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6"
          style={{ background: `${eduAccent}08`, border: `1px solid ${eduAccent}15` }}>
          <GraduationCap size={24} style={{ color: eduAccent }} />
        </div>
        <h3 className="font-display font-bold text-lg sm:text-xl text-text-primary mb-1">B.Sc. EE Engineering</h3>
        <p className="font-mono text-xs text-text-dim mb-4 sm:mb-6">Ariel University</p>
        <div className="w-12 h-px mb-4 sm:mb-6" style={{ background: `linear-gradient(90deg, transparent, ${eduAccent}30, transparent)` }} />
        <p className="font-mono text-[10px] sm:text-[11px] text-text-dim mb-4 max-w-[260px]">
          Signal processing, systems thinking, and mathematical rigor.
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {[
            { icon: Cpu, label: "Systems" },
            { icon: Zap, label: "Signals" },
            { icon: BookOpen, label: "Math" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1 sm:gap-1.5 font-mono text-[9px] sm:text-[10px] px-2 py-1 sm:py-1.5 rounded-md"
              style={{ color: `${eduAccent}cc`, background: `${eduAccent}08`, border: `1px solid ${eduAccent}12` }}>
              <Icon size={10} />{label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Scroll nav buttons
   ═══════════════════════════════════════════════════ */
function ScrollButtons({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 460, behavior: "smooth" });
  };

  return (
    <div className="hidden md:flex items-center gap-2">
      <button
        onClick={() => scroll(-1)}
        className="w-9 h-9 rounded-full border border-border-subtle bg-bg-card/60 flex items-center justify-center text-text-dim hover:text-accent-cyan hover:border-accent-cyan/30 transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => scroll(1)}
        className="w-9 h-9 rounded-full border border-border-subtle bg-bg-card/60 flex items-center justify-center text-text-dim hover:text-accent-cyan hover:border-accent-cyan/30 transition-colors"
        aria-label="Next"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main export — NO sticky, NO extra height, ZERO gaps
   ═══════════════════════════════════════════════════ */
export default function ExperienceCarousel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section id="experience" ref={sectionRef} className="relative py-16 md:py-24 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[30%] left-[5%] w-[50vw] max-w-[400px] h-[50vw] max-h-[400px] rounded-full bg-accent-cyan/[0.02] blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 md:mb-10">
          <div className="flex-1">
            <Reveal>
              <div className="flex items-center gap-4 mb-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-text-primary whitespace-nowrap">
                  Experience
                </h2>
                <div className="section-divider flex-1" />
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="text-text-dim text-xs md:text-sm font-mono">
                {ROLES.length} roles · {new Date().getFullYear() - 2018}+ years
              </p>
            </Reveal>
          </div>
          <ScrollButtons scrollRef={scrollContainerRef} />
        </div>
      </div>

      {/* Horizontal scroll rail — native scroll + snap */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          ref={scrollContainerRef}
          className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory pb-4 px-4 md:px-6 scrollbar-hide"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Left spacer for centering first card */}
          <div className="shrink-0 w-0 md:w-[calc((100vw-1152px)/2)]" />

          {ROLES.map((role, i) => (
            <ExperienceCard
              key={role.company}
              role={role}
              index={i}
              className="w-[85vw] md:w-[420px]"
              style={{ minHeight: CARD_HEIGHT }}
            />
          ))}

          <EducationCard className="w-[85vw] md:w-[420px]" style={{ minHeight: CARD_HEIGHT }} />

          {/* Right spacer */}
          <div className="shrink-0 w-4 md:w-[calc((100vw-1152px)/2)]" />
        </div>
      </motion.div>

      {/* Bottom info */}
      <div className="mx-auto max-w-6xl px-4 md:px-6 mt-4">
        <p className="font-mono text-[11px] text-text-dim">
          Swipe or scroll horizontally · See full details in CV →
        </p>
      </div>
    </section>
  );
}
