export interface TimelineStopData {
  id: string;
  year: number;
  title: string;
  subtitle: string;
  bullets: string[];
  links?: { label: string; url: string }[];
}

export const TIMELINE_STOPS: TimelineStopData[] = [
  {
    id: "y2018",
    year: 2018,
    title: "Engineer Foundations",
    subtitle: "Discipline, reliability, systems thinking",
    bullets: [
      "Built strong fundamentals in backend + frontend delivery",
      "Learned to ship features end-to-end with ownership mindset",
      'Developed "debug-first" approach: reproduce → isolate → fix → prevent',
    ],
  },
  {
    id: "y2020",
    year: 2020,
    title: "Scale & Ownership",
    subtitle: "From tasks to systems",
    bullets: [
      "Took ownership over modules and their production behavior",
      "Improved stability and performance through systematic debugging",
      "Worked cross-team to deliver features under real constraints",
    ],
  },
  {
    id: "y2022",
    year: 2022,
    title: "Full-Stack Delivery",
    subtitle: "Product + engineering together",
    bullets: [
      "Delivered full-stack features: API + UI + data flow",
      "Focused on maintainability: clean boundaries, reusable modules",
      "Improved UX by reducing friction and making flows measurable",
    ],
  },
  {
    id: "y2023",
    year: 2023,
    title: "Team Lead Impact",
    subtitle: "Lead, align, deliver",
    bullets: [
      "Led delivery and coordination across engineers + product + design",
      "Raised engineering quality: reviews, patterns, and consistency",
      "Mentored teammates and accelerated execution without chaos",
    ],
  },
  {
    id: "y2024",
    year: 2024,
    title: "Real-Time Systems",
    subtitle: "Performance & architecture",
    bullets: [
      "Designed and implemented scalable services and integrations",
      "Optimized performance and cost: reduced latency + unnecessary work",
      "Built monitoring mindset: detect issues early, fix root causes",
    ],
  },
  {
    id: "y2025",
    year: 2025,
    title: "Alex.OS",
    subtitle: "Building products that feel impossible",
    bullets: [
      'Prototyped interactive 3D portfolio as a "proof of mindset"',
      "Combined engineering + design thinking into a memorable experience",
      "Goal: join a team that values ownership, creativity, and execution",
    ],
    links: [
      {
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/alexander-lazarovich/",
      },
      { label: "GitHub", url: "https://github.com/" },
      { label: "Email", url: "mailto:alex@example.com" },
    ],
  },
];
