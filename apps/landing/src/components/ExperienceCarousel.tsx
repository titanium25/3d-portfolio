import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, type MotionValue } from "framer-motion";
import { GraduationCap, Zap, BookOpen, Cpu } from "lucide-react";
import RoleCard, { type RoleData } from "./RoleCard";

const ROLES: RoleData[] = [
  {
    company: "The5ers",
    title: "Full Stack Engineer",
    period: "2024 – PRESENT",
    context:
      "Core engineer in platform team · Nx monorepo · 100K+ user trading platform",
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
    context:
      "Client systems across frontend and backend · REST/SOAP integrations",
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
    context:
      "Team lead for 3 developers · Legacy modernization · CI/CD adoption",
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

const CARD_WIDTH_DESKTOP = 440;
const CARD_WIDTH_MOBILE = 340;
const CARD_HEIGHT = 520;
const CARD_GAP = 32;

export default function ExperienceCarousel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH_DESKTOP);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const update = () => {
      setViewportWidth(window.innerWidth);
      setCardWidth(window.innerWidth < 768 ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const totalCards = ROLES.length + 1;
  const totalRailWidth = totalCards * cardWidth + (totalCards - 1) * CARD_GAP;
  const maxTranslate = Math.max(0, totalRailWidth - viewportWidth + 96);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const railX = useTransform(smoothProgress, [0.05, 0.95], [0, -maxTranslate]);

  const wireScaleX = useSpring(
    useTransform(scrollYProgress, [0, 0.15], [0, 1]),
    { stiffness: 80, damping: 25 }
  );
  const headerOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.06], [0, 1]),
    { stiffness: 100, damping: 30 }
  );
  const headerX = useSpring(
    useTransform(scrollYProgress, [0, 0.06], [-60, 0]),
    { stiffness: 100, damping: 30 }
  );
  const progressScaleX = useSpring(
    useTransform(scrollYProgress, [0.05, 0.95], [0, 1]),
    { stiffness: 80, damping: 25 }
  );
  const activeStep = useTransform(smoothProgress, (p) =>
    Math.round(p * (totalCards - 1))
  );

  return (
    <section id="experience" ref={sectionRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">
        {/* Ambient glow */}
        <div className="absolute top-[30%] left-[5%] w-[400px] h-[400px] rounded-full bg-accent-cyan/[0.02] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-[#6366f1]/[0.02] blur-[80px] pointer-events-none" />

        {/* Header */}
        <motion.div
          className="mx-auto w-full max-w-6xl px-6 mb-5"
          style={{ opacity: headerOpacity, x: headerX }}
        >
          <div className="flex items-center gap-4 mb-2">
            <h2 className="font-display font-bold text-4xl text-text-primary whitespace-nowrap">
              Experience
            </h2>
            <motion.div
              className="section-divider flex-1 origin-left"
              style={{ scaleX: wireScaleX }}
            />
          </div>
          <p className="text-text-dim text-sm font-mono">
            Scroll to explore my journey
          </p>
        </motion.div>

        {/* Step indicators */}
        <motion.div
          className="mx-auto w-full max-w-6xl px-6 mb-5"
          style={{ opacity: headerOpacity }}
        >
          <div className="flex items-center gap-2">
            {[...ROLES.map((r) => r.company), "Education"].map((label, i) => (
              <StepDot
                key={label}
                index={i}
                label={label}
                activeStep={activeStep}
                accent={i < ROLES.length ? ROLES[i].accent || "#00e5cc" : "#4a5168"}
              />
            ))}
          </div>
        </motion.div>

        {/* Card rail — fixed height for all cards */}
        <motion.div
          className="flex items-stretch will-change-transform"
          style={{
            x: railX,
            gap: CARD_GAP,
            paddingLeft: Math.max(48, (viewportWidth - CARD_WIDTH_DESKTOP) / 2),
          }}
        >
          {ROLES.map((role, i) => (
            <RoleCard
              key={role.company}
              role={role}
              index={i}
              cardWidth={cardWidth}
              cardHeight={CARD_HEIGHT}
              scrollProgress={smoothProgress}
              totalCards={totalCards}
            />
          ))}
          <EducationCard
            cardWidth={cardWidth}
            cardHeight={CARD_HEIGHT}
            scrollProgress={smoothProgress}
            totalCards={totalCards}
            index={ROLES.length}
          />
        </motion.div>

        {/* Progress bar */}
        <div className="mx-auto w-full max-w-6xl px-6 mt-5">
          <div className="relative h-[3px] bg-border-subtle/50 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full origin-left"
              style={{
                scaleX: progressScaleX,
                background: "linear-gradient(90deg, #00e5cc, #6366f1, #f59e0b, #64748b)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="font-mono text-[11px] text-text-dim">
              See full details in CV →
            </p>
            <p className="font-mono text-[11px] text-text-dim">
              {ROLES.length} roles · {new Date().getFullYear() - 2018}+ years
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Step dot ─────────────────────────────────── */
function StepDot({
  index,
  label,
  activeStep,
  accent,
}: {
  index: number;
  label: string;
  activeStep: MotionValue<number>;
  accent: string;
}) {
  const dotScale = useSpring(
    useTransform(activeStep, (step: number): number => step >= index ? 1 : 0.6),
    { stiffness: 200, damping: 20 }
  );
  const dotOpacity = useSpring(
    useTransform(activeStep, (step: number): number => step >= index ? 1 : 0.3),
    { stiffness: 200, damping: 20 }
  );
  const lineScale = useSpring(
    useTransform(activeStep, (step: number): number => step >= index ? 1 : 0),
    { stiffness: 150, damping: 25 }
  );

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <motion.div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            scale: dotScale,
            opacity: dotOpacity,
            backgroundColor: accent,
            boxShadow: `0 0 8px ${accent}40`,
          }}
        />
        <span className="text-[9px] font-mono text-text-dim whitespace-nowrap hidden sm:block">
          {label}
        </span>
      </div>
      {index < 4 && (
        <motion.div
          className="w-8 sm:w-12 h-px origin-left"
          style={{
            scaleX: lineScale,
            backgroundColor: accent,
            opacity: dotOpacity,
          }}
        />
      )}
    </div>
  );
}

/* ── Education card — same height, rich design ──── */
function EducationCard({
  cardWidth,
  cardHeight,
  scrollProgress,
  totalCards,
  index,
}: {
  cardWidth: number;
  cardHeight: number;
  scrollProgress: ReturnType<typeof useSpring>;
  totalCards: number;
  index: number;
}) {
  const cardCenter = index / (totalCards - 1);
  const distFromCenter = useTransform(scrollProgress, (p: number) =>
    Math.abs(p - cardCenter)
  );
  const scale = useSpring(
    useTransform(distFromCenter, [0, 0.25, 0.8], [1, 0.96, 0.9]),
    { stiffness: 120, damping: 30 }
  );
  const opacity = useSpring(
    useTransform(distFromCenter, [0, 0.25, 0.8], [1, 0.75, 0.45]),
    { stiffness: 120, damping: 30 }
  );

  const eduAccent = "#8b5cf6";

  return (
    <motion.div
      className="shrink-0 will-change-transform"
      style={{ width: cardWidth, height: cardHeight, scale, opacity }}
    >
      <div
        className="relative h-full rounded-2xl border border-border-subtle/50 overflow-hidden group"
        style={{
          background: "linear-gradient(135deg, #131729 0%, #0f1320 50%, #131729 100%)",
        }}
      >
        {/* Subtle top accent */}
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${eduAccent}40 50%, transparent)`,
          }}
        />

        {/* Background pattern — faint circuit lines */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
          <svg width="100%" height="100%">
            <pattern id="circuit" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M30 0v20M30 40v20M0 30h20M40 30h20" stroke={eduAccent} strokeWidth="0.5" fill="none" />
              <circle cx="30" cy="30" r="3" fill="none" stroke={eduAccent} strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#circuit)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative h-full p-8 flex flex-col items-center justify-center text-center">
          {/* Step badge */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold font-mono mb-6"
            style={{
              background: `${eduAccent}15`,
              color: eduAccent,
              border: `1px solid ${eduAccent}30`,
            }}
          >
            05
          </div>

          {/* Icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{
              background: `${eduAccent}08`,
              border: `1px solid ${eduAccent}15`,
            }}
          >
            <GraduationCap size={28} style={{ color: eduAccent }} />
          </div>

          {/* Degree */}
          <h3 className="font-display font-bold text-xl text-text-primary mb-2">
            B.Sc. Electrical &amp; Electronics
          </h3>
          <p className="text-sm text-text-secondary mb-1">Engineering</p>
          <p className="font-mono text-xs text-text-dim mb-6">
            Ariel University
          </p>

          {/* Divider */}
          <div
            className="w-16 h-px mb-6"
            style={{
              background: `linear-gradient(90deg, transparent, ${eduAccent}30, transparent)`,
            }}
          />

          {/* Foundation skills */}
          <p className="font-mono text-[11px] text-text-dim mb-5 max-w-[280px]">
            The engineering foundation — signal processing, systems thinking, and mathematical rigor.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Cpu, label: "Systems Thinking" },
              { icon: Zap, label: "Signal Processing" },
              { icon: BookOpen, label: "Mathematics" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1.5 rounded-md"
                style={{
                  color: `${eduAccent}cc`,
                  background: `${eduAccent}08`,
                  border: `1px solid ${eduAccent}12`,
                }}
              >
                <Icon size={11} />
                {label}
              </div>
            ))}
          </div>

          {/* Bottom tagline */}
          <p
            className="mt-auto pt-6 font-mono text-[10px] italic"
            style={{ color: `${eduAccent}60` }}
          >
            Where it all began
          </p>
        </div>
      </div>
    </motion.div>
  );
}
