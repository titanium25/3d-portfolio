import { useRef, useState, useCallback } from "react";
import { motion, useInView, useScroll, useTransform, useSpring } from "framer-motion";
import {
  Download,
  Mail,
  Linkedin,
  Phone,
  MapPin,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const CONTACT_METHODS = [
  {
    icon: Mail,
    label: "Email",
    value: "alex.lazarovichh@gmail.com",
    href: "mailto:alex.lazarovichh@gmail.com",
    accent: "#00e5cc",
  },
  {
    icon: Linkedin,
    label: "LinkedIn",
    value: "alexander-lazarovich",
    href: "https://linkedin.com/in/alexander-lazarovich",
    accent: "#6366f1",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "054-4567302",
    href: "tel:+972544567302",
    accent: "#10b981",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Ra'anana, Israel",
    href: "#",
    accent: "#f59e0b",
  },
];

/* ── Floating particles ────────────────────────── */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-accent-cyan/30"
          style={{
            left: `${8 + i * 8}%`,
            top: `${15 + (i * 7) % 70}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.7, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 4 + i * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
        />
      ))}
    </div>
  );
}

/* ── Contact method card ───────────────────────── */
function ContactCard({
  method,
  index,
}: {
  method: (typeof CONTACT_METHODS)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const Icon = method.icon;
  const accent = method.accent;
  const isLink = method.href !== "#";

  const Wrapper = isLink ? "a" : "div";
  const wrapperProps = isLink
    ? {
        href: method.href,
        target: method.href.startsWith("http") ? "_blank" : undefined,
        rel: method.href.startsWith("http") ? "noopener noreferrer" : undefined,
      }
    : {};

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, filter: "blur(4px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.6, delay: 0.3 + index * 0.1, ease }}
    >
      <Wrapper
        {...wrapperProps}
        className="group relative block rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: "linear-gradient(135deg, #131729 0%, #0f1320 100%)",
          border: `1px solid ${isHovered ? `${accent}30` : "#1e234050"}`,
        }}
      >
        {/* Spotlight */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, ${accent}15, transparent 60%)`,
          }}
        />

        {/* Top accent */}
        <div
          className="absolute top-0 inset-x-0 h-px transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0.3,
            background: `linear-gradient(90deg, transparent, ${accent}${isHovered ? "70" : "25"} 50%, transparent)`,
          }}
        />

        {/* Shine sweep */}
        <div
          className="absolute inset-0 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-[1000ms] ease-in-out pointer-events-none"
          style={{
            background: `linear-gradient(105deg, transparent 40%, ${accent}08 45%, ${accent}12 50%, ${accent}08 55%, transparent 60%)`,
          }}
        />

        <div className="relative p-5 flex items-center gap-4">
          {/* Icon */}
          <div
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              background: `${accent}${isHovered ? "18" : "0c"}`,
              border: `1px solid ${accent}${isHovered ? "30" : "15"}`,
              boxShadow: isHovered ? `0 0 20px ${accent}15` : "none",
            }}
          >
            <Icon
              size={18}
              style={{ color: accent }}
              className="transition-transform duration-300 group-hover:scale-110"
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim mb-0.5">
              {method.label}
            </p>
            <p className="text-sm text-text-primary font-medium truncate">
              {method.value}
            </p>
          </div>

          {/* Arrow */}
          {isLink && (
            <ArrowUpRight
              size={16}
              className="text-text-dim group-hover:text-accent-cyan transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          )}
        </div>

        {/* Corner brackets */}
        <div
          className="absolute top-0 left-0 w-4 h-4 pointer-events-none transition-opacity duration-500"
          style={{
            opacity: isHovered ? 1 : 0,
            borderTop: `1.5px solid ${accent}30`,
            borderLeft: `1.5px solid ${accent}30`,
            borderTopLeftRadius: "1rem",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-4 h-4 pointer-events-none transition-opacity duration-500"
          style={{
            opacity: isHovered ? 1 : 0,
            borderBottom: `1.5px solid ${accent}30`,
            borderRight: `1.5px solid ${accent}30`,
            borderBottomRightRadius: "1rem",
          }}
        />
      </Wrapper>
    </motion.div>
  );
}

/* ── Main Contact section ──────────────────────── */
export default function Contact() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  // Glow bloom on scroll
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const glowOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.3, 0.7], [0, 0.08, 0]),
    { stiffness: 60, damping: 20 }
  );
  const glowScale = useSpring(
    useTransform(scrollYProgress, [0, 0.4], [0.8, 1.2]),
    { stiffness: 60, damping: 20 }
  );

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="relative py-20 md:py-32 px-4 md:px-6 overflow-hidden"
    >
      {/* ── Background layers ── */}
      {/* Animated gradient mesh */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: glowOpacity, scale: glowScale }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-[800px] h-[80vw] max-h-[600px] rounded-full bg-accent-cyan blur-[150px]" />
      </motion.div>

      {/* Dot grid */}
      <div className="absolute inset-0 dot-grid opacity-50" />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Grid lines (faint) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,229,204,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,204,0.15) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(circle at center, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* ── Header ── */}
        <div className="text-center mb-14 md:mb-16">
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent-cyan/20 bg-accent-cyan/[0.05] backdrop-blur-sm mb-6"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.6, ease }}
          >
            <Sparkles size={14} className="text-accent-cyan" />
            <span className="font-mono text-xs text-accent-cyan/90 tracking-wider">
              Available for opportunities
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan/60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan" />
            </span>
          </motion.div>

          {/* Heading with gradient */}
          <motion.h2
            className="font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight mb-5"
            initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
            animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease }}
          >
            <span className="text-text-primary">Let&apos;s Build </span>
            <motion.span
              className="inline-block"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #00e5cc 0%, #6366f1 50%, #00e5cc 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              animate={{ backgroundPosition: ["0% center", "200% center"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              Something
            </motion.span>
          </motion.h2>

          {/* Subtext */}
          <motion.p
            className="text-text-secondary max-w-lg mx-auto text-sm md:text-base leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2, ease }}
          >
            Open to new opportunities where I can{" "}
            <span className="font-medium text-text-primary">own critical systems</span>,{" "}
            <span className="font-medium text-text-primary">mentor teams</span>, and push
            architecture forward.
          </motion.p>
        </div>

        {/* ── Primary CTA ── */}
        <motion.div
          className="flex justify-center mb-12 md:mb-14"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.25, ease }}
        >
          <a
            href="/AL_CV.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-3 bg-accent-cyan text-bg-primary font-semibold rounded-xl px-8 py-4 text-base animate-pulse-glow hover:brightness-110 transition-all"
          >
            <Download size={20} />
            Download CV
            <ArrowUpRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </motion.div>

        {/* ── Divider ── */}
        <motion.div
          className="flex items-center gap-3 mb-10 md:mb-12"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease }}
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
            or reach out directly
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
        </motion.div>

        {/* ── Contact method cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {CONTACT_METHODS.map((method, i) => (
            <ContactCard key={method.label} method={method} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
