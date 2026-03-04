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
    z-index: 2000;
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
    z-index: 2001;
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
    background: #13151f;
    border: 1px solid rgba(0, 229, 204, 0.15);
    border-radius: 16px;
    padding: 1.75rem 1.75rem 2rem;
    max-width: 480px;
    width: 100%;
    max-height: 88vh;
    overflow-y: auto;
    position: relative;
    color: #fff;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0,229,204,0.06);
    scrollbar-width: thin;
    scrollbar-color: rgba(0,229,204,0.15) transparent;
  `;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    position: absolute;
    top: 0.9rem;
    right: 1rem;
    background: none;
    border: none;
    color: rgba(255,255,255,0.3);
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
    transition: color 0.2s;
    padding: 0.1rem 0.3rem;
  `;
  closeBtn.onmouseenter = () => { closeBtn.style.color = "#00e5cc"; };
  closeBtn.onmouseleave = () => { closeBtn.style.color = "rgba(255,255,255,0.3)"; };
  closeBtn.onclick = closeCVPanel;
  panel.appendChild(closeBtn);

  // Header
  const header = document.createElement("div");
  header.style.cssText = `margin-bottom: 1.25rem;`;
  header.innerHTML = `
    <h2 style="font-size:1.2rem;font-weight:700;letter-spacing:0.01em;color:#fff;margin:0;">Alexander Lazarovich</h2>
    <p style="color:#00e5cc;font-size:0.78rem;margin:0.2rem 0 0.75rem;letter-spacing:0.06em;text-transform:uppercase;">Full Stack Engineer</p>
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">
      <a href="https://www.linkedin.com/in/alexander-lazarovich/" target="_blank" rel="noopener"
        style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.73rem;color:rgba(255,255,255,0.5);text-decoration:none;padding:0.25rem 0.6rem;border:1px solid rgba(255,255,255,0.1);border-radius:6px;transition:border-color 0.2s;">LinkedIn</a>
      <a href="mailto:alex.lazarovichh@gmail.com"
        style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.73rem;color:rgba(255,255,255,0.5);text-decoration:none;padding:0.25rem 0.6rem;border:1px solid rgba(255,255,255,0.1);border-radius:6px;transition:border-color 0.2s;">alex.lazarovichh@gmail.com</a>
      <a href="/AL_CV_TH5_v1.pdf" download="Alexander_Lazarovich_CV.pdf"
        style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.73rem;color:#00e5cc;text-decoration:none;padding:0.25rem 0.7rem;background:rgba(0,229,204,0.09);border:1px solid rgba(0,229,204,0.3);border-radius:6px;font-weight:600;letter-spacing:0.02em;">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;margin-top:1px"><path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="#00e5cc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download CV
      </a>
    </div>
  `;
  panel.appendChild(header);

  // Divider
  const divider1 = document.createElement("div");
  divider1.style.cssText = `height:1px;background:rgba(255,255,255,0.06);margin-bottom:1.1rem;`;
  panel.appendChild(divider1);

  // Skills
  const skillsSection = document.createElement("div");
  skillsSection.style.cssText = `margin-bottom: 1.25rem;`;
  skillsSection.innerHTML = `
    <p style="font-size:0.65rem;letter-spacing:0.12em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin:0 0 0.5rem;">Stack</p>
    <div style="display:flex;flex-wrap:wrap;gap:0.3rem;">
      ${["TypeScript", "React", "Node.js", "NestJS", "SQL", "Redis", "Docker", "AWS", "Nx", "MUI", "React Query"].map(
        (s) => `<span style="font-size:0.72rem;padding:0.18rem 0.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);">${s}</span>`
      ).join("")}
    </div>
  `;
  panel.appendChild(skillsSection);

  // Divider
  const divider2 = document.createElement("div");
  divider2.style.cssText = `height:1px;background:rgba(255,255,255,0.06);margin-bottom:1.1rem;`;
  panel.appendChild(divider2);

  // Timeline entries
  const timeline = document.createElement("div");
  timeline.style.cssText = `display: flex; flex-direction: column; gap: 1.1rem;`;

  [...TIMELINE_STOPS].reverse().forEach((stop, i) => {
    const isLatest = i === 0;
    const entry = document.createElement("div");
    entry.style.cssText = `
      border-left: 2px solid ${isLatest ? "#00e5cc" : "rgba(255,255,255,0.08)"};
      padding-left: 0.9rem;
    `;

    const year = document.createElement("span");
    year.textContent = stop.subtitle.match(/\d{4}.*/)?.at(0) ?? String(stop.year);
    year.style.cssText = `
      display: block;
      font-size: 0.68rem;
      color: ${isLatest ? "#00e5cc" : "rgba(255,255,255,0.35)"};
      letter-spacing: 0.06em;
      margin-bottom: 0.2rem;
      font-weight: 600;
    `;

    const title = document.createElement("h3");
    title.textContent = stop.title;
    title.style.cssText = `font-size: 0.9rem; font-weight: 600; color: #fff; margin: 0 0 0.35rem;`;

    const bullets = document.createElement("ul");
    bullets.style.cssText = `list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.18rem;`;
    stop.bullets.forEach((b) => {
      const li = document.createElement("li");
      li.style.cssText = `font-size: 0.77rem; color: rgba(255,255,255,0.6); padding-left: 0.9rem; position: relative; line-height: 1.55;`;
      li.innerHTML = `<span style="position:absolute;left:0;color:rgba(0,229,204,0.6);">▸</span>${b}`;
      bullets.appendChild(li);
    });

    entry.appendChild(year);
    entry.appendChild(title);
    entry.appendChild(bullets);
    timeline.appendChild(entry);
  });

  panel.appendChild(timeline);

  // Education
  const eduDivider = document.createElement("div");
  eduDivider.style.cssText = `height:1px;background:rgba(255,255,255,0.06);margin:1.25rem 0 1rem;`;
  panel.appendChild(eduDivider);

  const edu = document.createElement("div");
  edu.innerHTML = `
    <p style="font-size:0.65rem;letter-spacing:0.12em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin:0 0 0.4rem;">Education</p>
    <p style="font-size:0.85rem;color:#fff;font-weight:600;margin:0;">B.Sc. Electrical & Electronics Engineering</p>
    <p style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin:0.15rem 0 0;">Ariel University</p>
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
  // Inject hover styles for innerHTML links
  const style = document.createElement("style");
  style.textContent = `
    #cv-overlay a:hover { border-color: rgba(255,255,255,0.3) !important; color: #fff !important; }
    #cv-overlay a[download]:hover { background: rgba(0,229,204,0.18) !important; border-color: rgba(0,229,204,0.6) !important; color: #00e5cc !important; }
  `;
  document.head.appendChild(style);
  createCVPanel();
}
