import { TIMELINE_STOPS } from "../scene/timeline/timelineConfig";

let panelEl: HTMLDivElement | null = null;
let isOpen = false;

// ── Fonts ────────────────────────────────────────────────────────────────────

function loadFont(): void {
  if (document.getElementById("cv-font")) return;
  const link = document.createElement("link");
  link.id = "cv-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

// ── Styles ───────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("cv-styles")) return;
  const s = document.createElement("style");
  s.id = "cv-styles";
  s.textContent = `
    /* ── Shared font ── */
    #cv-overlay, #cv-btn { font-family: 'Inter', system-ui, -apple-system, sans-serif; }

    /* ── Button ── */
    #cv-btn {
      position: fixed;
      top: 1.1rem;
      right: 1.25rem;
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.48rem 1rem 0.48rem 0.75rem;
      background: rgba(0,229,204,0.08);
      border: 1px solid rgba(0,229,204,0.35);
      border-radius: 24px;
      color: #00e5cc;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.03em;
      box-shadow: 0 0 16px rgba(0,229,204,0.1);
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.15s;
      animation: cvBtnPulse 3.5s ease-in-out infinite;
    }
    #cv-btn:hover {
      background: rgba(0,229,204,0.16);
      border-color: rgba(0,229,204,0.65);
      box-shadow: 0 0 24px rgba(0,229,204,0.22);
      transform: translateY(-1px);
      animation: none;
    }
    #cv-btn:active { transform: translateY(0) scale(0.97); animation: none; }
    @keyframes cvBtnPulse {
      0%, 100% { box-shadow: 0 0 12px rgba(0,229,204,0.1); }
      50%       { box-shadow: 0 0 22px rgba(0,229,204,0.28); }
    }

    /* ── Overlay ── */
    #cv-overlay {
      position: fixed;
      inset: 0;
      z-index: 2001;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(4,6,16,0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 1.25rem 1rem;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    #cv-overlay.cv-visible { opacity: 1; }

    /* ── Panel shell ── */
    #cv-panel {
      position: relative;
      display: flex;
      flex-direction: column;
      background: linear-gradient(160deg, #0d1117 0%, #111827 60%, #0a0e1a 100%);
      border: 1px solid rgba(0,229,204,0.14);
      border-radius: 20px;
      max-width: 640px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      color: #fff;
      box-shadow:
        0 32px 80px rgba(0,0,0,0.75),
        0 0 0 1px rgba(0,229,204,0.05),
        inset 0 1px 0 rgba(255,255,255,0.04);
      transform: scale(0.96) translateY(16px);
      transition: transform 0.38s cubic-bezier(0.16,1,0.3,1), opacity 0.38s ease;
      opacity: 0;
    }
    #cv-overlay.cv-visible #cv-panel {
      transform: scale(1) translateY(0);
      opacity: 1;
    }

    /* ── Top bar — never scrolls ── */
    #cv-topbar {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      padding: 0.75rem 0.85rem 0 0.85rem;
      background: linear-gradient(to bottom, #0d1117 60%, transparent);
      position: relative;
      z-index: 10;
    }
    #cv-close {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.28rem 0.6rem 0.28rem 0.45rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      color: rgba(255,255,255,0.45);
      font-size: 0.68rem;
      font-weight: 500;
      font-family: 'Inter', system-ui, sans-serif;
      cursor: pointer;
      transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
    }
    #cv-close:hover {
      background: rgba(0,229,204,0.1);
      border-color: rgba(0,229,204,0.35);
      color: #fff;
      transform: scale(1.03);
    }
    #cv-close .cv-esc {
      padding: 1px 5px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.15);
      border-bottom: 2px solid rgba(255,255,255,0.22);
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      font-family: system-ui, monospace;
      color: rgba(255,255,255,0.6);
      line-height: 1.4;
    }

    /* ── Scrollable content ── */
    #cv-scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,229,204,0.15) transparent;
    }
    #cv-scroll::-webkit-scrollbar { width: 4px; }
    #cv-scroll::-webkit-scrollbar-track { background: transparent; }
    #cv-scroll::-webkit-scrollbar-thumb { background: rgba(0,229,204,0.18); border-radius: 4px; }

    /* ── Hero ── */
    #cv-hero {
      position: relative;
      padding: 0 2rem 1.8rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
    }
    #cv-hero-cover {
      position: absolute;
      inset: 0;
      background-image: url('/img/alex-office.png');
      background-size: cover;
      background-position: center 30%;
      opacity: 0.08;
      pointer-events: none;
    }
    #cv-hero-cover-fade {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(13,17,23,0) 30%, rgba(13,17,23,0.95) 100%);
      pointer-events: none;
    }
    #cv-hero-row {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 1.2rem;
      padding-top: 0.5rem;
    }
    #cv-avatar {
      flex-shrink: 0;
      width: 78px;
      height: 78px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center top;
      border: 2.5px solid rgba(0,229,204,0.45);
      box-shadow: 0 0 20px rgba(0,229,204,0.2), 0 4px 16px rgba(0,0,0,0.5);
    }
    #cv-hero-info { flex: 1; min-width: 0; }
    #cv-name {
      font-size: 1.55rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #fff;
      margin: 0 0 0.15rem;
      line-height: 1.1;
    }
    #cv-title {
      font-size: 0.76rem;
      font-weight: 600;
      color: #00e5cc;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 0.8rem;
    }
    #cv-summary {
      font-size: 0.8rem;
      line-height: 1.68;
      color: rgba(255,255,255,0.55);
      margin: 0 0 1rem;
    }
    #cv-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      align-items: center;
    }
    .cv-action-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.36rem 0.8rem;
      border-radius: 8px;
      font-size: 0.72rem;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
      border: 1px solid;
      white-space: nowrap;
    }
    .cv-action-link.secondary {
      color: rgba(255,255,255,0.5);
      border-color: rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.03);
    }
    .cv-action-link.secondary:hover {
      color: #fff;
      border-color: rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.07);
    }
    .cv-action-link.primary {
      color: #00e5cc;
      border-color: rgba(0,229,204,0.35);
      background: rgba(0,229,204,0.08);
      font-weight: 700;
    }
    .cv-action-link.primary:hover {
      background: rgba(0,229,204,0.18);
      border-color: rgba(0,229,204,0.65);
      box-shadow: 0 0 12px rgba(0,229,204,0.2);
    }

    /* ── Sections ── */
    .cv-section { padding: 1.4rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .cv-section:last-child { border-bottom: none; }
    .cv-section-label {
      font-size: 0.59rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.5);
      margin: 0 0 0.9rem;
    }

    /* ── Stack chips ── */
    .cv-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .cv-chip {
      padding: 0.22rem 0.65rem;
      background: rgba(0,229,204,0.06);
      border: 1px solid rgba(0,229,204,0.18);
      border-radius: 20px;
      font-size: 0.68rem;
      font-weight: 500;
      color: rgba(255,255,255,0.75);
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .cv-chip:hover { background: rgba(0,229,204,0.13); border-color: rgba(0,229,204,0.4); color: #fff; }

    /* ── Skill categories grid ── */
    .cv-skills-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.1rem 1.4rem;
    }
    .cv-skill-group {}
    .cv-skill-group-label {
      font-size: 0.57rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
      margin: 0 0 0.45rem;
    }
    .cv-skill-group-chips { display: flex; flex-wrap: wrap; gap: 0.28rem; }
    .cv-skill-group-chips span {
      padding: 0.2rem 0.58rem;
      background: rgba(0,229,204,0.05);
      border: 1px solid rgba(0,229,204,0.16);
      border-radius: 20px;
      font-size: 0.66rem;
      font-weight: 500;
      color: rgba(255,255,255,0.72);
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .cv-skill-group-chips span:hover {
      background: rgba(0,229,204,0.12); border-color: rgba(0,229,204,0.38); color: #fff;
    }
    /* Leadership / soft row spans full width */
    .cv-skill-group.full { grid-column: 1 / -1; }

    /* ── Experience ── */
    .cv-exp-list { display: flex; flex-direction: column; gap: 0; }
    .cv-exp-entry {
      display: grid;
      grid-template-columns: 3px 1fr;
      gap: 0 1rem;
      padding-bottom: 1.75rem;
    }
    .cv-exp-entry:last-child { padding-bottom: 0; }
    .cv-exp-line {
      width: 3px;
      background: rgba(255,255,255,0.07);
      border-radius: 3px;
      position: relative;
      margin-top: 5px;
    }
    .cv-exp-line.active { background: #00e5cc; box-shadow: 0 0 8px rgba(0,229,204,0.45); }
    .cv-exp-line::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15);
      background: #0d1117;
    }
    .cv-exp-line.active::before { border-color: #00e5cc; box-shadow: 0 0 8px rgba(0,229,204,0.55); }

    .cv-exp-body {}
    .cv-exp-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.28rem;
    }
    .cv-exp-period {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
    }
    .cv-exp-period.active { color: #00e5cc; }

    /* Logo pill — white background so colored logos show correctly */
    .cv-exp-logo-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 5px;
      padding: 2px 7px;
      height: 22px;
    }
    .cv-exp-logo {
      height: 14px;
      width: auto;
      max-width: 68px;
      object-fit: contain;
    }

    .cv-exp-title { font-size: 0.96rem; font-weight: 700; color: #fff; margin: 0 0 0.12rem; line-height: 1.3; }
    .cv-exp-sub { font-size: 0.7rem; color: rgba(255,255,255,0.36); margin: 0 0 0.65rem; }
    .cv-exp-bullets {
      list-style: none; padding: 0; margin: 0 0 0.7rem;
      display: flex; flex-direction: column; gap: 0.22rem;
    }
    .cv-exp-bullets li {
      font-size: 0.76rem; color: rgba(255,255,255,0.6);
      padding-left: 1rem; position: relative; line-height: 1.58;
    }
    .cv-exp-bullets li::before {
      content: '▸'; position: absolute; left: 0;
      color: rgba(0,229,204,0.55); font-size: 0.65rem; top: 0.08em;
    }
    .cv-exp-skills { display: flex; flex-wrap: wrap; gap: 0.28rem; }
    .cv-exp-skill {
      padding: 0.15rem 0.48rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px;
      font-size: 0.63rem;
      color: rgba(255,255,255,0.46);
    }

    /* ── Education ── */
    .cv-edu-row {
      display: grid;
      grid-template-columns: 3px 1fr;
      gap: 0 1rem;
    }
    .cv-edu-line {
      width: 3px;
      background: rgba(255,255,255,0.07);
      border-radius: 3px;
      position: relative;
      margin-top: 5px;
    }
    .cv-edu-line::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 10px; height: 10px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15);
      background: #0d1117;
    }
    #cv-edu-title { font-size: 0.93rem; font-weight: 700; color: #fff; margin: 0 0 0.12rem; }
    #cv-edu-sub { font-size: 0.74rem; color: rgba(255,255,255,0.38); margin: 0; }

    /* ── Footer CTA ── */
    #cv-footer {
      flex-shrink: 0;
      padding: 1.1rem 2rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      background: rgba(0,229,204,0.025);
      border-top: 1px solid rgba(0,229,204,0.08);
    }
    #cv-footer-text { font-size: 0.74rem; color: rgba(255,255,255,0.35); }
    #cv-footer-dl {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 1.3rem;
      background: rgba(0,229,204,0.1);
      border: 1px solid rgba(0,229,204,0.38);
      border-radius: 10px;
      color: #00e5cc;
      text-decoration: none;
      font-size: 0.79rem;
      font-weight: 700;
      font-family: 'Inter', system-ui, sans-serif;
      letter-spacing: 0.03em;
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    #cv-footer-dl:hover {
      background: rgba(0,229,204,0.2);
      border-color: rgba(0,229,204,0.65);
      box-shadow: 0 0 16px rgba(0,229,204,0.2);
    }
  `;
  document.head.appendChild(s);
}

