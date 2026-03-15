import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

const INTERESTS = [
  { icon: "🏍️", label: "BMW S1000RR", detail: "199hp weekend therapy" },
  { icon: "🚴", label: "Cycling", detail: "80km Friday morning rides" },
  { icon: "🧱", label: "LEGO", detail: "Building cities with the twins" },
  { icon: "📷", label: "Photography", detail: "Landscapes & photo editing" },
  { icon: "🐦", label: "Birding", detail: "White Wagtails & Bulbuls" },
  { icon: "🌏", label: "Travel", detail: "Thailand, northern Israel" },
];

const springConfig = { stiffness: 100, damping: 30 };

export default function About() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Phase A (0–0.3): Header + photo slide in
  const headerOpacity = useSpring(useTransform(scrollYProgress, [0, 0.1], [0, 1]), springConfig);
  const headerX = useSpring(useTransform(scrollYProgress, [0, 0.1], [-60, 0]), springConfig);

  const photoX = useSpring(useTransform(scrollYProgress, [0.02, 0.25], [-100, 0]), springConfig);
  const photoOpacity = useSpring(useTransform(scrollYProgress, [0.02, 0.2], [0, 1]), springConfig);
  // Parallax: photo content moves slower
  const photoInnerY = useSpring(useTransform(scrollYProgress, [0, 1], [30, -30]), springConfig);

  // Phase B (0.3–0.6): Prose paragraphs
  const prose1Opacity = useSpring(useTransform(scrollYProgress, [0.25, 0.38], [0, 1]), springConfig);
  const prose1Y = useSpring(useTransform(scrollYProgress, [0.25, 0.38], [30, 0]), springConfig);
  const prose2Opacity = useSpring(useTransform(scrollYProgress, [0.35, 0.48], [0, 1]), springConfig);
  const prose2Y = useSpring(useTransform(scrollYProgress, [0.35, 0.48], [30, 0]), springConfig);
  const prose3Opacity = useSpring(useTransform(scrollYProgress, [0.45, 0.58], [0, 1]), springConfig);
  const prose3Y = useSpring(useTransform(scrollYProgress, [0.45, 0.58], [30, 0]), springConfig);

  // Phase C (0.6–1.0): Interest chips cascade
  const chipsBaseStart = 0.6;
  const chipStagger = 0.03;

  return (
    <section id="about" ref={sectionRef} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        {/* Ambient glow */}
        <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-accent-cyan/[0.03] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-[#0066ff]/[0.02] blur-[80px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-6 w-full">
          {/* Header */}
          <motion.div
            className="flex items-center gap-4 mb-12"
            style={{ opacity: headerOpacity, x: headerX }}
          >
            <h2 className="font-display font-bold text-4xl text-text-primary whitespace-nowrap">
              Beyond the Terminal
            </h2>
            <div className="section-divider flex-1" />
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Photo */}
            <motion.div
              className="relative rounded-2xl overflow-hidden aspect-[4/5]"
              style={{
                x: photoX,
                opacity: photoOpacity,
              }}
            >
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-accent-cyan/30 rounded-tl-lg z-10" />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-accent-cyan/30 rounded-br-lg z-10" />

              <motion.div
                className="w-full h-full"
                style={{ y: photoInnerY }}
              >
                <img
                  src="/img/alex-office.png"
                  alt="Alexander Lazarovich"
                  className="w-full h-full object-cover object-top scale-110"
                  loading="lazy"
                  width={480}
                  height={600}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </motion.div>

              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-primary/60 to-transparent" />
              <p className="absolute bottom-4 left-4 font-mono text-xs text-accent-cyan/70 z-10">
                Ra&apos;anana, Israel
              </p>
            </motion.div>

            {/* Content */}
            <div>
              <motion.p
                className="text-text-secondary leading-relaxed mb-6"
                style={{ opacity: prose1Opacity, y: prose1Y }}
              >
                I&apos;m a full-stack engineer based in{" "}
                <span className="font-medium text-text-primary">
                  Ra&apos;anana, Israel
                </span>
                , balancing high-traffic platforms during the week with 80km
                cycling rides on Friday mornings before the world wakes up.
              </motion.p>

              <motion.p
                className="text-text-secondary leading-relaxed mb-6"
                style={{ opacity: prose2Opacity, y: prose2Y }}
              >
                I&apos;m a father of twins who builds LEGO cities with them,
                rides a{" "}
                <span className="font-medium text-text-primary">
                  2014 BMW S1000RR
                </span>{" "}
                on weekends, and occasionally spots a White Wagtail from a park
                bench with a good cup of coffee.
              </motion.p>

              <motion.p
                className="text-text-secondary leading-relaxed mb-10"
                style={{ opacity: prose3Opacity, y: prose3Y }}
              >
                I believe the best engineering teams are built on clear
                communication, rigorous code review, and genuine curiosity. When
                I join a team, I don&apos;t just ship features — I build
                the foundations that help everyone ship faster.
              </motion.p>

              {/* Interest chips */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {INTERESTS.map((item, i) => (
                  <InterestChip
                    key={item.label}
                    item={item}
                    index={i}
                    scrollYProgress={scrollYProgress}
                    baseStart={chipsBaseStart}
                    stagger={chipStagger}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InterestChip({
  item,
  index,
  scrollYProgress,
  baseStart,
  stagger,
}: {
  item: { icon: string; label: string; detail: string };
  index: number;
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  baseStart: number;
  stagger: number;
}) {
  const start = baseStart + index * stagger;
  const end = start + 0.08;

  const opacity = useSpring(
    useTransform(scrollYProgress, [start, end], [0, 1]),
    { stiffness: 120, damping: 25 }
  );
  const y = useSpring(
    useTransform(scrollYProgress, [start, end], [20, 0]),
    { stiffness: 120, damping: 25 }
  );
  const scale = useSpring(
    useTransform(scrollYProgress, [start, end, end + 0.02], [0.9, 1.05, 1]),
    { stiffness: 200, damping: 20 }
  );

  return (
    <motion.div
      className="rounded-lg border border-border-subtle bg-bg-card/60 px-4 py-3 hover:border-accent-amber/30 hover:-translate-y-0.5 transition-all duration-300"
      style={{ opacity, y, scale }}
    >
      <span className="text-lg mr-2">{item.icon}</span>
      <span className="text-sm text-text-primary font-medium">
        {item.label}
      </span>
      <p className="text-xs text-text-dim mt-1">{item.detail}</p>
    </motion.div>
  );
}
