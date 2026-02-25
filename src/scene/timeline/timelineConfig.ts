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
    id: "asml",
    year: 2018,
    title: "ASML — Field Service Engineer",
    subtitle: "Client: Intel | 2018 – 2022",
    bullets: [
      "Supported mission-critical production environments at Intel fabs",
      "Built strong troubleshooting mindset under strict uptime constraints",
    ],
  },
  {
    id: "restigo",
    year: 2022,
    title: "Restigo — Full Stack Engineer",
    subtitle: "Led team of 3 | 2022 – 2023",
    bullets: [
      "Led a team of 3 developers; drove PR/code review routines and CI/CD adoption",
      "Modernized legacy UI (jQuery → React), executed data migrations",
      "Designed new SQL schemas for product features",
    ],
  },
  {
    id: "triolla",
    year: 2023,
    title: "Triolla — Full Stack Engineer",
    subtitle: "Client systems across frontend & backend | 2023 – 2024",
    bullets: [
      "Delivered client systems using TypeScript/JavaScript (React, Node/Nest/Express, Laravel)",
      "Integrated REST/SOAP APIs; modernized deployments with Docker/AWS",
    ],
  },
  {
    id: "the5ers",
    year: 2024,
    title: "The5ers — Full Stack Engineer",
    subtitle: "Nx platform team | 100K+ users, 70K active | 2024 – Present",
    bullets: [
      "20+ microservices, 100+ shared libs in Nx monorepo — owned 3 end-to-end",
      "Central dashboards: smart polling + Redis cache → 30–40% API cost reduction",
      "Contest Leaderboard/Podium: 16+ UX states, mobile/desktop, dark/light modes",
      "Standardized React Query company-wide; built MUI foundation with Storybook docs",
      "Architecture sessions for 6 teams (~18–24 devs) on standards and best practices",
    ],
    links: [
      {
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/alexander-lazarovich/",
      },
      { label: "Email", url: "mailto:alex.lazarovichh@gmail.com" },
    ],
  },
];
