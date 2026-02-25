import { TIMELINE_STOPS } from "../scene/timeline/timelineConfig";

let panelEl: HTMLDivElement | null = null;
let isOpen = false;

function createCVPanel(): void {
  // Button
  const btn = document.createElement("button");
  btn.id = "cv-btn";
  btn.textContent = "View CV";
  btn.style.cssText = `
    position: fixed;
    top: 1.25rem;
    right: 1.25rem;
    z-index: 900;
    padding: 0.5rem 1.1rem;
    background: rgba(0, 229, 204, 0.1);
    border: 1px solid rgba(0, 229, 204, 0.4);
    border-radius: 8px;
    color: #00e5cc;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: background 0.2s, border-color 0.2s;
  `;
  btn.onmouseenter = () => {
    btn.style.background = "rgba(0, 229, 204, 0.2)";
    btn.style.borderColor = "rgba(0, 229, 204, 0.7)";
  };
  btn.onmouseleave = () => {
    btn.style.background = "rgba(0, 229, 204, 0.1)";
    btn.style.borderColor = "rgba(0, 229, 204, 0.4)";
  };
  btn.onclick = openCVPanel;
  document.body.appendChild(btn);

  // Panel overlay
  const overlay = document.createElement("div");
  overlay.id = "cv-overlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 950;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(10px);
    padding: 1.5rem;
  `;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeCVPanel();
  };

  const panel = document.createElement("div");
  panel.style.cssText = `
    background: #1a1d2e;
    border: 1px solid rgba(0, 229, 204, 0.2);
    border-radius: 14px;
    padding: 2rem;
    max-width: 560px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    color: #fff;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    scrollbar-width: thin;
    scrollbar-color: rgba(0,229,204,0.2) transparent;
  `;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    position: absolute;
    top: 0.75rem;
    right: 1rem;
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    font-size: 1.75rem;
    cursor: pointer;
    line-height: 1;
    transition: color 0.2s;
  `;
  closeBtn.onmouseenter = () => { closeBtn.style.color = "#00e5cc"; };
  closeBtn.onmouseleave = () => { closeBtn.style.color = "rgba(255,255,255,0.4)"; };
  closeBtn.onclick = closeCVPanel;
  panel.appendChild(closeBtn);

  // Header
  const header = document.createElement("div");
  header.style.cssText = `margin-bottom: 1.5rem;`;
  header.innerHTML = `
    <h2 style="font-size:1.3rem;font-weight:600;letter-spacing:0.02em;color:#fff;">Alexander Lazarovich</h2>
    <p style="color:#00e5cc;font-size:0.82rem;margin-top:0.2rem;letter-spacing:0.05em;">Full Stack Engineer</p>
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.65rem;">
      <a href="https://www.linkedin.com/in/alexander-lazarovich/" target="_blank" rel="noopener" style="font-size:0.75rem;color:rgba(255,255,255,0.55);text-decoration:none;padding:0.2rem 0.55rem;border:1px solid rgba(255,255,255,0.12);border-radius:5px;">LinkedIn</a>
      <a href="mailto:alex.lazarovichh@gmail.com" style="font-size:0.75rem;color:rgba(255,255,255,0.55);text-decoration:none;padding:0.2rem 0.55rem;border:1px solid rgba(255,255,255,0.12);border-radius:5px;">alex.lazarovichh@gmail.com</a>
    </div>
  `;
  panel.appendChild(header);

  // Skills
  const skillsSection = document.createElement("div");
  skillsSection.style.cssText = `margin-bottom: 1.5rem;`;
  skillsSection.innerHTML = `
    <p style="font-size:0.7rem;letter-spacing:0.1em;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:0.6rem;">Core Skills</p>
    <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
      ${["TypeScript", "React", "Node.js", "NestJS", "SQL", "Redis", "Docker", "AWS", "Nx monorepo", "MUI", "React Query", "REST / SOAP"].map(
        (s) => `<span style="font-size:0.75rem;padding:0.2rem 0.55rem;background:rgba(0,229,204,0.07);border:1px solid rgba(0,229,204,0.2);border-radius:5px;color:rgba(255,255,255,0.7);">${s}</span>`
      ).join("")}
    </div>
  `;
  panel.appendChild(skillsSection);

  // Divider
  const divider = document.createElement("div");
  divider.style.cssText = `height:1px;background:rgba(255,255,255,0.07);margin-bottom:1.25rem;`;
  panel.appendChild(divider);

  // Timeline entries
  const timeline = document.createElement("div");
  timeline.style.cssText = `display: flex; flex-direction: column; gap: 1.25rem;`;

  [...TIMELINE_STOPS].reverse().forEach((stop, i) => {
    const entry = document.createElement("div");
    entry.style.cssText = `
      border-left: 2px solid ${i === 0 ? "#00e5cc" : "rgba(0,229,204,0.25)"};
      padding-left: 1rem;
    `;

    const year = document.createElement("span");
    year.textContent = String(stop.year);
    year.style.cssText = `
      display: inline-block;
      font-size: 0.72rem;
      color: #00e5cc;
      letter-spacing: 0.08em;
      margin-bottom: 0.25rem;
      font-weight: 600;
    `;

    const title = document.createElement("h3");
    title.textContent = stop.title;
    title.style.cssText = `font-size: 0.95rem; font-weight: 600; color: #fff; margin-bottom: 0.2rem;`;

    const subtitle = document.createElement("p");
    subtitle.textContent = stop.subtitle;
    subtitle.style.cssText = `font-size: 0.78rem; color: rgba(255,255,255,0.5); font-style: italic; margin-bottom: 0.5rem;`;

    const bullets = document.createElement("ul");
    bullets.style.cssText = `list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.2rem;`;
    stop.bullets.forEach((b) => {
      const li = document.createElement("li");
      li.style.cssText = `font-size: 0.8rem; color: rgba(255,255,255,0.75); padding-left: 1rem; position: relative; line-height: 1.5;`;
      li.innerHTML = `<span style="position:absolute;left:0;color:#00e5cc">▸</span>${b}`;
      bullets.appendChild(li);
    });

    entry.appendChild(year);
    entry.appendChild(title);
    entry.appendChild(subtitle);
    entry.appendChild(bullets);

    if (stop.links && stop.links.length > 0) {
      const links = document.createElement("div");
      links.style.cssText = `display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem;`;
      stop.links.forEach((l) => {
        const a = document.createElement("a");
        a.href = l.url;
        a.textContent = l.label;
        a.target = "_blank";
        a.rel = "noopener";
        a.style.cssText = `
          display: inline-block;
          padding: 0.3rem 0.7rem;
          background: rgba(0,229,204,0.08);
          border: 1px solid rgba(0,229,204,0.3);
          border-radius: 6px;
          color: #00e5cc;
          text-decoration: none;
          font-size: 0.75rem;
          transition: background 0.2s;
        `;
        a.onmouseenter = () => { a.style.background = "rgba(0,229,204,0.18)"; };
        a.onmouseleave = () => { a.style.background = "rgba(0,229,204,0.08)"; };
        links.appendChild(a);
      });
      entry.appendChild(links);
    }

    timeline.appendChild(entry);
  });

  panel.appendChild(timeline);

  // Education
  const eduDivider = document.createElement("div");
  eduDivider.style.cssText = `height:1px;background:rgba(255,255,255,0.07);margin:1.5rem 0 1.25rem;`;
  panel.appendChild(eduDivider);

  const edu = document.createElement("div");
  edu.innerHTML = `
    <p style="font-size:0.7rem;letter-spacing:0.1em;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:0.6rem;">Education</p>
    <p style="font-size:0.88rem;color:#fff;font-weight:600;">B.Sc. Electrical & Electronics Engineering</p>
    <p style="font-size:0.78rem;color:rgba(255,255,255,0.5);margin-top:0.15rem;">Ariel University</p>
  `;
  panel.appendChild(edu);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  panelEl = overlay;

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && isOpen) closeCVPanel();
  });
}

function openCVPanel(): void {
  if (!panelEl) return;
  isOpen = true;
  panelEl.style.display = "flex";
}

function closeCVPanel(): void {
  if (!panelEl) return;
  isOpen = false;
  panelEl.style.display = "none";
}

export function initCVPanel(): void {
  createCVPanel();
}
