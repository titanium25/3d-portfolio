import { Suspense, lazy, useRef, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Download } from "lucide-react";

const HeroScene = lazy(() => import("../three/HeroScene"));
const Hero3DButton = lazy(() => import("./Hero3DButton"));

const METRICS = [
  { value: "100K+", label: "users served" },
  { value: "20+", label: "microservices" },
  { value: "6", label: "teams trained" },
  { value: "3", label: "services owned E2E" },
];

const springConfig = { stiffness: 100, damping: 30 };
const ease = [0.22, 1, 0.36, 1] as const;

/* ── Interactive dot grid canvas ────────────────── */
function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const mouseRef = useRef<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });

  const SPACING = 28;
  const BASE_OPACITY = 0.12;
  const HOVER_RADIUS = 160;
  const HOVER_BOOST = 0.55;
  const DOT_RADIUS = 1.0;
  const DOT_RADIUS_BOOST = 2.5;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const { x: mx, y: my } = mouseRef.current;
    const cols = Math.ceil(w / SPACING);
    const rows = Math.ceil(h / SPACING);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * SPACING + SPACING / 2;
        const y = j * SPACING + SPACING / 2;

        let factor = 0;
        if (mx !== null && my !== null) {
          const dx = x - mx;
          const dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < HOVER_RADIUS) {
            factor = (1 - dist / HOVER_RADIUS) ** 2;
          }
        }

        const opacity = BASE_OPACITY + factor * HOVER_BOOST;
        const radius = DOT_RADIUS + factor * DOT_RADIUS_BOOST;

        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 229, 204, ${opacity.toFixed(3)})`;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    frameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleLeave = () => {
      mouseRef.current = { x: null, y: null };
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleLeave);
    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
}

/* ── Hero section ───────────────────────────────── */
export default function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Scroll-driven pullback
  const contentY = useSpring(
    useTransform(scrollYProgress, [0.3, 1], [0, -80]),
    springConfig
  );
  const contentScale = useSpring(
    useTransform(scrollYProgress, [0.3, 1], [1, 0.95]),
    springConfig
  );
  const contentOpacity = useSpring(
    useTransform(scrollYProgress, [0.35, 0.85], [1, 0]),
    springConfig
  );
  const canvasOpacity = useSpring(
    useTransform(scrollYProgress, [0.3, 0.8], [1, 0]),
    springConfig
  );
  const glowScale = useSpring(
    useTransform(scrollYProgress, [0, 0.3, 0.8], [1, 1.15, 0.8]),
    springConfig
  );
  const scrollHintOpacity = useTransform(
    scrollYProgress,
    [0, 0.1],
    [1, 0]
  );

  return (
    <section ref={sectionRef} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* ── Layer 1: Interactive dot grid ── */}
        <DotGrid />

        {/* ── Layer 2: Ambient glow orbs ── */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{ scale: glowScale }}
        >
          <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-accent-cyan/[0.06] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-accent-cyan/[0.04] blur-[100px]" />
          <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-[#0066ff]/[0.03] blur-[80px]" />
        </motion.div>

        {/* ── Layer 3: Three.js canvas ── */}
        <motion.div
          className="absolute inset-0 z-[2]"
          style={{ opacity: canvasOpacity }}
        >
          <Suspense
            fallback={
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 50% 40% at 60% 50%, rgb(0 229 204 / 0.06) 0%, transparent 70%)",
                }}
              />
            }
          >
            <HeroScene />
          </Suspense>
        </motion.div>

        {/* ── Layer 4: Scanlines ── */}
        <div className="absolute inset-0 scanlines pointer-events-none z-[3]" />

        {/* ── Layer 5: Content ── */}
        <motion.div
          className="relative z-10 h-full flex items-center"
          style={{
            y: contentY,
            scale: contentScale,
            opacity: contentOpacity,
          }}
        >
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="max-w-xl">
              {/* Greeting */}
                <motion.p
                  className="font-mono text-sm text-accent-cyan tracking-wider mb-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease }}
                >
                  Hi, my name is
                </motion.p>

                {/* Name — gradient text with shimmer */}
                <motion.h1
                  className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mb-4"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.25, ease }}
                >
                  <span
                    className="inline-block"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #e8eaed 0%, #e8eaed 40%, #00e5cc 70%, #e8eaed 100%)",
                      backgroundSize: "200% auto",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      animation: "shimmer 6s ease-in-out infinite",
                    }}
                  >
                    Alexander
                  </span>
                  <br />
                  <span
                    className="inline-block"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #e8eaed 0%, #e8eaed 40%, #00e5cc 70%, #e8eaed 100%)",
                      backgroundSize: "200% auto",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      animation: "shimmer 6s ease-in-out infinite 0.5s",
                    }}
                  >
                    Lazarovich
                  </span>
                  <span className="text-accent-cyan">.</span>
                </motion.h1>

                {/* Role */}
                <motion.p
                  className="font-display text-xl sm:text-2xl text-text-secondary mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.45, ease }}
                >
                  Senior Full-Stack Engineer
                </motion.p>

                {/* One-liner */}
                <motion.p
                  className="text-text-secondary leading-relaxed mb-10 max-w-md"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6, ease }}
                >
                  <span className="font-medium text-text-primary">100K+ users</span>
                  {" · "}
                  <span className="font-medium text-text-primary">20+ microservices</span>
                  {" · "}
                  TypeScript end-to-end.
                </motion.p>

                {/* CTAs — Download CV + 3D Explore button inline */}
                <motion.div
                  className="flex flex-wrap gap-4 items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.75, ease }}
                >
                  <a
                    href="/AL_CV.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-accent-cyan text-bg-primary font-semibold rounded-lg px-6 py-3 animate-pulse-glow hover:brightness-110 transition-all h-12"
                  >
                    <Download size={18} />
                    Download CV
                  </a>
                  <Suspense
                    fallback={
                      <a
                        href="/explore"
                        className="flex items-center gap-2 border border-accent-cyan/25 text-accent-cyan rounded-xl px-5 py-3 text-sm font-semibold h-12"
                      >
                        Explore 3D World →
                      </a>
                    }
                  >
                    <Hero3DButton />
                  </Suspense>
                </motion.div>
              </div>

            {/* Proof bar */}
            <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl">
              {METRICS.map((m, i) => (
                <motion.div
                  key={m.label}
                  className="group"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.9 + i * 0.1,
                    ease,
                  }}
                >
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-text-primary">
                    {m.value}
                  </p>
                  <div className="relative h-px mt-2 mb-2 overflow-hidden">
                    <div className="absolute inset-0 bg-accent-cyan/15" />
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-accent-cyan/60"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{
                        duration: 1.2,
                        delay: 1.2 + i * 0.15,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-wider text-text-dim">
                    {m.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          style={{ opacity: scrollHintOpacity }}
        >
          <span className="font-mono text-xs text-text-dim">Scroll</span>
          <div className="w-px h-6 animate-scroll-bounce bg-gradient-to-b from-accent-cyan/60 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
