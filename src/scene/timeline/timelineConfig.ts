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
    subtitle: "Client: Intel | Mission-critical production environments",
    bullets: [
      "Supported mission-critical production environments",
      "Built strong troubleshooting mindset under uptime constraints",
      "Discipline, reliability, systems thinking",
    ],
  },
  {
    id: "restigo",
    year: 2022,
    title: "Restigo — Full Stack Engineer",
    subtitle: "Led team of 3 | Modernized legacy, drove CI/CD",
    bullets: [
      "Led a team of 3 developers; drove PR/code review routines",
      "Modernized legacy UI (jQuery → React), executed data migrations",
      "Designed new SQL schemas for product features",
    ],
  },
  {
    id: "triolla",
    year: 2023,
    title: "Triolla — Full Stack Engineer",
    subtitle: "Client systems across frontend & backend",
    bullets: [
      "Delivered client systems with TypeScript/JavaScript",
      "React, Node/Nest/Express, Laravel — REST/SOAP APIs",
      "Modernized deployments with Docker/AWS",
    ],
  },
  {
    id: "the5ers",
    year: 2024,
    title: "The5ers — Full Stack Engineer",
    subtitle: "Nx platform team | 100K+ users, 70K active",
    bullets: [
      "Core engineer: 20+ microservices, 100+ shared libs in Nx monorepo",
      "Owned central dashboards; smart polling, Redis cache (30–40% cost reduction)",
      "Contest Leaderboard/Podium: 16+ UX states, MUI foundation, React Query",
    ],
    links: [
      {
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/alexander-lazarovich/",
      },
      { label: "Email", url: "mailto:alex@azarovichh@gmail.com" },
    ],
  },
];