// ── DOM ──────────────────────────────────────────────────────────────────────

function createCVPanel(): void {
  loadFont();
  injectStyles();

  // Button
  const btn = document.createElement("button");
  btn.id = "cv-btn";
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="#00e5cc" stroke-width="1.4"/>
      <path d="M4 5h6M4 7.5h6M4 10h4" stroke="#00e5cc" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    Resume
  `;
  btn.onclick = openCVPanel;
  document.body.appendChild(btn);

  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "cv-overlay";
  overlay.onclick = (e) => { if (e.target === overlay) closeCVPanel(); };

  // Panel
  const panel = document.createElement("div");
  panel.id = "cv-panel";

  // ── Top bar (non-scrolling, always visible) ──────────────────────────────
  const topbar = document.createElement("div");
  topbar.id = "cv-topbar";
  topbar.innerHTML = `
    <button id="cv-close">
      <span class="cv-esc">ESC</span>
      <span>Close</span>
      <span style="font-size:1rem;line-height:1;color:rgba(255,255,255,0.35);">&times;</span>
    </button>
  `;
  topbar.querySelector("#cv-close")!.addEventListener("click", closeCVPanel);
  panel.appendChild(topbar);

  // ── Scrollable content area ──────────────────────────────────────────────
  const scroll = document.createElement("div");
  scroll.id = "cv-scroll";

  // ── Hero ─────────────────────────────────────────────────────────────────
  const hero = document.createElement("div");
  hero.id = "cv-hero";
  hero.innerHTML = `
    <div id="cv-hero-cover"></div>
    <div id="cv-hero-cover-fade"></div>
    <div id="cv-hero-row">
      <img id="cv-avatar" src="/img/alex-headshot.png" alt="Alexander Lazarovich" />
      <div id="cv-hero-info">
        <h1 id="cv-name">Alexander Lazarovich</h1>
        <p id="cv-title">Full Stack Engineer &nbsp;·&nbsp; 5+ Years</p>
        <p id="cv-summary">
          Full-stack engineer across semiconductor (ASML/Intel), B2B SaaS, and proprietary trading.
          Led teams, shipped AI platforms, and architected microservices serving 100K+ active users.
          Deep React &amp; TypeScript expertise paired with strong backend and cloud infra.
        </p>
        <div id="cv-actions">
          <a class="cv-action-link secondary" href="https://www.linkedin.com/in/alexander-lazarovich/"
            target="_blank" rel="noopener">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
            </svg>
            LinkedIn
          </a>
          <a class="cv-action-link secondary" href="mailto:alex.lazarovichh@gmail.com">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z"/>
            </svg>
            Email
          </a>
          <a class="cv-action-link secondary" href="tel:+972544567302">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
            </svg>
            +972 544 567 302
          </a>
          <a class="cv-action-link primary" href="/AL_CV_TH5_v1.pdf" download="Alexander_Lazarovich_CV.pdf">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 7l3 3 3-3M1 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download CV
          </a>
        </div>
      </div>
    </div>
  `;
  scroll.appendChild(hero);

  // ── Skills (categorized) ─────────────────────────────────────────────────
  const skillCategories: { label: string; skills: string[]; full?: boolean }[] = [
    {
      label: "Frontend",
      skills: ["React", "TypeScript", "Vue.js", "Redux", "React Query", "MUI", "Storybook", "HTML / CSS", "Responsive Design"],
    },
    {
      label: "Backend",
      skills: ["Node.js", "NestJS", "PHP", "Laravel", "Express.js", "REST APIs", "Microservices", "GraphQL"],
    },
    {
      label: "Databases",
      skills: ["MySQL", "MongoDB", "Redis", "PostgreSQL", "SQL Optimization"],
    },
    {
      label: "DevOps & Cloud",
      skills: ["AWS", "Docker", "CI/CD", "Git", "GitHub Actions", "Nx Monorepo", "Linux / Unix"],
    },
    {
      label: "Engineering & Leadership",
      skills: ["System Design", "Team Leadership", "Agile / Scrum", "Code Review", "Technical Training", "Figma", "API Integration", "Performance Optimization"],
      full: true,
    },
  ];

  const stackSection = document.createElement("div");
  stackSection.className = "cv-section";
  stackSection.innerHTML = `
    <p class="cv-section-label">Skills & Technologies</p>
    <div class="cv-skills-grid">
      ${skillCategories.map((cat) => `
        <div class="cv-skill-group${cat.full ? " full" : ""}">
          <p class="cv-skill-group-label">${cat.label}</p>
          <div class="cv-skill-group-chips">
            ${cat.skills.map((s) => `<span>${s}</span>`).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
  scroll.appendChild(stackSection);

  // ── Experience ───────────────────────────────────────────────────────────
  const expSection = document.createElement("div");
  expSection.className = "cv-section";
  expSection.innerHTML = `<p class="cv-section-label">Experience</p>`;

  const expList = document.createElement("div");
  expList.className = "cv-exp-list";

  [...TIMELINE_STOPS].reverse().forEach((stop, i) => {
    const isLatest = i === 0;
    const dashIdx = stop.title.indexOf(" — ");
    const company = dashIdx >= 0 ? stop.title.slice(0, dashIdx) : stop.title;
    const role    = dashIdx >= 0 ? stop.title.slice(dashIdx + 3) : "";

    const periodMatch = stop.subtitle.match(/([A-Z][a-z]{2}\s\d{4})\s[–-]\s([A-Z][a-z]{2}\s\d{4}|Present)/);
    const period = periodMatch
      ? `${periodMatch[1]} – ${periodMatch[2]}`
      : (stop.subtitle.split("·")[1]?.trim() ?? String(stop.year));

    // Duration + location: parts after date range
    const subParts = stop.subtitle.split("·").slice(2).map((p) => p.trim()).filter(Boolean);
    const subLine  = subParts.join(" · ");

    const logoHtml = stop.logo
      ? `<span class="cv-exp-logo-wrap"><img class="cv-exp-logo" src="${stop.logo}" alt="${company}" /></span>`
      : "";

    const entry = document.createElement("div");
    entry.className = "cv-exp-entry";
    entry.innerHTML = `
      <div class="cv-exp-line${isLatest ? " active" : ""}"></div>
      <div class="cv-exp-body">
        <div class="cv-exp-meta">
          <span class="cv-exp-period${isLatest ? " active" : ""}">${period}</span>
          ${logoHtml}
        </div>
        <div class="cv-exp-title">${company}</div>
        <div class="cv-exp-sub">${role}${subLine ? ` · ${subLine}` : ""}</div>
        <ul class="cv-exp-bullets">
          ${stop.bullets.map((b) => `<li>${b}</li>`).join("")}
        </ul>
        <div class="cv-exp-skills">
          ${(stop.skills ?? []).map((s) => `<span class="cv-exp-skill">${s}</span>`).join("")}
        </div>
      </div>
    `;
    expList.appendChild(entry);
  });

  expSection.appendChild(expList);
  scroll.appendChild(expSection);

  // ── Education ────────────────────────────────────────────────────────────
  const eduSection = document.createElement("div");
  eduSection.className = "cv-section";
  eduSection.innerHTML = `
    <p class="cv-section-label">Education</p>
    <div class="cv-edu-row">
      <div class="cv-edu-line"></div>
      <div>
        <p id="cv-edu-title">B.Sc. Electrical &amp; Electronics Engineering</p>
        <p id="cv-edu-sub">Ariel University &nbsp;·&nbsp; Israel</p>
      </div>
    </div>
  `;
  scroll.appendChild(eduSection);

  panel.appendChild(scroll);

  // ── Footer CTA (non-scrolling, always at bottom) ─────────────────────────
  const footer = document.createElement("div");
  footer.id = "cv-footer";
  footer.innerHTML = `
    <span id="cv-footer-text">Open to new opportunities &nbsp;·&nbsp; Full-time / Contract</span>
    <a id="cv-footer-dl" href="/AL_CV_TH5_v1.pdf" download="Alexander_Lazarovich_CV.pdf">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v8M4 7l3 3 3-3M1 12h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Download Full CV
    </a>
  `;
  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  panelEl = overlay;

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && isOpen) closeCVPanel();
  });
}

// ── Open / Close ─────────────────────────────────────────────────────────────

function openCVPanel(): void {
  if (!panelEl) return;
  isOpen = true;
  panelEl.style.display = "flex";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    panelEl!.classList.add("cv-visible");
  }));
}

function closeCVPanel(): void {
  if (!panelEl) return;
  isOpen = false;
  panelEl.classList.remove("cv-visible");
  setTimeout(() => { if (!isOpen) panelEl!.style.display = "none"; }, 360);
}

export function initCVPanel(): void {
  createCVPanel();
}
