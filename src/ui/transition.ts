import * as THREE from "three";
import type { StopData } from "../scene/types";
import { addTiltEffect } from "./tiltEffect";
import { highlight, injectHighlightStyles } from "./highlightUtils";
import { initPhotoLightbox, attachZoomHint } from "./photoLightbox";
import { renderChip, injectChipStyles } from "./chipUtils";

const DURATION_MS = 700;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

const HOME_POSITION = new THREE.Vector3(6, 6, 10);
const HOME_TARGET = new THREE.Vector3(0, 0.5, 0);

// #cinematic-content  — outer animation wrapper (translateY / opacity slide-in)
// #cinematic-card     — inner visual card (background, border, flex layout, TILT)
let overlayEl: HTMLDivElement | null = null;
let contentEl: HTMLDivElement | null = null;   // animation wrapper
let cardEl: HTMLDivElement | null = null;       // visual card + tilt
let isTransitioning = false;
let isOpen = false;
let detachImgZoom: (() => void) | null = null; // cleanup for current image zoom hint
let gatePanelBodyHTML: string | null = null;   // saved standard panel body template

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("cinematic-styles")) return;
  const style = document.createElement("style");
  style.id = "cinematic-styles";
  style.textContent = `
    /* Animation wrapper — only drives enter/exit, no visual styles */
    #cinematic-content {
      position: relative;
      max-width: 440px;
      width: calc(100% - 2rem);
      transform: translateY(40px);
      opacity: 0;
      transition:
        transform 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.18s,
        opacity 0.45s ease-out 0.18s;
      pointer-events: auto;
    }
    #cinematic-content.has-image {
      max-width: 660px;
    }

    /* Visual card — background, layout, tilt target */
    #cinematic-card {
      background: linear-gradient(145deg, #0d1117 0%, #111827 55%, #0a0f1e 100%);
      border-radius: 16px;
      color: #fff;
      box-shadow:
        0 32px 80px rgba(0,0,0,0.7),
        0 0 0 1px rgba(0,229,204,0.13),
        0 0 48px rgba(0,229,204,0.03);
      border: 1px solid rgba(0,229,204,0.14);
      overflow: hidden;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: row;
      will-change: transform;
      transform-style: preserve-3d;
      position: relative;
      max-height: min(620px, calc(92vh - 2rem));
    }

    /* Top accent line */
    #cinematic-top-bar {
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #00e5cc 35%, #4ecdc4 55%, transparent 100%);
      opacity: 0.9;
      position: absolute;
      top: 0; left: 0; right: 0;
      z-index: 3;
      pointer-events: none;
    }

    /* ── Close button — lives OUTSIDE #cinematic-card (tilt-immune) ── */
    #cinematic-close {
      position: absolute;
      top: -14px;
      right: 0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.32rem 0.8rem 0.32rem 0.6rem;
      background: rgba(13,17,23,0.92);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 24px;
      cursor: pointer;
      color: rgba(255,255,255,0.6);
      font-family: inherit;
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.03em;
      z-index: 20;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
      transition: background 0.18s ease, color 0.18s ease,
                  border-color 0.18s ease, box-shadow 0.18s ease,
                  transform 0.15s cubic-bezier(0.16,1,0.3,1);
      white-space: nowrap;
      user-select: none;
    }
    #cinematic-close:hover {
      background: rgba(25,32,44,0.98);
      color: #fff;
      border-color: rgba(0,229,204,0.38);
      box-shadow: 0 4px 24px rgba(0,0,0,0.6), 0 0 12px rgba(0,229,204,0.08);
      transform: translateY(-1px) scale(1.03);
    }
    #cinematic-close:active {
      transform: translateY(0) scale(0.97);
    }
    #cinematic-close .close-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s;
    }
    #cinematic-close:hover .close-icon-wrap {
      background: rgba(0,229,204,0.12);
      border-color: rgba(0,229,204,0.35);
    }
    #cinematic-close .close-icon-wrap svg {
      width: 9px; height: 9px;
      stroke: rgba(255,255,255,0.55);
      transition: stroke 0.15s;
    }
    #cinematic-close:hover .close-icon-wrap svg {
      stroke: #00e5cc;
    }
    #cinematic-close .esc-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 1px 5px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.13);
      border-bottom: 2px solid rgba(255,255,255,0.2);
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      font-family: system-ui, monospace;
      color: rgba(255,255,255,0.5);
      line-height: 1.4;
      letter-spacing: 0.04em;
    }

    /* Hide controls hint while overlay is open */
    body.transition-open #controls-hint {
      opacity: 0 !important;
      pointer-events: none;
      transition: opacity 0.25s ease !important;
    }

    /* ── Backdrop hint below the card ── */
    #cinematic-backdrop-hint {
      margin-top: 0.9rem;
      font-size: 0.65rem;
      color: rgba(255,255,255,0.22);
      letter-spacing: 0.06em;
      text-align: center;
      pointer-events: none;
      user-select: none;
    }

    /* ── Image panel ─────────────────────────────────────────────── */
    #cinematic-img-panel {
      width: 235px;
      min-width: 235px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      align-self: stretch;
      display: none;
      border-radius: 16px 0 0 16px;
    }
    /* zoom hint inherits the rounded left corners of the panel */
    #cinematic-img-panel .plb-trigger-hint {
      border-radius: 16px 0 0 16px;
    }
    #cinematic-content.has-image #cinematic-img-panel {
      display: block;
    }
    #cinematic-img-panel img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 42%;
      display: block;
    }
    #cinematic-img-fade {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(
          to right,
          rgba(255, 190, 40, 0.07) 0%,
          transparent 50%,
          rgba(10, 15, 30, 0.82) 78%,
          rgba(10, 15, 30, 1) 100%
        ),
        linear-gradient(
          to bottom,
          rgba(0,0,0,0.28) 0%,
          transparent 22%,
          transparent 72%,
          rgba(0,0,0,0.58) 100%
        );
      pointer-events: none;
    }
    #cinematic-img-caption {
      position: absolute;
      bottom: 0.7rem;
      left: 0.75rem;
      font-size: 0.58rem;
      color: rgba(255,255,255,0.36);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      line-height: 1.4;
      pointer-events: none;
    }

    /* ── Content panel ───────────────────────────────────────────── */
    #cinematic-panel-body {
      flex: 1;
      min-width: 0;
      min-height: 0;
      padding: 1.6rem 1.8rem 1.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,229,204,0.15) transparent;
    }
    #cinematic-content.no-image #cinematic-panel-body {
      padding: 1.6rem 2rem 1.5rem 2rem;
    }

    /* Year badge */
    #cinematic-year-tag {
      display: none;
      align-self: flex-start;
      align-items: center;
      background: rgba(0, 229, 204, 0.09);
      border: 1px solid rgba(0, 229, 204, 0.22);
      color: #00e5cc;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 0.17rem 0.52rem;
      border-radius: 100px;
      margin-bottom: 0.6rem;
    }
    #cinematic-year-tag.visible {
      display: inline-flex;
    }

    /* Company name row: logo badge + name */
    #cinematic-company-row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      margin: 0 0 0.18rem 0;
      padding-right: 1.5rem;
    }
    #cinematic-logo-wrap {
      width: 34px;
      height: 34px;
      border-radius: 7px;
      background: #fff;
      flex-shrink: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 3px;
      overflow: hidden;
      box-shadow: 0 1px 6px rgba(0,0,0,0.35);
    }
    #cinematic-logo-wrap.visible {
      display: flex;
    }
    #cinematic-logo-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    #cinematic-company {
      font-size: 1.4rem;
      font-weight: 800;
      color: #fff;
      line-height: 1.15;
      margin: 0;
      letter-spacing: -0.015em;
    }

    /* Role */
    #cinematic-role {
      font-size: 0.88rem;
      font-weight: 500;
      color: rgba(255,255,255,0.68);
      margin: 0 0 0.15rem 0;
    }

    /* Period */
    #cinematic-period {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.32);
      font-style: italic;
      margin: 0 0 0.75rem 0;
    }

    /* Company context block */
    #cinematic-context {
      display: none;
      font-size: 0.75rem;
      color: rgba(255,255,255,0.5);
      line-height: 1.6;
      padding: 0.5rem 0.65rem;
      margin: 0 0 0.85rem 0;
      border-left: 2px solid rgba(0,229,204,0.28);
      background: rgba(0,229,204,0.04);
      border-radius: 0 6px 6px 0;
    }
    #cinematic-context.visible {
      display: block;
    }

    /* Separator */
    #cinematic-divider {
      height: 1px;
      background: linear-gradient(90deg, rgba(0,229,204,0.2) 0%, transparent 65%);
      margin-bottom: 0.85rem;
      flex-shrink: 0;
    }

    /* Description fallback */
    #cinematic-description-text {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.66);
      line-height: 1.62;
      margin: 0 0 0.75rem 0;
    }

    /* Bullets */
    #cinematic-bullets-list {
      list-style: none;
      padding: 0;
      margin: 0 0 0.6rem 0;
      flex: 1;
    }
    #cinematic-bullets-list li {
      padding: 0.27rem 0 0.27rem 1.2rem;
      position: relative;
      font-size: 0.79rem;
      color: rgba(255,255,255,0.75);
      line-height: 1.56;
    }
    #cinematic-bullets-list li::before {
      content: '▸';
      position: absolute;
      left: 0;
      color: #00e5cc;
    }

    /* ── Skills section ── */
    #cinematic-skills {
      display: none;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.75rem;
      margin-top: auto;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    #cinematic-skills.visible { display: flex; }
    #cinematic-skills-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.55);
    }
    #cinematic-skills-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.38rem;
    }

    /* ── Stagger entrance animations ─────────────────────────────── */
    @keyframes ctFadeSlideUp {
      from { opacity: 0; transform: translateY(9px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ctChipPop {
      0%   { opacity: 0; transform: scale(0.6) translateY(4px); }
      65%  { transform: scale(1.1) translateY(0); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes ctTopBarReveal {
      from { transform: scaleX(0); transform-origin: left; }
      to   { transform: scaleX(1); transform-origin: left; }
    }
    #cinematic-top-bar.ct-reveal {
      animation: ctTopBarReveal 0.55s cubic-bezier(0.16,1,0.3,1) 0.08s both;
    }

    /* ── Scanline overlay on image ────────────────────────────────── */
    @keyframes ctScanlineScroll {
      from { background-position: 0 0; }
      to   { background-position: 0 80px; }
    }
    #cinematic-img-scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.022) 2px,
        rgba(0,0,0,0.022) 4px
      );
      animation: ctScanlineScroll 5s linear infinite;
      pointer-events: none;
      opacity: 0.65;
    }

    /* ══════════════════════════════════════════════════════════════
     *  Command Center HUD — Game-native holographic interface
     * ══════════════════════════════════════════════════════════════ */
    #cinematic-content.ops-center {
      max-width: 860px;
    }
    #cinematic-content.ops-center #cinematic-card {
      max-height: min(680px, calc(94vh - 2.5rem));
    }
    #cinematic-content.ops-center #cinematic-panel-body {
      padding: 0;
      overflow: hidden;
    }

    /* ── Entrance animations ──────────────────────────────────── */
    @keyframes cmdDropIn {
      from { opacity: 0; transform: translateY(-12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes cmdTickerScroll {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }
    @keyframes cmdExpandPulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50%       { opacity: 0.9; transform: scale(1.2); }
    }
    @keyframes cmdScreenOn {
      0%   { opacity: 0.55; }
      12%  { opacity: 0; }
      18%  { opacity: 0.35; }
      28%  { opacity: 0; }
      38%  { opacity: 0.22; }
      52%  { opacity: 0; }
      100% { opacity: 0; }
    }
    @keyframes cmdRadarSweep {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes cmdBlipPing {
      0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
      100% { transform: translate(-50%,-50%) scale(3.5); opacity: 0; }
    }
    @keyframes cmdBlipActivePing {
      0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.9; }
      100% { transform: translate(-50%,-50%) scale(4.5); opacity: 0; }
    }

    /* ── HUD root ─────────────────────────────────────────────── */
    .cmd-hud {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    /* Dot grid */
    .cmd-hud::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(circle, rgba(0,229,204,0.09) 1px, transparent 1px);
      background-size: 22px 22px;
      pointer-events: none;
      z-index: 0;
    }
    /* Scanlines */
    .cmd-hud::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0,0,0,0.026) 3px,
        rgba(0,0,0,0.026) 4px
      );
      pointer-events: none;
      z-index: 15;
    }
    /* Screen power-on flash */
    .cmd-scanon {
      position: absolute;
      inset: 0;
      background: rgba(0,229,204,0.06);
      animation: cmdScreenOn 0.6s ease-out 0.18s both;
      pointer-events: none;
      z-index: 20;
    }

    /* ── Corner brackets ──────────────────────────────────────── */
    .cmd-corner {
      position: absolute;
      width: 18px;
      height: 18px;
      z-index: 5;
      pointer-events: none;
    }
    .cmd-corner::before, .cmd-corner::after {
      content: '';
      position: absolute;
      background: rgba(0,229,204,0.6);
    }
    .cmd-corner::before { width: 100%; height: 2px; }
    .cmd-corner::after  { width: 2px;  height: 100%; }
    .cmd-corner--tl { top: 12px; left: 12px; }
    .cmd-corner--tl::before { top: 0; left: 0; }
    .cmd-corner--tl::after  { top: 0; left: 0; }
    .cmd-corner--tr { top: 12px; right: 12px; }
    .cmd-corner--tr::before { top: 0; right: 0; left: auto; }
    .cmd-corner--tr::after  { top: 0; right: 0; left: auto; }
    .cmd-corner--bl { bottom: 12px; left: 12px; }
    .cmd-corner--bl::before { bottom: 0; top: auto; left: 0; }
    .cmd-corner--bl::after  { bottom: 0; top: auto; left: 0; }
    .cmd-corner--br { bottom: 12px; right: 12px; }
    .cmd-corner--br::before { bottom: 0; top: auto; right: 0; left: auto; }
    .cmd-corner--br::after  { bottom: 0; top: auto; right: 0; left: auto; }

    /* ── Header ───────────────────────────────────────────────── */
    .cmd-header {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.2rem;
      padding: 1.1rem 1.6rem 0.85rem;
      border-bottom: 1px solid rgba(0,229,204,0.1);
      background: linear-gradient(135deg, rgba(0,229,204,0.022) 0%, transparent 60%);
      flex-shrink: 0;
      animation: cmdDropIn 0.38s cubic-bezier(0.16,1,0.3,1) 0.22s both;
      will-change: transform, opacity;
    }
    .cmd-header-left { flex: 1; min-width: 0; }
    .cmd-eyebrow {
      font-size: 0.52rem;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.5);
      display: block;
      margin-bottom: 0.22rem;
      font-family: 'Courier New', monospace;
    }
    .cmd-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.025em;
      line-height: 1.05;
      margin: 0 0 0.16rem;
    }
    .cmd-meta {
      font-size: 0.67rem;
      color: rgba(255,255,255,0.3);
      margin: 0 0 0.5rem;
      font-style: italic;
    }
    .cmd-header-stats {
      display: flex;
      gap: 6px;
      margin-top: 0;
    }
    .cmd-stat {
      display: flex;
      align-items: baseline;
      gap: 4px;
      padding: 3px 8px;
      background: rgba(0,229,204,0.04);
      border: 1px solid rgba(0,229,204,0.12);
      border-radius: 4px;
    }
    .cmd-stat-value {
      font-size: 0.8rem;
      font-weight: 700;
      color: #00e5cc;
      line-height: 1;
      font-family: 'Courier New', monospace;
      letter-spacing: -0.02em;
    }
    .cmd-stat-label {
      font-size: 0.43rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.38);
      font-family: 'Courier New', monospace;
    }

    /* ── Architecture layer columns ───────────────────────────── */
    .cmd-layers {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      align-items: start;
      gap: 9px;
      padding: 0.85rem 1.15rem;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,229,204,0.15) transparent;
    }
    .cmd-layer {
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(var(--cmd-accent-rgb), 0.15);
      border-top: 2px solid var(--cmd-accent);
      border-radius: 6px;
      background: rgba(0,0,0,0.22);
      cursor: pointer;
      overflow: hidden;
      transition: border-color 0.25s ease, background 0.25s ease, opacity 0.3s ease;
      will-change: transform, opacity;
    }
    .cmd-layer:nth-child(1) {
      animation: cmdDropIn 0.42s cubic-bezier(0.16,1,0.3,1) 0.32s both;
    }
    .cmd-layer:nth-child(2) {
      animation: cmdDropIn 0.42s cubic-bezier(0.16,1,0.3,1) 0.42s both;
    }
    .cmd-layer:nth-child(3) {
      animation: cmdDropIn 0.42s cubic-bezier(0.16,1,0.3,1) 0.52s both;
    }
    .cmd-layer-head {
      padding: 10px 12px 7px;
      flex-shrink: 0;
    }
    .cmd-layer-sys {
      font-size: 0.49rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      color: var(--cmd-accent);
      font-family: 'Courier New', monospace;
      opacity: 0.6;
      text-transform: uppercase;
    }
    .cmd-layer-name {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--cmd-accent);
      margin: 3px 0 7px;
      line-height: 1.3;
    }
    .cmd-metric-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 5px;
    }
    .cmd-metric-bar {
      flex: 1;
      height: 2px;
      background: rgba(var(--cmd-accent-rgb), 0.1);
      border-radius: 1px;
      overflow: hidden;
    }
    .cmd-metric-fill {
      height: 100%;
      background: var(--cmd-accent);
      transform-origin: left;
      transform: scaleX(0);
      transition: transform 0.95s cubic-bezier(0.16,1,0.3,1);
      border-radius: 1px;
    }
    .cmd-layer.activated .cmd-metric-fill {
      transform: scaleX(1);
    }
    .cmd-metric-value {
      font-size: 0.58rem;
      font-weight: 600;
      color: rgba(255,255,255,0.52);
      white-space: nowrap;
      font-family: 'Courier New', monospace;
      flex-shrink: 0;
    }
    .cmd-layer-tech {
      padding: 0 12px 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      flex-shrink: 0;
    }
    .cmd-tech-node {
      font-size: 0.57rem;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(var(--cmd-accent-rgb), 0.07);
      border: 1px solid rgba(var(--cmd-accent-rgb), 0.17);
      color: rgba(255,255,255,0.56);
      font-family: 'Courier New', monospace;
      letter-spacing: 0.02em;
      transition: background 0.18s, color 0.18s, border-color 0.18s;
    }
    .cmd-layer-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 6px 12px;
      margin: 0 12px 9px;
      border: 1px solid rgba(var(--cmd-accent-rgb), 0.16);
      border-radius: 4px;
      font-size: 0.54rem;
      font-weight: 700;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.32);
      font-family: 'Courier New', monospace;
      transition: background 0.2s, color 0.2s, border-color 0.2s;
      flex-shrink: 0;
    }
    .cmd-cta-icon {
      font-style: normal;
      display: inline-block;
      font-size: 0.6rem;
      transition: transform 0.35s cubic-bezier(0.16,1,0.3,1);
      animation: cmdExpandPulse 2.8s ease-in-out infinite;
    }
    /* Expand/collapse via CSS grid — no JS height measurement */
    .cmd-layer-outcomes {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.4s cubic-bezier(0.16,1,0.3,1);
      flex-shrink: 0;
    }
    .cmd-layer-outcomes > .cmd-outcomes-inner {
      overflow: hidden;
      min-height: 0;
    }
    .cmd-outcomes-inner {
      padding: 0 12px 10px;
    }
    .cmd-layer.expanded .cmd-outcomes-inner {
      border-top: 1px solid rgba(var(--cmd-accent-rgb), 0.1);
    }
    .cmd-outcome {
      font-size: 0.69rem;
      line-height: 1.55;
      color: rgba(255,255,255,0.66);
      margin-bottom: 7px;
      padding-left: 13px;
      position: relative;
    }
    .cmd-outcome:last-child { margin-bottom: 0; }
    .cmd-outcome::before {
      content: '›';
      position: absolute;
      left: 0;
      color: var(--cmd-accent);
      font-weight: 700;
    }
    /* Inline highlight — inherits layer accent via CSS custom property */
    .cmd-highlight {
      background: rgba(var(--cmd-accent-rgb), 0.13);
      color: var(--cmd-accent);
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 0.94em;
    }
    /* Expanded state */
    .cmd-layer.expanded .cmd-layer-outcomes {
      grid-template-rows: 1fr;
    }
    .cmd-layer.expanded {
      background: rgba(var(--cmd-accent-rgb), 0.055);
      border-color: rgba(var(--cmd-accent-rgb), 0.35);
    }
    .cmd-layer.expanded .cmd-layer-cta {
      background: rgba(var(--cmd-accent-rgb), 0.1);
      color: var(--cmd-accent);
      border-color: rgba(var(--cmd-accent-rgb), 0.38);
    }
    .cmd-layer.expanded .cmd-cta-icon {
      transform: rotate(90deg);
      animation: none;
      opacity: 1;
    }
    /* Sibling dimming */
    .cmd-layers.has-expanded .cmd-layer:not(.expanded) {
      opacity: 0.4;
    }
    .cmd-layers.has-expanded .cmd-layer:not(.expanded) .cmd-tech-node {
      opacity: 0.7;
    }
    /* Hover — desktop only */
    @media (hover: hover) {
      .cmd-layer:not(.expanded):hover {
        background: rgba(var(--cmd-accent-rgb), 0.05);
        border-color: rgba(var(--cmd-accent-rgb), 0.28);
      }
      .cmd-layer:not(.expanded):hover .cmd-tech-node {
        background: rgba(var(--cmd-accent-rgb), 0.12);
        color: rgba(255,255,255,0.8);
        border-color: rgba(var(--cmd-accent-rgb), 0.28);
      }
      .cmd-layer:not(.expanded):hover .cmd-layer-cta {
        color: rgba(255,255,255,0.52);
        border-color: rgba(var(--cmd-accent-rgb), 0.26);
      }
    }

    /* ── Leadership bar ───────────────────────────────────────── */
    .cmd-leadership {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 9px 1.4rem;
      border-top: 1px solid rgba(0,229,204,0.1);
      background: rgba(0,0,0,0.18);
      font-size: 0.7rem;
      line-height: 1.5;
      color: rgba(255,255,255,0.46);
      flex-shrink: 0;
      animation: cmdDropIn 0.38s cubic-bezier(0.16,1,0.3,1) 0.68s both;
      will-change: transform, opacity;
    }
    .cmd-leadership-diamond {
      color: #f0a500;
      font-size: 0.75rem;
      margin-top: 1px;
      flex-shrink: 0;
    }
    .cmd-leadership p { margin: 0; }
    .cmd-leadership .cmd-highlight {
      background: rgba(240,165,0,0.12);
      color: #f0a500;
    }

    /* ── Radar ────────────────────────────────────────────────── */
    .cmd-radar {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      animation: cmdDropIn 0.38s cubic-bezier(0.16,1,0.3,1) 0.28s both;
      will-change: transform, opacity;
    }
    .cmd-radar-screen {
      width: 132px;
      height: 132px;
      border-radius: 50%;
      background: radial-gradient(circle at center,
        rgba(0,40,32,0.96) 0%,
        rgba(0,14,10,0.98) 65%,
        rgba(0,6,5,1) 100%
      );
      border: 1.5px solid rgba(0,229,204,0.26);
      position: relative;
      overflow: hidden;
      box-shadow:
        0 0 0 1px rgba(0,229,204,0.05),
        0 0 28px rgba(0,229,204,0.07),
        inset 0 0 40px rgba(0,0,0,0.55);
    }
    .cmd-radar-ring {
      position: absolute;
      top: 50%; left: 50%;
      width: var(--rs); height: var(--rs);
      border-radius: 50%;
      border: 1px solid rgba(0,229,204,0.1);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .cmd-radar-cross {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .cmd-radar-cross::before {
      content: '';
      position: absolute;
      left: 50%; top: 0;
      width: 1px; height: 100%;
      background: rgba(0,229,204,0.1);
      transform: translateX(-50%);
    }
    .cmd-radar-cross::after {
      content: '';
      position: absolute;
      top: 50%; left: 0;
      height: 1px; width: 100%;
      background: rgba(0,229,204,0.1);
      transform: translateY(-50%);
    }
    .cmd-radar-sweep {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: conic-gradient(
        from -90deg,
        transparent 0%,
        transparent 74%,
        rgba(0,229,204,0.02) 80%,
        rgba(0,229,204,0.16) 91%,
        rgba(0,229,204,0.0) 100%
      );
      animation: cmdRadarSweep 4s linear infinite;
      will-change: transform;
    }
    .cmd-radar-arm {
      position: absolute;
      top: 0; left: 50%;
      width: 1.5px; height: 50%;
      background: linear-gradient(to top, rgba(0,229,204,0.92) 0%, transparent 100%);
      transform: translateX(-50%);
      transform-origin: center bottom;
      border-radius: 1px 1px 0 0;
    }
    .cmd-radar-blip {
      position: absolute;
      left: var(--bx);
      top: var(--by);
      width: 5px; height: 5px;
      border-radius: 50%;
      background: rgba(var(--bc), 0.88);
      box-shadow: 0 0 5px 1.5px rgba(var(--bc), 0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: width 0.25s ease, height 0.25s ease, box-shadow 0.25s ease;
      z-index: 3;
    }
    .cmd-radar-blip::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: rgba(var(--bc), 0.65);
      animation: cmdBlipPing 3s ease-out infinite;
      animation-delay: var(--bd, 0s);
    }
    .cmd-radar-blip.active {
      width: 7px; height: 7px;
      box-shadow: 0 0 10px 3px rgba(var(--bc), 0.75);
    }
    .cmd-radar-blip.active::after {
      animation-name: cmdBlipActivePing;
      animation-duration: 1.1s;
    }
    .cmd-radar-footer {
      font-size: 0.41rem;
      font-weight: 700;
      letter-spacing: 0.24em;
      color: rgba(0,229,204,0.25);
      text-transform: uppercase;
      font-family: 'Courier New', monospace;
    }

    /* ── Status ticker ────────────────────────────────────────── */
    .cmd-status-bar {
      position: relative;
      z-index: 2;
      height: 22px;
      background: rgba(0,229,204,0.028);
      border-top: 1px solid rgba(0,229,204,0.09);
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      animation: cmdDropIn 0.38s cubic-bezier(0.16,1,0.3,1) 0.78s both;
      will-change: transform, opacity;
    }
    .cmd-ticker-track {
      display: inline-flex;
      align-items: center;
      animation: cmdTickerScroll 30s linear infinite;
      white-space: nowrap;
    }
    .cmd-ticker-item {
      font-size: 0.49rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(0,229,204,0.38);
      font-family: 'Courier New', monospace;
      padding: 0 2.2rem;
    }
    .cmd-ticker-sep {
      color: rgba(0,229,204,0.16);
      font-size: 0.49rem;
      font-family: 'Courier New', monospace;
    }

    /* ── Mobile ───────────────────────────────────────────────── */
    @media (max-width: 720px) {
      #cinematic-content.ops-center {
        max-width: calc(100vw - 1.5rem);
      }
      #cinematic-content.ops-center #cinematic-panel-body {
        overflow-y: auto;
      }
      .cmd-hud {
        flex: none;
        min-height: auto;
        overflow: visible;
      }
      .cmd-header {
        flex-direction: column;
        align-items: flex-start;
        padding: 1rem 1.2rem 0.75rem;
        gap: 0.6rem;
      }
      .cmd-radar { display: none; }
      .cmd-header-stats { gap: 5px; }
      .cmd-stat { padding: 3px 7px; }
      .cmd-stat-value { font-size: 0.75rem; }
      .cmd-title { font-size: 1.25rem; }
      .cmd-layers {
        grid-template-columns: 1fr;
        align-items: stretch;
        padding: 0.7rem 0.9rem;
        gap: 7px;
        overflow: visible;
        flex: none;
      }
      .cmd-layer-sys { display: none; }
      .cmd-layer-head { padding: 8px 10px 5px; }
      .cmd-layer-tech { padding: 0 10px 7px; }
      .cmd-layer-cta { margin: 0 10px 8px; }
      .cmd-outcomes-inner { padding: 0 10px 8px; }
      .cmd-outcome { font-size: 0.67rem; }
      .cmd-leadership { padding: 8px 1.1rem; font-size: 0.66rem; }
    }
    /* ── Responsive ──────────────────────────────────────────────── */
    @media (max-width: 600px) {
      #cinematic-content.has-image {
        flex-direction: column;
        max-width: calc(100% - 2rem);
      }
      #cinematic-card {
        flex-direction: column;
      }
      #cinematic-img-panel {
        width: 100% !important;
        min-width: unset !important;
        height: 160px;
        flex-shrink: 0;
      }
      #cinematic-img-fade {
        background: linear-gradient(
          to bottom,
          transparent 35%,
          rgba(10,15,30,0.85) 75%,
          rgba(10,15,30,1) 100%
        ) !important;
      }
      #cinematic-panel-body {
        padding: 1.2rem 1.4rem 1.3rem !important;
      }
      /* Move close button to top-left so it doesn't clash with Resume button (top-right) */
      #cinematic-close {
        right: auto !important;
        left: 0 !important;
      }
      /* Hide ESC key hint on mobile — no keyboard */
      #cinematic-close .esc-key {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Overlay DOM ───────────────────────────────────────────────────────────────

function getOrCreateOverlay(): {
  overlay: HTMLDivElement;
  content: HTMLDivElement;
  card: HTMLDivElement;
} {
  if (overlayEl && contentEl && cardEl)
    return { overlay: overlayEl, content: contentEl, card: cardEl };

  injectStyles();
  injectHighlightStyles();
  injectChipStyles();

  const overlay = document.createElement("div");
  overlay.id = "cinematic-overlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  `;

  // Dim/blur backdrop
  const dimLayer = document.createElement("div");
  dimLayer.id = "cinematic-dim";
  dimLayer.style.cssText = `
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0);
    backdrop-filter: blur(0px);
    transition: background 0.5s ease-out, backdrop-filter 0.5s ease-out;
    pointer-events: auto;
    cursor: pointer;
  `;
  dimLayer.onclick = () => {
    if (isOpen && currentCamera) {
      const cam = currentCamera;
      currentCamera = null;
      const onClosedCb = currentOnClosed;
      const getReturn = currentGetReturnTarget;
      doClose(cam, getReturn);
      onClosedCb?.();
    }
  };
  overlay.appendChild(dimLayer);

  // Animation wrapper — translateY slide + opacity (no visual styles)
  const content = document.createElement("div");
  content.id = "cinematic-content";
  overlay.appendChild(content);

  // Close button — sibling of card (NOT inside tilt target) so it never runs away
  const closeBtn = document.createElement("button");
  closeBtn.id = "cinematic-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = `
    <span class="close-icon-wrap">
      <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 2L8 8M8 2L2 8" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </span>
    <span>Close</span>
    <span class="esc-key">ESC</span>
  `;
  content.appendChild(closeBtn);

  // Visual card — all the styling + tilt effect lives here
  const card = document.createElement("div");
  card.id = "cinematic-card";
  card.innerHTML = `
    <div id="cinematic-top-bar"></div>

    <div id="cinematic-img-panel">
      <img id="cinematic-img" src="" alt="" />
      <div id="cinematic-img-fade"></div>
      <div id="cinematic-img-scanlines"></div>
      <div id="cinematic-img-caption"></div>
    </div>

    <div id="cinematic-panel-body">
      <div id="cinematic-year-tag"></div>
      <div id="cinematic-company-row">
        <div id="cinematic-logo-wrap"><img id="cinematic-logo-img" src="" alt="" /></div>
        <h2 id="cinematic-company"></h2>
      </div>
      <p id="cinematic-role"></p>
      <p id="cinematic-period"></p>
      <p id="cinematic-context"></p>
      <div id="cinematic-divider"></div>
      <p id="cinematic-description-text"></p>
      <ul id="cinematic-bullets-list"></ul>
      <div id="cinematic-skills">
        <div id="cinematic-skills-label">Tech Stack</div>
        <div id="cinematic-skills-chips"></div>
      </div>
    </div>
  `;
  content.appendChild(card);

  const backdropHint = document.createElement("div");
  backdropHint.id = "cinematic-backdrop-hint";
  backdropHint.textContent = "click backdrop to close";
  content.appendChild(backdropHint);

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && isOpen && currentCamera) {
      const cam = currentCamera;
      currentCamera = null;
      const onClosedCb = currentOnClosed;
      const getReturn = currentGetReturnTarget;
      doClose(cam, getReturn);
      onClosedCb?.();
    }
  });

  document.body.appendChild(overlay);
  overlayEl = overlay;
  contentEl = content;
  cardEl = card;

  // Save standard panel body template so ops-center can restore it
  gatePanelBodyHTML = (card.querySelector("#cinematic-panel-body") as HTMLElement).innerHTML;

  initPhotoLightbox();

  // Attach tilt to the visual card (pointer-events auto via parent content)
  addTiltEffect(card, {
    maxRotation: 10,
    scale: 1.03,
    lerpFactor: 0.08,
    accentColor: "0, 229, 204",
  });

  return { overlay, content, card };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let currentCamera: THREE.PerspectiveCamera | null = null;
let currentOnClosed: (() => void) | undefined;
let currentGetReturnTarget:
  | (() => { position: THREE.Vector3; lookAt: THREE.Vector3 })
  | undefined;
let zoomLookTarget: THREE.Vector3 | null = null;

export function isTransitionOpen(): boolean {
  return isOpen || isTransitioning;
}

function parseTitleParts(title: string): {
  year: string;
  company: string;
  role: string;
} {
  const parts = title.split(" — ");
  if (parts.length >= 3) {
    return { year: parts[0], company: parts[1], role: parts.slice(2).join(" — ") };
  }
  if (parts.length === 2) {
    return { year: parts[0], company: parts[1], role: "" };
  }
  return { year: "", company: title, role: "" };
}

// ── Content stagger entrance ──────────────────────────────────────────────────

function applyContentStagger(card: HTMLDivElement): void {
  const spring  = "cubic-bezier(0.16,1,0.3,1)";
  const elastic = "cubic-bezier(0.34,1.56,0.64,1)";

  // Helper: animate an element if it exists and is not display:none
  const anim = (
    sel: string,
    delay: number,
    kf = "ctFadeSlideUp",
    dur = "0.38s",
    ease = spring,
  ) => {
    const el = card.querySelector<HTMLElement>(sel);
    if (!el || el.style.display === "none") return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = `${kf} ${dur} ${ease} ${delay}ms both`;
  };

  // Sequential reveal: header → meta → content → tech
  anim("#cinematic-year-tag.visible",    0);
  anim("#cinematic-company-row",        55);
  anim("#cinematic-role",              108);
  anim("#cinematic-period",            148);
  anim("#cinematic-context.visible",   198);
  anim("#cinematic-divider",           248);

  // Bullets stagger
  let d = 292;
  card.querySelectorAll<HTMLElement>("#cinematic-bullets-list li").forEach((li, i) => {
    li.style.animation = "none";
    void li.offsetWidth;
    li.style.animation = `ctFadeSlideUp 0.3s ${spring} ${d + i * 50}ms both`;
  });
  d += (card.querySelectorAll("#cinematic-bullets-list li").length * 50) + 40;

  // Skills label + chips elastic pop
  const skillsEl = card.querySelector<HTMLElement>("#cinematic-skills.visible");
  if (skillsEl) {
    const label = skillsEl.querySelector<HTMLElement>("#cinematic-skills-label");
    if (label) {
      label.style.animation = "none";
      void label.offsetWidth;
      label.style.animation = `ctFadeSlideUp 0.3s ${spring} ${d}ms both`;
    }
    d += 52;
    skillsEl.querySelectorAll<HTMLElement>("#cinematic-skills-chips span").forEach((chip, i) => {
      chip.style.animation = "none";
      void chip.offsetWidth;
      chip.style.animation = `ctChipPop 0.36s ${elastic} ${d + i * 28}ms both`;
    });
  }

  // Animate top accent bar
  const topBar = card.querySelector<HTMLElement>("#cinematic-top-bar");
  if (topBar) {
    topBar.classList.remove("ct-reveal");
    void topBar.offsetWidth;
    topBar.classList.add("ct-reveal");
  }
}

// ── Command Center HUD — Game-native holographic interface ───────────────────

/** Wraps {text} markers in highlight spans (inherits layer accent via CSS vars). */
function highlightBraces(text: string): string {
  return text.replace(/\{([^}]+)\}/g, '<span class="cmd-highlight">$1</span>');
}

function buildCommandHudHTML(data: StopData): string {
  const layers = data.layers ?? [];

  // Blip config: position and color-rgb for each layer id
  const BLIPS: Record<string, { bx: string; by: string; bc: string; bd: string }> = {
    frontend: { bx: "30%", by: "26%", bc: "78,205,196",  bd: "0s" },
    backend:  { bx: "72%", by: "54%", bc: "240,165,0",   bd: "0.9s" },
    infra:    { bx: "28%", by: "72%", bc: "139,126,200", bd: "1.8s" },
  };

  const radarHTML = `
    <div class="cmd-radar">
      <div class="cmd-radar-screen">
        <div class="cmd-radar-ring" style="--rs:32%"></div>
        <div class="cmd-radar-ring" style="--rs:60%"></div>
        <div class="cmd-radar-ring" style="--rs:90%"></div>
        <div class="cmd-radar-cross"></div>
        <div class="cmd-radar-sweep"><div class="cmd-radar-arm"></div></div>
        ${layers.map((l) => {
          const b = BLIPS[l.id];
          if (!b) return "";
          return `<div class="cmd-radar-blip" data-blip="${l.id}" style="--bx:${b.bx};--by:${b.by};--bc:${b.bc};--bd:${b.bd}"></div>`;
        }).join("")}
      </div>
      <div class="cmd-radar-footer">TACTICAL SCAN</div>
    </div>`;

  const statsHTML = `
    <div class="cmd-header-stats">
      <div class="cmd-stat">
        <span class="cmd-stat-value">20+</span>
        <span class="cmd-stat-label">SERVICES</span>
      </div>
      <div class="cmd-stat">
        <span class="cmd-stat-value">100K+</span>
        <span class="cmd-stat-label">USERS</span>
      </div>
      <div class="cmd-stat">
        <span class="cmd-stat-value">100+</span>
        <span class="cmd-stat-label">LIBS</span>
      </div>
    </div>`;

  const layersHTML = layers.map((layer, i) => {
    const techHTML = layer.pills
      .map((p) => `<span class="cmd-tech-node">${p}</span>`)
      .join("");
    const outcomesHTML = layer.bullets
      .map((b) => `<p class="cmd-outcome">${highlightBraces(b)}</p>`)
      .join("");
    return `
      <div class="cmd-layer"
           data-layer-id="${layer.id}"
           style="--cmd-accent:${layer.accent};--cmd-accent-rgb:${layer.accentRgb};">
        <div class="cmd-layer-head">
          <span class="cmd-layer-sys">SYS-0${i + 1}</span>
          <span class="cmd-layer-name">${layer.label}</span>
          <div class="cmd-metric-row">
            <div class="cmd-metric-bar"><div class="cmd-metric-fill"></div></div>
            <span class="cmd-metric-value">${layer.metric}</span>
          </div>
        </div>
        <div class="cmd-layer-tech">${techHTML}</div>
        <div class="cmd-layer-cta">
          <i class="cmd-cta-icon">▶</i>
          <span>DETAILS</span>
        </div>
        <div class="cmd-layer-outcomes">
          <div class="cmd-outcomes-inner">${outcomesHTML}</div>
        </div>
      </div>`;
  }).join("");

  const leadershipHTML = data.leadershipBar
    ? `<div class="cmd-leadership">
        <span class="cmd-leadership-diamond">◆</span>
        <p>${highlightBraces(data.leadershipBar)}</p>
      </div>`
    : "";

  const TICKER_ITEMS = [
    "SYS: ONLINE", "LAYERS: 3", "SERVICES: 20+",
    "USERS: 100K+", "LIBRARIES: 100+", "UPTIME: 2018–PRESENT",
    "STATUS: OPERATIONAL", "TEAM: ~24 DEVS",
  ];
  const tickerOnce = TICKER_ITEMS.map(
    (t) => `<span class="cmd-ticker-item">${t}</span><span class="cmd-ticker-sep">·</span>`,
  ).join("");

  return `
    <div class="cmd-hud">
      <div class="cmd-scanon"></div>
      <div class="cmd-corner cmd-corner--tl"></div>
      <div class="cmd-corner cmd-corner--tr"></div>
      <div class="cmd-corner cmd-corner--bl"></div>
      <div class="cmd-corner cmd-corner--br"></div>
      <div class="cmd-header">
        <div class="cmd-header-left">
          <span class="cmd-eyebrow">◈ COMMAND CENTER ◈</span>
          <h2 class="cmd-title">${data.title}</h2>
          <p class="cmd-meta">${data.subtitle ?? ""}</p>
          ${statsHTML}
        </div>
        ${radarHTML}
      </div>
      <div class="cmd-layers">${layersHTML}</div>
      ${leadershipHTML}
      <div class="cmd-status-bar">
        <div class="cmd-ticker-track">${tickerOnce}${tickerOnce}</div>
      </div>
    </div>`;
}

function initCommandHud(container: HTMLElement): void {
  const layers = container.querySelectorAll<HTMLElement>(".cmd-layer");
  const layersWrap = container.querySelector<HTMLElement>(".cmd-layers");

  const getBlip = (layerId: string) =>
    container.querySelector<HTMLElement>(`.cmd-radar-blip[data-blip="${layerId}"]`);

  // Trigger metric bar fill after columns have animated in
  setTimeout(() => {
    layers.forEach((l) => l.classList.add("activated"));
  }, 700);

  layers.forEach((layer) => {
    layer.addEventListener("click", () => {
      const layerId = layer.dataset.layerId ?? "";
      const wasExpanded = layer.classList.contains("expanded");
      const currentExpanded = layersWrap?.querySelector<HTMLElement>(".cmd-layer.expanded");

      // Deactivate all blips immediately
      container.querySelectorAll<HTMLElement>(".cmd-radar-blip").forEach((b) =>
        b.classList.remove("active"),
      );

      if (wasExpanded) {
        // Clicking the open card: just close it
        layer.classList.remove("expanded");
        layersWrap?.classList.remove("has-expanded");
      } else if (currentExpanded && currentExpanded !== layer) {
        // A different card is open: close it first, then open new one
        currentExpanded.classList.remove("expanded");
        // Brief pause so the collapse animation has started before expansion begins
        setTimeout(() => {
          layer.classList.add("expanded");
          layersWrap?.classList.add("has-expanded");
          getBlip(layerId)?.classList.add("active");
        }, 220);
      } else {
        // Nothing open: open immediately
        layer.classList.add("expanded");
        layersWrap?.classList.add("has-expanded");
        getBlip(layerId)?.classList.add("active");
      }
    });
  });
}

// ── Open / close ──────────────────────────────────────────────────────────────

export function openTransition(
  data: StopData,
  stopWorldPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  onClosed?: () => void,
  getCameraReturnTarget?: () => {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
  },
): void {
  if (isTransitioning || isOpen) return;
  isTransitioning = true;
  currentCamera = camera;
  currentOnClosed = onClosed;
  currentGetReturnTarget = getCameraReturnTarget;

  const { overlay, content, card } = getOrCreateOverlay();
  const dimLayer = overlay.querySelector("#cinematic-dim") as HTMLDivElement;
  const panelBody = card.querySelector<HTMLElement>("#cinematic-panel-body")!;

  // ── Populate elements ──────────────────────────────────────────────────────

  if (data.id === "ops-center") {
    // ── Bespoke Ops Center layout ──────────────────────────────────────────
    content.classList.add("ops-center");
    content.classList.remove("has-image", "no-image");
    content.classList.add("no-image");

    // Detach previous zoom hint
    detachImgZoom?.();
    detachImgZoom = null;

    panelBody.innerHTML = buildCommandHudHTML(data);
    initCommandHud(panelBody);

    // ── Animate in ─────────────────────────────────────────────────────────
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    document.body.classList.add("transition-open");
    content.style.transform = "translateY(40px)";
    content.style.opacity = "0";
    dimLayer.style.background = "rgba(0,0,0,0)";
    dimLayer.style.backdropFilter = "blur(0px)";

    const zoomTarget = new THREE.Vector3(stopWorldPos.x + 1.5, stopWorldPos.y + 5, stopWorldPos.z + 2);
    const lookTarget = new THREE.Vector3(stopWorldPos.x, stopWorldPos.y + 0.5, stopWorldPos.z);
    zoomLookTarget = lookTarget.clone();
    const startPos = camera.position.clone();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const startTarget = camera.position.clone().add(camDir);
    const startTime = performance.now();

    function animateCameraOps(): void {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / DURATION_MS, 1);
      const eased = EASE_OUT(t);
      camera.position.lerpVectors(startPos, zoomTarget, eased);
      camera.lookAt(new THREE.Vector3().lerpVectors(startTarget, lookTarget, eased));
      if (t < 1) requestAnimationFrame(animateCameraOps);
      else { isTransitioning = false; isOpen = true; }
    }
    requestAnimationFrame(animateCameraOps);

    requestAnimationFrame(() => {
      dimLayer.style.background = "rgba(0,0,0,0.68)";
      dimLayer.style.backdropFilter = "blur(10px)";
      content.style.transform = "translateY(0)";
      content.style.opacity = "1";
      // Animate top accent bar
      const topBar = card.querySelector<HTMLElement>("#cinematic-top-bar");
      if (topBar) {
        topBar.classList.remove("ct-reveal");
        void topBar.offsetWidth;
        topBar.classList.add("ct-reveal");
      }
    });

    const handleCloseOps = () => {
      if (!isOpen || !currentCamera) return;
      const cam = currentCamera;
      currentCamera = null;
      const onClosedCb = currentOnClosed;
      const getReturn = currentGetReturnTarget;
      doClose(cam, getReturn);
      onClosedCb?.();
    };
    (content.querySelector("#cinematic-close") as HTMLButtonElement).onclick = handleCloseOps;
    overlay.onclick = (e) => {
      if (isOpen && (e.target === overlay || (e.target as Element).id === "cinematic-dim")) handleCloseOps();
    };
    return;
  }

  // ── Standard gate layout ──────────────────────────────────────────────────

  // Restore panel body if it was replaced by ops-center last time
  if (content.classList.contains("ops-center") && gatePanelBodyHTML) {
    panelBody.innerHTML = gatePanelBodyHTML;
  }
  content.classList.remove("ops-center");

  const { year, company, role } = parseTitleParts(data.title);

  const yearTagEl = card.querySelector("#cinematic-year-tag") as HTMLDivElement;
  const companyEl = card.querySelector("#cinematic-company") as HTMLHeadingElement;
  const roleEl = card.querySelector("#cinematic-role") as HTMLParagraphElement;
  const periodEl = card.querySelector("#cinematic-period") as HTMLParagraphElement;
  const dividerEl = card.querySelector("#cinematic-divider") as HTMLDivElement;
  const descEl = card.querySelector("#cinematic-description-text") as HTMLParagraphElement;
  const bulletsEl = card.querySelector("#cinematic-bullets-list") as HTMLUListElement;
  const skillsEl = card.querySelector("#cinematic-skills") as HTMLDivElement;
  const skillsChipsEl = card.querySelector("#cinematic-skills-chips") as HTMLDivElement;
  const imgEl = card.querySelector("#cinematic-img") as HTMLImageElement;
  const imgCaptionEl = card.querySelector("#cinematic-img-caption") as HTMLDivElement;
  const contextEl = card.querySelector("#cinematic-context") as HTMLParagraphElement;
  const logoWrap = card.querySelector("#cinematic-logo-wrap") as HTMLDivElement;
  const logoImg = card.querySelector("#cinematic-logo-img") as HTMLImageElement;

  if (year) {
    yearTagEl.textContent = year;
    yearTagEl.classList.add("visible");
  } else {
    yearTagEl.classList.remove("visible");
  }

  companyEl.textContent = company || data.title;

  if (data.logo) {
    logoImg.src = data.logo;
    logoImg.alt = company;
    logoWrap.classList.add("visible");
  } else {
    logoImg.src = "";
    logoWrap.classList.remove("visible");
  }

  if (role) {
    roleEl.textContent = role;
    roleEl.style.display = "block";
  } else {
    roleEl.style.display = "none";
  }

  if (data.subtitle) {
    periodEl.textContent = data.subtitle;
    periodEl.style.display = "block";
  } else {
    periodEl.style.display = "none";
  }

  if (data.companyContext) {
    contextEl.innerHTML = highlight(data.companyContext);
    contextEl.classList.add("visible");
  } else {
    contextEl.innerHTML = "";
    contextEl.classList.remove("visible");
  }

  const hasBelowContent = !!(data.bullets?.length || data.description);
  dividerEl.style.display = hasBelowContent ? "block" : "none";

  if (!data.bullets?.length && data.description) {
    descEl.textContent = data.description;
    descEl.style.display = "block";
  } else {
    descEl.style.display = "none";
  }

  if (data.bullets && data.bullets.length > 0) {
    bulletsEl.innerHTML = data.bullets.map((b) => `<li>${highlight(b)}</li>`).join("");
    bulletsEl.style.display = "block";
  } else {
    bulletsEl.innerHTML = "";
    bulletsEl.style.display = "none";
  }

  if (data.skills && data.skills.length > 0) {
    skillsChipsEl.innerHTML = data.skills.map(renderChip).join("");
    skillsEl.classList.add("visible");
  } else {
    skillsChipsEl.innerHTML = "";
    skillsEl.classList.remove("visible");
  }

  // Detach any previous zoom hint before re-attaching
  detachImgZoom?.();
  detachImgZoom = null;

  const imgPanelEl = card.querySelector<HTMLDivElement>("#cinematic-img-panel")!;

  if (data.image) {
    imgEl.src = data.image;
    imgEl.alt = data.imageCaption ?? company;
    imgCaptionEl.textContent = data.imageCaption ?? "";
    content.classList.add("has-image");
    content.classList.remove("no-image");

    // Attach zoom-in lightbox to the image panel
    const captionText = data.imageCaption ?? company;
    detachImgZoom = attachZoomHint(
      imgPanelEl,
      () => data.image!,
      { shape: "rect", caption: captionText, hintSize: 22 },
    );
  } else {
    imgEl.src = "";
    content.classList.remove("has-image");
    content.classList.add("no-image");
  }

  // ── Animate in ────────────────────────────────────────────────────────────

  overlay.style.display = "flex";
  overlay.style.pointerEvents = "auto";
  document.body.classList.add("transition-open");
  content.style.transform = "translateY(40px)";
  content.style.opacity = "0";
  dimLayer.style.background = "rgba(0,0,0,0)";
  dimLayer.style.backdropFilter = "blur(0px)";

  const zoomTarget = new THREE.Vector3(
    stopWorldPos.x + 1.5,
    stopWorldPos.y + 5,
    stopWorldPos.z + 2,
  );
  const lookTarget = new THREE.Vector3(
    stopWorldPos.x,
    stopWorldPos.y + 0.5,
    stopWorldPos.z,
  );
  zoomLookTarget = lookTarget.clone();

  const startPos = camera.position.clone();
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const startTarget = camera.position.clone().add(camDir);
  const startTime = performance.now();

  function animateCamera(): void {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / DURATION_MS, 1);
    const eased = EASE_OUT(t);

    camera.position.lerpVectors(startPos, zoomTarget, eased);
    const currentLook = new THREE.Vector3().lerpVectors(
      startTarget,
      lookTarget,
      eased,
    );
    camera.lookAt(currentLook);

    if (t < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      isTransitioning = false;
      isOpen = true;
    }
  }

  requestAnimationFrame(animateCamera);

  requestAnimationFrame(() => {
    dimLayer.style.background = "rgba(0,0,0,0.68)";
    dimLayer.style.backdropFilter = "blur(10px)";
    content.style.transform = "translateY(0)";
    content.style.opacity = "1";
    applyContentStagger(card);
  });

  // Close handlers
  const handleClose = () => {
    if (!isOpen || !currentCamera) return;
    const cam = currentCamera;
    currentCamera = null;
    const onClosedCb = currentOnClosed;
    const getReturn = currentGetReturnTarget;
    doClose(cam, getReturn);
    onClosedCb?.();
  };

  const closeBtn = content.querySelector("#cinematic-close") as HTMLButtonElement;
  closeBtn.onclick = handleClose;

  overlay.onclick = (e) => {
    if (
      isOpen &&
      (e.target === overlay || (e.target as Element).id === "cinematic-dim")
    ) {
      handleClose();
    }
  };
}

function doClose(
  camera: THREE.PerspectiveCamera,
  getReturnTarget?: () => { position: THREE.Vector3; lookAt: THREE.Vector3 },
): void {
  if (!overlayEl || !contentEl) return;
  isOpen = false;
  isTransitioning = true;

  const dimLayer = overlayEl.querySelector("#cinematic-dim") as HTMLDivElement;

  dimLayer.style.background = "rgba(0,0,0,0)";
  dimLayer.style.backdropFilter = "blur(0px)";
  contentEl.style.transform = "translateY(20px)";
  contentEl.style.opacity = "0";

  const startPos = camera.position.clone();
  const target = getReturnTarget?.() ?? {
    position: HOME_POSITION.clone(),
    lookAt: HOME_TARGET.clone(),
  };
  const startTime = performance.now();

  function animateCameraBack(): void {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / DURATION_MS, 1);
    const eased = EASE_OUT(t);

    camera.position.lerpVectors(startPos, target.position, eased);
    const currentLook = new THREE.Vector3().lerpVectors(
      zoomLookTarget ?? target.lookAt,
      target.lookAt,
      eased,
    );
    camera.lookAt(currentLook);

    if (t < 1) {
      requestAnimationFrame(animateCameraBack);
    } else {
      isTransitioning = false;
      overlayEl!.style.display = "none";
      overlayEl!.style.pointerEvents = "none";
      document.body.classList.remove("transition-open");
    }
  }

  setTimeout(() => requestAnimationFrame(animateCameraBack), 150);
}
