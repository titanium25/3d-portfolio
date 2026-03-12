export interface TimelineStopData {
  id: string;
  year: number;
  title: string;
  subtitle: string;
  bullets: string[];
  /** Grouped skill chips shown in the cinematic overlay. */
  skills?: string[];
  image?: string;
  imageCaption?: string;
  /** Optional override for the Journey tab inline photo (falls back to `image`). */
  journeyImage?: string;
  journeyCaption?: string;
  /** Multiple Journey tab photos — when set, overrides single journeyImage. */
  journeyImages?: Array<{ src: string; caption: string; objectPosition?: string }>;
  /** One–two sentence context about the company — helps HR understand the domain. */
  companyContext?: string;
  /** Company logo path (shown as badge next to company name). */
  logo?: string;
  /** Italic narrative blurb shown beneath the Journey entry — the "so what" of each role. */
  narrativeNote?: string;
}

export const TIMELINE_STOPS: TimelineStopData[] = [
  {
    id: "asml",
    year: 2018,
    title: "ASML — Field Service Engineer",
    subtitle: "Full-time · Mar 2018 – Apr 2022 · 4 yrs 2 mos · Worldwide",
    companyContext:
      "ASML (Netherlands, ~44K employees) is the world's sole manufacturer of EUV lithography machines — the equipment Intel, TSMC, and Samsung depend on to print the world's most advanced microchips. Without ASML, modern semiconductors at sub-7nm nodes simply cannot be produced.",
    bullets: [
      "Deployed across Intel fabs worldwide — Oregon (USA), Leixlip (Ireland), Kiryat Gat (Israel) — supporting mission-critical lithography systems",
      "Led & monitored high-end processor production at the Lithographic phase; crucial team member in manufacturing uptime",
      "Managed high-volume Hardware & Software troubleshooting using dedicated analysis programs under strict fab uptime constraints",
      "Responsible for UNIX/Linux System Administration; ran MATLAB data analysis on machine performance data",
      "Facilitated installation, testing, upgrade, and migration of new software on EUV/DUV lithography machines",
      "Trained new team members and experienced engineers on lithographic systems",
    ],
    skills: [
      "Linux / Unix",
      "MATLAB",
      "System Administration",
      "EUV / DUV Lithography",
      "Hardware Troubleshooting",
      "Root Cause Analysis",
      "Semiconductor Manufacturing",
      "Technical Training",
    ],
    logo: "/img/asml-logo.png",
    image: "/img/asml-cleanroom.png",
    imageCaption: "Intel fab · Kiryat Gat, Israel · 2020",
    narrativeNote:
      'The discipline of debugging <span>million-dollar lithography machines under fab-uptime pressure</span> shaped an engineering mindset that carries into every system I build today — <span>methodical root-cause analysis</span>, documentation-first, and zero tolerance for flaky systems.',
  },
  {
    id: "restigo",
    year: 2022,
    title: "Restigo — Full Stack Developer → Team Lead",
    subtitle: "Full-time · Apr 2022 – Jun 2023 · 1 yr 3 mos · Herzliya, Israel · On-site",
    companyContext:
      "Restigo is an Israeli B2B SaaS platform for the hospitality industry — an AI-powered back-office suite covering shift scheduling, procurement, inventory, and labor cost management. Clients include Burger King, Papa Johns, and Shake Shack.",
    bullets: [
      "Promoted to Development Team Lead (Jan–Jun 2023) — managed 3 developers hands-on, owning full-stack delivery end-to-end",
      "Introduced CI/CD pipelines, pull request culture, code reviews, and daily standups — raised engineering process quality",
      "Developed client-side apps with React and server-side solutions with PHP & Laravel; optimized MySQL performance and scalability",
      "Integrated third-party APIs — supplier APIs, registries, and accounting systems — ensuring seamless data exchange",
      "Collaborated directly with clients on UX feedback loops to improve product quality and user experience",
    ],
    skills: [
      "React",
      "TypeScript",
      "PHP",
      "Laravel",
      "MySQL",
      "Node.js",
      "REST APIs",
      "CI/CD",
      "Git",
      "Team Leadership",
      "Agile / Scrum",
    ],
    logo: "/img/restigo-logo.png",
    image: "/img/restigo-office.png",
    imageCaption: "Restigo HQ · Herzliya, Israel · 2022",
    journeyImages: [
      { src: "/img/restigo-office.png", caption: "Restigo HQ · Herzliya, Israel · 2022" },
      { src: "/img/restigo-working.png", caption: "Late-night coding session · Herzliya, 2022" },
    ],
    narrativeNote:
      'First software role — picked a <span>high-velocity SaaS startup</span> powering <span>Burger King, Shake Shack, and Papa Johns</span> kitchens. Went from IC to <span>Team Lead in 9 months</span> by building the engineering culture nobody asked for but everyone needed — CI/CD pipelines, code reviews, and a ship-daily mindset.',
  },
  {
    id: "triolla",
    year: 2023,
    title: "Triolla — Full Stack Developer",
    subtitle: "Full-time · Jun 2023 – Nov 2024 · 1 yr 6 mos · Raanana, Israel · Hybrid",
    companyContext:
      "Triolla (acquired by SQLink, one of Israel's Big Five integrators) is a software development studio delivering end-to-end product engineering for startups and scale-ups — full-stack systems, UX/UI, and AI platforms across fintech, healthtech, and enterprise verticals.",
    bullets: [
      "Built AI chat systems, a complex insurance platform (8+ API integrations), and mobile geolocation & tracking apps",
      "Tech stack: PHP Laravel, Node.js, NestJS, React, Vue, MySQL, MongoDB, Redis, Redux, AWS — chosen per project needs",
      "Developed and maintained API connections across multiple client companies for reliable data exchange",
      "Partnered closely with Figma designers, PMs, and clients to deliver solutions that exceeded expectations",
      "Led front-end performance work with strong UX focus, especially for mobile-based applications",
    ],
    skills: [
      "React",
      "Vue.js",
      "TypeScript",
      "Node.js",
      "NestJS",
      "PHP",
      "Laravel",
      "MySQL",
      "MongoDB",
      "Redis",
      "Redux",
      "AWS",
      "Figma",
    ],
    logo: "/img/triolla-logo.png",
    image: "/img/triolla-office.png",
    imageCaption: "Triolla HQ · Raanana, Israel",
    journeyImages: [
      { src: "/img/alex-teaching.png", caption: "Architecture training session · Triolla, 2023" },
      { src: "/img/triolla-srlp.png", caption: "Presenting Smart Referral Link Platform (SRLP) · Triolla, 2023" },
    ],
    narrativeNote:
      'A <span>product studio under SQLink (2,800+ engineers)</span> building for <span>JFrog, Playtika, and IronSource</span>-caliber clients — new domain, new stack, new deadline every quarter. The fastest path to a <span>battle-tested full-stack generalist</span> is shipping 8 products in 18 months for clients who don\'t tolerate learning curves.',
  },
  {
    id: "the5ers",
    year: 2024,
    title: "The5ers — Full Stack Developer",
    subtitle: "Full-time · Nov 2024 – Present · 1 yr 5 mos · Raanana, Israel · On-site",
    companyContext:
      "The5ers is a global proprietary trading firm that funds talented traders with real capital — no personal risk. The platform serves 100K+ registered traders worldwide with evaluation programs, live funded accounts, and real-time performance dashboards.",
    bullets: [
      "Core engineer on the platform team — building the trading system at scale (integrations, microservices, dashboards)",
      "Worked across 20+ microservices and 100+ shared libraries in an Nx monorepo",
      "Owned central dashboards for 100K+ users (70K active); smart polling + Redis cache → 30–40% API cost reduction",
      "Introduced and standardized React Query company-wide (patterns, cache strategy, invalidation rules, defaults)",
      "Implemented MUI component foundation and Storybook documentation aligned to Figma design system",
      "Led internal training for 6 teams (~18–24 devs) on frontend architecture and standards",
    ],
    skills: [
      "React",
      "TypeScript",
      "React Query",
      "MUI",
      "Nx Monorepo",
      "Storybook",
      "Node.js",
      "NestJS",
      "Redis",
      "Microservices",
      "Figma",
      "Frontend Architecture",
    ],
    logo: "/img/the5ers-logo.png",
    image: "/img/the5ers-hq.png",
    imageCaption: "The5ers HQ · Raanana — yes, Meny visited the office",
    journeyImages: [
      { src: "/img/the5ers-hq.png", caption: "The5ers HQ · Raanana — yes, Meny visited the office", objectPosition: "center 30%" },
      { src: "/img/alex-office.png", caption: "Office candid · The5ers Raanana", objectPosition: "center 30%" },
      { src: "/img/the5ers-dashboard.png", caption: "Dashboard I built — funded account view, scale-up milestones, balance chart" },
      { src: "/img/the5ers-trading.png", caption: "The5ers trading platform · 2024" },
    ],
    narrativeNote:
      'Real capital, real traders, <span>$4M funded accounts</span> — a slow dashboard isn\'t a UX complaint, it\'s someone\'s livelihood on the line. Scaling for <span>100K+ active traders</span> proved that <span>performance is the product</span> — and standardizing architecture across 6 teams and 20+ microservices is harder than any algorithm.',
  },
];
