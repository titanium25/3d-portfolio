import { useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import {
  Bike,
  Gauge,
  ToyBrick,
  Camera,
  Bird,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Reveal from "./Reveal";

interface Interest {
  icon: LucideIcon;
  label: string;
  detail: string;
  accent: string;
}

const INTERESTS: Interest[] = [
  { icon: Gauge, label: "BMW S1000RR", detail: "199hp weekend therapy", accent: "#ef4444" },
  { icon: Bike, label: "Cycling", detail: "80km Friday morning rides", accent: "#22c55e" },
  { icon: ToyBrick, label: "LEGO", detail: "Building cities with the twins", accent: "#f59e0b" },
  { icon: Camera, label: "Photography", detail: "Landscapes & photo editing", accent: "#8b5cf6" },
  { icon: Bird, label: "Birding", detail: "White Wagtails & Bulbuls", accent: "#06b6d4" },
  { icon: Globe, label: "Travel", detail: "Thailand, northern Israel", accent: "#ec4899" },
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
      <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-accent-cyan/40 rounded-tl-xl z-10" />
      <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-accent-cyan/20 rounded-tr-xl z-10" />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-accent-cyan/20 rounded-bl-xl z-10" />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-accent-cyan/40 rounded-br-xl z-10" />

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

      <motion.div className="absolute inset-0 bg-bg-primary pointer-events-none" style={{ opacity: overlayOpacity }} />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-primary/70 to-transparent z-[1]" />
      <p className="absolute bottom-3 left-3 md:bottom-4 md:left-4 font-mono text-xs text-accent-cyan/80 z-10">
        Ra&apos;anana, Israel
      </p>
      <div className="absolute inset-0 z-[2] pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,204,0.1) 2px, rgba(0,229,204,0.1) 4px)" }}
      />
    </motion.div>
  );
}

/* ── Premium interest card ─────────────────────── */
function InterestCard({ item, index }: { item: Interest; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const { accent } = item;
  const Icon = item.icon;

  return (
    <Reveal delay={0.15 + index * 0.07} y={24} className="h-full">
      <div
        ref={ref}
        className="group relative h-full rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 cursor-default"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: "linear-gradient(135deg, #131729 0%, #0f1320 100%)",
          border: `1px solid ${isHovered ? `${accent}35` : "#1e234050"}`,
        }}
      >
        {/* Mouse-tracking spotlight */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(180px circle at ${mousePos.x}px ${mousePos.y}px, ${accent}15, transparent 60%)`,
          }}
        />

        {/* Conic gradient border on hover */}
        <div
          className="pointer-events-none absolute -inset-[1px] rounded-2xl transition-opacity duration-500"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `conic-gradient(from ${Math.atan2(mousePos.y - 40, mousePos.x - 80) * (180 / Math.PI)}deg at ${mousePos.x}px ${mousePos.y}px, ${accent}30, transparent 25%, transparent 75%, ${accent}30)`,
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
          background: `linear-gradient(90deg, transparent, ${accent}${isHovered ? "70" : "25"} 50%, transparent)`,
          transition: "all 0.3s",
        }} />

        {/* Shine sweep */}
        <div
          className="absolute inset-0 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-[1000ms] ease-in-out pointer-events-none"
          style={{
            background: `linear-gradient(105deg, transparent 40%, ${accent}08 45%, ${accent}12 50%, ${accent}08 55%, transparent 60%)`,
          }}
        />

        {/* Content — vertical layout for breathing room */}
        <div className="relative p-4 flex flex-col items-center text-center h-full">
          {/* Icon */}
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300"
            style={{
              background: `${accent}${isHovered ? "18" : "0c"}`,
              border: `1px solid ${accent}${isHovered ? "30" : "15"}`,
              boxShadow: isHovered ? `0 0 16px ${accent}15` : "none",
            }}
          >
            <Icon
              size={18}
              style={{ color: accent }}
              className="transition-transform duration-300 group-hover:scale-110"
            />
          </div>

          {/* Text */}
          <p className="font-display font-semibold text-sm text-text-primary mb-1 tracking-tight">
            {item.label}
          </p>
          <p className="text-[11px] text-text-dim leading-relaxed">
            {item.detail}
          </p>
        </div>

        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 pointer-events-none transition-opacity duration-500"
          style={{ opacity: isHovered ? 1 : 0, borderTop: `1.5px solid ${accent}30`, borderLeft: `1.5px solid ${accent}30`, borderTopLeftRadius: "1rem" }} />
        <div className="absolute bottom-0 right-0 w-4 h-4 pointer-events-none transition-opacity duration-500"
          style={{ opacity: isHovered ? 1 : 0, borderBottom: `1.5px solid ${accent}30`, borderRight: `1.5px solid ${accent}30`, borderBottomRightRadius: "1rem" }} />

        {/* Bottom glow */}
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2/3 h-4 rounded-full blur-xl pointer-events-none transition-opacity duration-500"
          style={{ background: accent, opacity: isHovered ? 0.06 : 0 }}
        />
      </div>
    </Reveal>
  );
}

/* ── Highlighted prose ──────────────────────────── */
function Prose({ children, delay }: { children: React.ReactNode; delay: number }) {
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
      <div className="absolute top-[20%] right-[5%] w-[50vw] max-w-[400px] h-[50vw] max-h-[400px] rounded-full bg-accent-cyan/[0.025] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[40vw] max-w-[300px] h-[40vw] max-h-[300px] rounded-full bg-[#8b5cf6]/[0.02] blur-[80px] pointer-events-none" />

      <div className="mx-auto max-w-6xl">
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
          <ParallaxPhoto />

          <div>
            <Prose delay={0.1}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-5 md:mb-6">
                I&apos;m a full-stack engineer based in{" "}
                <span className="font-medium text-text-primary border-b border-accent-cyan/30">Ra&apos;anana, Israel</span>,
                balancing high-traffic platforms during the week with{" "}
                <span className="font-medium text-text-primary">80km cycling rides</span> on Friday mornings.
              </p>
            </Prose>

            <Prose delay={0.2}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-5 md:mb-6">
                Father of twins who builds LEGO cities with them, rides a{" "}
                <span className="font-medium text-text-primary border-b border-accent-cyan/30">2014 BMW S1000RR</span>{" "}
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

            <Reveal delay={0.35}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
                <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Interests</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
              </div>
            </Reveal>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
              {INTERESTS.map((item, i) => (
                <InterestCard key={item.label} item={item} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
