import { useState, useRef, useCallback } from "react";
import { motion, MotionValue, useTransform, useSpring } from "framer-motion";

export interface RoleData {
  company: string;
  title: string;
  period: string;
  context: string;
  bullets: string[];
  tech: string[];
  isOriginStory?: boolean;
  originQuote?: string;
  accent?: string;
}

interface RoleCardProps {
  role: RoleData;
  index: number;
  cardWidth: number;
  cardHeight: number;
  scrollProgress: MotionValue<number>;
  totalCards: number;
}

/* ── Buzz word highlighter ─────────────────────── */
const BUZZ_PATTERNS = [
  // Metrics / numbers
  /(\d[\d,]*\+?\s*(?:K\+?|%|users|developers|microservices|services|teams|libraries))/gi,
  // Specific impact phrases
  /(100K\+)/g,
  /(30[–-]40%)/g,
  /(70K\s*active)/gi,
  // Key technologies when used as achievements
  /(React Query)/g,
  /(Redis cache)/gi,
  /(CI\/CD)/g,
  /(Docker\/AWS)/g,
  // Action verbs / ownership
  /(Owned|Led|Introduced|Eliminated|Trained|Delivered|Modernized|Supported)/g,
  // Specific terms
  /(end-to-end|company-wide|mission-critical)/gi,
  /(jQuery → React)/g,
];

function highlightBullet(text: string, accent: string): React.ReactNode {
  // Collect all match positions
  const highlights: { start: number; end: number }[] = [];

  for (const pattern of BUZZ_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      highlights.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  if (highlights.length === 0) return text;

  // Merge overlapping ranges
  highlights.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const h of highlights) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end) {
      last.end = Math.max(last.end, h.end);
    } else {
      merged.push({ ...h });
    }
  }

  // Build fragments
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < merged.length; i++) {
    const { start, end } = merged[i];
    if (cursor < start) {
      parts.push(text.slice(cursor, start));
    }
    parts.push(
      <span
        key={i}
        className="font-medium"
        style={{ color: accent }}
      >
        {text.slice(start, end)}
      </span>
    );
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}

