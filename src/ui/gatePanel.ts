import type { StopData } from "../scene/types";

let panelEl: HTMLDivElement | null = null;
let currentStopId: string | null = null;

function getOrCreatePanel(): HTMLDivElement {
  if (panelEl) return panelEl;

  const panel = document.createElement("div");
  panel.id = "gate-panel";
  panel.style.cssText = `
    position: fixed;
    right: 3vw;
    top: 50%;
    transform: translateY(-50%) translateX(20px);
    z-index: 500;
    width: 340px;
    background: #13151f;
    border-radius: 14px;
    border: 1px solid rgba(0,229,204,0.18);
    box-shadow: 0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,229,204,0.06);
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.28s ease-out, transform 0.28s ease-out;
    overflow: hidden;
  `;

  panel.innerHTML = `
    <div id="gate-panel-accent-bar" style="
      height: 3px;
      background: linear-gradient(90deg, transparent, #00e5cc 40%, #4ecdc4 60%, transparent);
      opacity: 0.7;
    "></div>
    <div style="padding: 1.25rem 1.5rem 1.4rem;">
      <div id="gate-panel-year" style="
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: #00e5cc;
        text-transform: uppercase;
        margin-bottom: 0.3rem;
        opacity: 0.85;
      "></div>
      <div id="gate-panel-title" style="
        font-size: 1.05rem;
        font-weight: 700;
        color: #fff;
        line-height: 1.3;
        margin-bottom: 0.2rem;
      "></div>
      <div id="gate-panel-subtitle" style="
        font-size: 0.78rem;
        color: rgba(255,255,255,0.45);
        font-style: italic;
        margin-bottom: 0.85rem;
        display: none;
      "></div>
      <ul id="gate-panel-bullets" style="
        list-style: none;
        padding: 0;
        margin: 0 0 0.85rem 0;
        display: none;
        border-top: 1px solid rgba(255,255,255,0.06);
        padding-top: 0.75rem;
      "></ul>
      <div id="gate-panel-links" style="
        display: none;
        flex-wrap: wrap;
        gap: 0.4rem;
      "></div>
    </div>
  `;

  document.body.appendChild(panel);
  panelEl = panel;
  return panel;
}

export function initGatePanel(): void {
  getOrCreatePanel();
}

export function updateGatePanel(
  data: StopData | null,
  proximityFactor: number,
): void {
  const panel = getOrCreatePanel();

  if (!data || proximityFactor <= 0) {
    panel.style.opacity = "0";
    panel.style.transform = "translateY(-50%) translateX(20px)";
    return;
  }

  // Update content only when the stop changes
  if (data.id !== currentStopId) {
    currentStopId = data.id;
    populatePanel(panel, data);
  }

  // Clamp factor for display (drive opacity and slide-in from right)
  const clamped = Math.max(0, Math.min(1, proximityFactor));
  const slideX = (1 - clamped) * 20;

  panel.style.opacity = String(clamped);
  panel.style.transform = `translateY(-50%) translateX(${slideX}px)`;
}

function populatePanel(panel: HTMLDivElement, data: StopData): void {
  const yearEl = panel.querySelector("#gate-panel-year") as HTMLDivElement;
  const titleEl = panel.querySelector("#gate-panel-title") as HTMLDivElement;
  const subtitleEl = panel.querySelector(
    "#gate-panel-subtitle",
  ) as HTMLDivElement;
  const bulletsEl = panel.querySelector("#gate-panel-bullets") as HTMLUListElement;
  const linksEl = panel.querySelector("#gate-panel-links") as HTMLDivElement;

  // Title is formatted as "YEAR — Company Role"; split on em-dash for the year badge
  const dashIndex = data.title.indexOf(" — ");
  if (dashIndex !== -1) {
    yearEl.textContent = data.title.slice(0, dashIndex);
    titleEl.textContent = data.title.slice(dashIndex + 3);
  } else {
    yearEl.textContent = "";
    titleEl.textContent = data.title;
  }

  if (data.subtitle) {
    subtitleEl.textContent = data.subtitle;
    subtitleEl.style.display = "block";
  } else {
    subtitleEl.style.display = "none";
  }

  if (data.bullets && data.bullets.length > 0) {
    bulletsEl.innerHTML = data.bullets
      .map(
        (b) =>
          `<li style="padding:0.28rem 0 0.28rem 1.1rem;position:relative;font-size:0.79rem;color:rgba(255,255,255,0.78);line-height:1.5"><span style="position:absolute;left:0;color:#00e5cc">▸</span>${b}</li>`,
      )
      .join("");
    bulletsEl.style.display = "block";
  } else {
    bulletsEl.innerHTML = "";
    bulletsEl.style.display = "none";
  }

  if (data.links && data.links.length > 0) {
    linksEl.innerHTML = data.links
      .map(
        (l) =>
          `<a href="${l.url}" target="_blank" rel="noopener" style="display:inline-block;padding:0.3rem 0.65rem;background:rgba(0,229,204,0.08);border:1px solid rgba(0,229,204,0.25);border-radius:6px;color:#00e5cc;text-decoration:none;font-size:0.72rem;transition:background 0.2s">${l.label}</a>`,
      )
      .join("");
    linksEl.style.display = "flex";
  } else {
    linksEl.innerHTML = "";
    linksEl.style.display = "none";
  }
}
