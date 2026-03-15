import { useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import Reveal from "./Reveal";

const INTERESTS = [
  { icon: "🏍️", label: "BMW S1000RR", detail: "199hp weekend therapy", accent: "#ef4444" },
  { icon: "🚴", label: "Cycling", detail: "80km Friday morning rides", accent: "#22c55e" },
  { icon: "🧱", label: "LEGO", detail: "Building cities with the twins", accent: "#f59e0b" },
  { icon: "📷", label: "Photography", detail: "Landscapes & photo editing", accent: "#8b5cf6" },
  { icon: "🐦", label: "Birding", detail: "White Wagtails & Bulbuls", accent: "#06b6d4" },
  { icon: "🌏", label: "Travel", detail: "Thailand, northern Israel", accent: "#ec4899" },
];

const spring = { stiffness: 80, damping: 25 };

/* ── Scroll-driven photo with parallax ──────── */
function ParallaxPhoto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useSpring(useTransform(scrollYProgress, [0, 1], [40, -40]), spring);
  const imgScale = useSpring(useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1.05, 1]), spring);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.4], [0.4, 0]);

  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className="relative rounded-2xl overflow-hidden aspect-[4/3] md:aspect-[4/5]"
      initial={{ opacity: 0, x: -50, scale: 0.95 }}
      animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-accent-cyan/40 rounded-tl-xl z-10" />
      <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-accent-cyan/20 rounded-tr-xl z-10" />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-accent-cyan/20 rounded-bl-xl z-10" />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-accent-cyan/40 rounded-br-xl z-10" />

      {/* Parallax image */}
      <motion.div className="absolute inset-0" style={{ y: imgY, scale: imgScale }}>
        <img
          src="/img/alex-office.png"
          alt="Alexander Lazarovich"
          className="w-full h-full object-cover object-top"
          loading="lazy"
          width={480}
          height={600}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </motion.div>

      {/* Cinematic overlay that fades on scroll */}
      <motion.div
        className="absolute inset-0 bg-bg-primary pointer-events-none"
        style={{ opacity: overlayOpacity }}
      />

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-primary/70 to-transparent z-[1]" />

      {/* Location tag */}
      <p className="absolute bottom-3 left-3 md:bottom-4 md:left-4 font-mono text-xs text-accent-cyan/80 z-10">
        Ra&apos;anana, Israel
      </p>

      {/* Subtle scanlines */}
      <div className="absolute inset-0 z-[2] pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,204,0.1) 2px, rgba(0,229,204,0.1) 4px)",
        }}
      />
    </motion.div>
  );
}

/* ── Interest chip with spotlight hover ────────── */
function InterestChip({
  item,
  index,
}: {
  item: (typeof INTERESTS)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    []
  );

  const accent = item.accent;

  return (
    <Reveal delay={0.15 + index * 0.06} y={20}>
      <div
        ref={ref}
        className="group relative rounded-xl border border-border-subtle bg-bg-card/60 px-3 md:px-4 py-3 md:py-3.5 overflow-hidden transition-all duration-300 hover:-translate-y-1"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          borderColor: isHovered ? `${accent}30` : undefined,
        }}
      >
        {/* Spotlight */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(120px circle at ${mousePos.x}px ${mousePos.y}px, ${accent}18, transparent 60%)`,
          }}
        />

        {/* Top accent line */}
        <div
          className="absolute top-0 inset-x-0 h-px transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `linear-gradient(90deg, transparent, ${accent}50 50%, transparent)`,
          }}
        />

        <div className="relative flex items-start gap-2.5">
          <span className="text-xl md:text-2xl mt-0.5 transition-transform duration-300 group-hover:scale-110">
            {item.icon}
          </span>
          <div className="min-w-0">
            <span className="text-xs md:text-sm text-text-primary font-medium block">
              {item.label}
            </span>
            <p className="text-[10px] md:text-xs text-text-dim mt-0.5 leading-relaxed">
              {item.detail}
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ── Highlighted prose text ─────────────────────── */
function Prose({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Main About section ─────────────────────────── */
export default function About() {
  return (
    <section id="about" className="relative py-16 md:py-24 px-4 md:px-6 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-[20%] right-[5%] w-[50vw] max-w-[400px] h-[50vw] max-h-[400px] rounded-full bg-accent-cyan/[0.025] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[40vw] max-w-[300px] h-[40vw] max-h-[300px] rounded-full bg-[#8b5cf6]/[0.02] blur-[80px] pointer-events-none" />

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <Reveal x={-40}>
          <div className="flex items-center gap-4 mb-3">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-text-primary whitespace-nowrap">
              Beyond the Terminal
            </h2>
            <div className="section-divider flex-1" />
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="text-text-dim text-xs md:text-sm font-mono mb-10 md:mb-12">
            The person behind the code
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Photo with parallax */}
          <ParallaxPhoto />

          {/* Content */}
          <div>
            <Prose delay={0.1}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-5 md:mb-6">
                I&apos;m a full-stack engineer based in{" "}
                <span className="font-medium text-text-primary border-b border-accent-cyan/30">
                  Ra&apos;anana, Israel
                </span>
                , balancing high-traffic platforms during the week with{" "}
                <span className="font-medium text-text-primary">80km cycling rides</span>{" "}
                on Friday mornings before the world wakes up.
              </p>
            </Prose>

            <Prose delay={0.2}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-5 md:mb-6">
                Father of twins who builds LEGO cities with them, rides a{" "}
                <span className="font-medium text-text-primary border-b border-accent-cyan/30">
                  2014 BMW S1000RR
                </span>{" "}
                on weekends, and spots White Wagtails from a park bench with good coffee.
              </p>
            </Prose>

            <Prose delay={0.3}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-8 md:mb-10">
                I believe the best teams are built on{" "}
                <span className="font-medium text-text-primary">clear communication</span>,{" "}
                <span className="font-medium text-text-primary">rigorous code review</span>,
                and genuine curiosity. When I join a team, I don&apos;t just ship features —
                I build the foundations that help everyone ship faster.
              </p>
            </Prose>

            {/* Divider before chips */}
            <Reveal delay={0.35}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
                <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Interests</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
              </div>
            </Reveal>

            {/* Interest chips */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3">
              {INTERESTS.map((item, i) => (
                <InterestChip key={item.label} item={item} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