/* ── RoleCard component ────────────────────────── */
export default function RoleCard({
  role,
  index,
  cardWidth,
  cardHeight,
  scrollProgress,
  totalCards,
}: RoleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  const cardCenter = index / (totalCards - 1);
  const distFromCenter = useTransform(scrollProgress, (p) =>
    Math.abs(p - cardCenter)
  );
  const scale = useSpring(
    useTransform(distFromCenter, [0, 0.25, 0.8], [1, 0.96, 0.9]),
    { stiffness: 120, damping: 30 }
  );
  const cardOpacity = useSpring(
    useTransform(distFromCenter, [0, 0.25, 0.8], [1, 0.75, 0.45]),
    { stiffness: 120, damping: 30 }
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    },
    []
  );

  const spotlightX = mousePos.x * 100;
  const spotlightY = mousePos.y * 100;
  const tiltX = (mousePos.y - 0.5) * -5;
  const tiltY = (mousePos.x - 0.5) * 5;

  const accentColor = role.accent || "#00e5cc";

  return (
    <motion.div
      className="shrink-0 will-change-transform"
      style={{
        width: cardWidth,
        height: cardHeight,
        scale,
        opacity: cardOpacity,
        perspective: 800,
      }}
    >
      <motion.div
        ref={cardRef}
        className="relative h-full group"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setMousePos({ x: 0.5, y: 0.5 });
        }}
        animate={{
          rotateX: isHovered ? tiltX : 0,
          rotateY: isHovered ? tiltY : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Glow backdrop */}
        <div
          className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10 blur-xl"
          style={{
            background: `radial-gradient(600px circle at ${spotlightX}% ${spotlightY}%, ${accentColor}15, transparent 60%)`,
          }}
        />

        {/* Animated gradient border */}
        <div
          className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `conic-gradient(from ${isHovered ? mousePos.x * 360 : 0}deg at ${spotlightX}% ${spotlightY}%, ${accentColor}40, transparent 25%, transparent 75%, ${accentColor}40)`,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            padding: "1px",
            borderRadius: "1rem",
          }}
        />

        {/* Main card */}
        <div
          className={`relative h-full rounded-2xl border overflow-hidden transition-colors duration-300 ${
            role.isOriginStory
              ? "border-dashed border-border-subtle/50"
              : "border-border-subtle/70 group-hover:border-transparent"
          }`}
          style={{
            background: "linear-gradient(135deg, #131729 0%, #0f1320 50%, #131729 100%)",
          }}
        >
          {/* Spotlight follow */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: `radial-gradient(400px circle at ${spotlightX}% ${spotlightY}%, ${accentColor}08, transparent 50%)`,
            }}
          />

          {/* Shine sweep */}
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out pointer-events-none"
            style={{
              background:
                "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.02) 55%, transparent 60%)",
            }}
          />

          {/* Top accent line */}
          <div className="absolute top-0 inset-x-0 h-px">
            <div
              className="h-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor}60 30%, ${accentColor}80 50%, ${accentColor}60 70%, transparent)`,
              }}
            />
          </div>

          {/* Card content — scrollable overflow */}
          <div className="relative p-6 sm:p-7 flex flex-col h-full overflow-y-auto scrollbar-hide">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono"
                    style={{
                      background: `${accentColor}15`,
                      color: accentColor,
                      border: `1px solid ${accentColor}30`,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div
                    className="absolute inset-0 rounded-full animate-pulse-dot pointer-events-none"
                    style={{
                      boxShadow: `0 0 12px ${accentColor}25, 0 0 4px ${accentColor}15`,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] font-medium tracking-widest text-text-dim uppercase">
                  {role.period}
                </span>
              </div>

              {role.period.includes("PRESENT") && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-accent-cyan/80">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan/60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan" />
                  </span>
                  Active
                </span>
              )}
            </div>

            {/* Company */}
            <h3 className="font-display font-bold text-2xl text-text-primary mb-1 tracking-tight shrink-0">
              {role.company}
            </h3>
            <p className="text-sm text-text-secondary mb-0.5 shrink-0">{role.title}</p>
            {role.context && (
              <p className="font-mono text-[11px] text-text-dim leading-relaxed mb-4 shrink-0">
                {role.context}
              </p>
            )}

            {/* Divider */}
            <div className="h-px mb-4 shrink-0">
              <div
                className="h-full"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentColor}20 20%, ${accentColor}30 50%, ${accentColor}20 80%, transparent)`,
                }}
              />
            </div>

            {/* Bullets with highlighted buzz words */}
            <ul className="space-y-2.5 flex-1 min-h-0">
              {role.bullets.map((bullet, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[13px] text-text-secondary/90 leading-relaxed"
                >
                  <span
                    className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: accentColor,
                      boxShadow: `0 0 6px ${accentColor}40`,
                    }}
                  />
                  <span>{highlightBullet(bullet, accentColor)}</span>
                </li>
              ))}
            </ul>

            {role.originQuote && (
              <p
                className="mt-4 text-[13px] italic text-text-dim pl-4 shrink-0"
                style={{ borderLeft: `2px solid ${accentColor}30` }}
              >
                &ldquo;{role.originQuote}&rdquo;
              </p>
            )}

            {/* Tech pills — pinned to bottom */}
            {role.tech.length > 0 && (
              <div className="mt-auto pt-4 shrink-0">
                <div
                  className="h-px mb-3"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accentColor}15, transparent)`,
                  }}
                />
                <div className="flex flex-wrap gap-1.5">
                  {role.tech.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center font-mono text-[10px] leading-none px-2 py-1.5 rounded-md transition-all duration-200 hover:brightness-125"
                      style={{
                        color: accentColor,
                        background: `${accentColor}10`,
                        border: `1px solid ${accentColor}18`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Corner accents */}
          <div
            className="absolute top-0 left-0 w-8 h-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              borderTop: `1px solid ${accentColor}25`,
              borderLeft: `1px solid ${accentColor}25`,
              borderTopLeftRadius: "1rem",
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              borderBottom: `1px solid ${accentColor}25`,
              borderRight: `1px solid ${accentColor}25`,
              borderBottomRightRadius: "1rem",
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
