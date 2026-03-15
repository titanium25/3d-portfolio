export interface Role {
  company: string;
  title: string;
  period: string;
  context: string;
  bullets: string[];
  tech: string[];
}

export const ROLES: Role[] = [
  {
    company: "The5ers",
    title: "Full Stack Engineer",
    period: "2024 - Present",
    context:
      "Core engineer in platform team owning core integrations and dashboards in an Nx-based microservices platform at scale.",
    bullets: [
      "Worked across 20+ microservices and 100+ shared libraries in an Nx monorepo; co-developed and owned at least 3 microservices end-to-end (design → implementation → production)",
      "Owned central dashboards for 100K+ users (70K active); implemented smart polling (active view only) aligned to backend sync (30s) to reduce load",
      "Delivered a complex Contest Leaderboard/Podium component with 16+ UX/UI states (contest lifecycle × user status), responsive mobile/desktop layouts, dark/light modes, and design-system compliance",
      "Introduced and standardized React Query company-wide (query patterns, cache strategy, invalidation rules, defaults), improving consistency and reducing boilerplate across frontend teams",
      "Implemented the MUI foundation: theme + tokens, component patterns, and Storybook-based documentation to align engineering with Figma and accelerate delivery across teams",
      "Trade Score scalability: eliminated production rate-limit failures and reduced external market-data API cost to 30–40% by implementing a Redis cache layer for candle data (cache-first retrieval during score calculations)",
      "Delivered architecture/training sessions for 6 teams (~18–24 developers) on company standards (structure, rules, theming, i18n, UX states) and best practices",
      "Frequently collaborated with international teams across time zones; stepped in outside regular hours during critical efforts",
    ],
    tech: [
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
    ],
  },
  {
    company: "Triolla",
    title: "Full Stack Engineer",
    period: "2023 - 2024",
    context:
      "Delivered client systems across frontend and backend using TypeScript/JavaScript (React, Node/Nest/Express, Laravel), integrating REST/SOAP APIs and modernizing deployments with Docker/AWS where applicable.",
    bullets: [
      "Delivered client systems across frontend and backend using TypeScript/JavaScript (React, Node/Nest/Express, Laravel), integrating REST/SOAP APIs and modernizing deployments with Docker/AWS where applicable",
    ],
    tech: [
      "React",
      "TypeScript",
      "Node.js",
      "NestJS",
      "PHP",
      "Laravel",
      "Docker",
      "AWS",
      "REST APIs",
      "SOAP APIs",
    ],
  },
  {
    company: "Restigo",
    title: "Full Stack Engineer",
    period: "2022 - 2023",
    context:
      "Led a team of 3 developers; drove PR/code review routines and CI/CD adoption to improve delivery quality.",
    bullets: [
      "Led a team of 3 developers; drove PR/code review routines and CI/CD adoption to improve delivery quality",
      "Modernized legacy UI (jQuery → React), executed data migrations, and designed new SQL schemas for product features",
    ],
    tech: [
      "React",
      "TypeScript",
      "PHP",
      "Laravel",
      "MySQL",
      "jQuery",
      "CI/CD",
      "Git",
    ],
  },
  {
    company: "ASML",
    title: "Field Service Engineer (Client: Intel)",
    period: "2018 - 2022",
    context:
      "Supported mission-critical production environments; built a strong troubleshooting mindset under uptime constraints.",
    bullets: [
      "Supported mission-critical production environments; built a strong troubleshooting mindset under uptime constraints",
    ],
    tech: [
      "Linux / Unix",
      "MATLAB",
      "System Administration",
      "EUV / DUV Lithography",
      "Hardware Troubleshooting",
    ],
  },
];

export const SKILLS: Record<string, { techs: string[]; description: string }> =
  {
    "AI Tools": {
      techs: [
        "Cursor",
        "Claude Code (agent workflows for planning, refactors, code review and tests)",
      ],
      description: "AI-assisted development workflows",
    },
    Frontend: {
      techs: [
        "React",
        "TypeScript",
        "React Query (TanStack)",
        "MUI",
        "AntD",
        "Storybook",
        "i18n",
        "performance patterns",
      ],
      description: "Modern React ecosystem and UI engineering",
    },
    Backend: {
      techs: [
        "Node.js",
        "NestJS",
        "REST",
        "Redis",
        "BullMQ",
        "schedulers/consumers",
        "microservices",
        "Nx",
      ],
      description: "Server-side TypeScript and distributed systems",
    },
    "Data/Infra/Obs": {
      techs: [
        "MongoDB",
        "SQL",
        "Docker",
        "GitHub Actions CI/CD",
        "Grafana/Prometheus",
        "Sentry",
        "Coralogix",
      ],
      description: "Data storage, infrastructure, and observability",
    },
    Quality: {
      techs: ["SOLID", "clean architecture", "Jest", "Agile/Scrum"],
      description: "Engineering practices and methodology",
    },
  };

export const CONTACT = {
  email: "alex.lazarovichh@gmail.com",
  phone: "054-4567302",
  linkedin: "alexander-lazarovich",
  location: "Ra'anana, Israel",
};

export const SUMMARY =
  "Senior Full-Stack Engineer (TypeScript) building Nx microservices + high-traffic React dashboards for a trading platform (100K+ users / 70K active). Strong problem solver, experienced collaborating with international teams across time zones.";

export const EDUCATION =
  "B.Sc. Electrical & Electronics Engineering — Ariel University";
