import Reveal from "./Reveal";

const INTERESTS = [
  { icon: "🏍️", label: "BMW S1000RR", detail: "199hp weekend therapy" },
  { icon: "🚴", label: "Cycling", detail: "80km Friday morning rides" },
  { icon: "🧱", label: "LEGO", detail: "Building cities with the twins" },
  { icon: "📷", label: "Photography", detail: "Landscapes & photo editing" },
  { icon: "🐦", label: "Birding", detail: "White Wagtails & Bulbuls" },
  { icon: "🌏", label: "Travel", detail: "Thailand, northern Israel" },
];

export default function About() {
  return (
    <section id="about" className="relative py-16 md:py-24 px-4 md:px-6 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[20%] right-[10%] w-[50vw] max-w-[400px] h-[50vw] max-h-[400px] rounded-full bg-accent-cyan/[0.03] blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <Reveal>
          <div className="flex items-center gap-4 mb-10 md:mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-text-primary whitespace-nowrap">
              Beyond the Terminal
            </h2>
            <div className="section-divider flex-1" />
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Photo */}
          <Reveal>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] md:aspect-[4/5]">
              <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-accent-cyan/30 rounded-tl-lg z-10" />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-accent-cyan/30 rounded-br-lg z-10" />
              <img
                src="/img/alex-office.png"
                alt="Alexander Lazarovich"
                className="w-full h-full object-cover object-top"
                loading="lazy"
                width={480}
                height={600}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-primary/60 to-transparent" />
              <p className="absolute bottom-3 left-3 md:bottom-4 md:left-4 font-mono text-xs text-accent-cyan/70 z-10">
                Ra&apos;anana, Israel
              </p>
            </div>
          </Reveal>

          {/* Content */}
          <div>
            <Reveal delay={0.05}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-5 md:mb-6">
                I&apos;m a full-stack engineer based in{" "}
                <span className="font-medium text-text-primary">Ra&apos;anana, Israel</span>,
                balancing high-traffic platforms during the week with 80km cycling rides on Friday mornings.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-5 md:mb-6">
                Father of twins who builds LEGO cities with them, rides a{" "}
                <span className="font-medium text-text-primary">2014 BMW S1000RR</span>{" "}
                on weekends, and spots White Wagtails from a park bench with good coffee.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="text-sm md:text-base text-text-secondary leading-relaxed mb-8 md:mb-10">
                I believe the best teams are built on clear communication, rigorous code review,
                and genuine curiosity. When I join a team, I don&apos;t just ship features —
                I build foundations that help everyone ship faster.
              </p>
            </Reveal>

            {/* Interest chips */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3">
              {INTERESTS.map((item, i) => (
                <Reveal key={item.label} delay={0.2 + i * 0.04}>
                  <div className="rounded-lg border border-border-subtle bg-bg-card/60 px-3 md:px-4 py-2.5 md:py-3 hover:border-accent-amber/30 hover:-translate-y-0.5 transition-all duration-300">
                    <span className="text-base md:text-lg mr-1.5">{item.icon}</span>
                    <span className="text-xs md:text-sm text-text-primary font-medium">{item.label}</span>
                    <p className="text-[10px] md:text-xs text-text-dim mt-0.5">{item.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
