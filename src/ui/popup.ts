import type { StopData } from "../scene/types";

let popupEl: HTMLDivElement | null = null;

function getOrCreatePopup(): HTMLDivElement {
  if (popupEl) return popupEl;

  const overlay = document.createElement("div");
  overlay.id = "popup-overlay";
  overlay.innerHTML = `
    <div id="popup-content">
      <button id="popup-close">&times;</button>
      <h2 id="popup-title"></h2>
      <p id="popup-description"></p>
    </div>
  `;

  overlay.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  `;

  const content = overlay.querySelector("#popup-content") as HTMLDivElement;
  content.style.cssText = `
    background: #2d3561;
    padding: 1.5rem 2rem;
    border-radius: 12px;
    max-width: 420px;
    position: relative;
    color: #fff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
  `;

  const closeBtn = overlay.querySelector("#popup-close") as HTMLButtonElement;
  closeBtn.style.cssText = `
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    background: none;
    border: none;
    color: #4ecdc4;
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hide();
  });

  closeBtn.addEventListener("click", hide);

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && popupEl?.style.display === "flex") {
      hide();
    }
  });

  document.body.appendChild(overlay);
  popupEl = overlay;
  return overlay;
}

export function show(data: StopData): void {
  const overlay = getOrCreatePopup();
  const title = overlay.querySelector("#popup-title") as HTMLHeadingElement;
  const desc = overlay.querySelector(
    "#popup-description",
  ) as HTMLParagraphElement;

  title.textContent = data.title;
  desc.textContent = data.description;

  overlay.style.display = "flex";
}

export function hide(): void {
  if (popupEl) {
    popupEl.style.display = "none";
  }
}
