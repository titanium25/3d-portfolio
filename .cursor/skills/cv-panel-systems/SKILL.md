---
name: cv-panel-systems
description: Reference for the CV panel's interconnected systems — photo lightbox zoom, 3D object discovery tracker, tab "new" indicators, journey experience unlock logic, hover photo panel, film strip indicators, and game toast. Use when modifying, extending, or debugging any of these systems in the 3d-portfolio project.
---

# CV Panel Systems — Quick Reference

Four tightly integrated systems power the CV panel's game mechanics. Each follows a consistent pattern: **trigger → state update → visual reward → cross-module notification**.

---

## 1. Photo Lightbox Zoom

**File:** `src/ui/photoLightbox.ts`

**Pattern:** Attach zoom affordance to any container → click opens FLIP-animated full-screen lightbox.

**Key exports:**
- `initPhotoLightbox()` — create DOM once
- `openPhotoLightbox(src, triggerEl, options?)` — FLIP from trigger to center
- `closePhotoLightbox()` — FLIP back or fade out
- `attachZoomHint(container, getSrc, options?)` — adds `cursor: zoom-in`, `⊕` hover overlay, click handler. Returns detach function.

**Options:** `{ shape: 'circle' | 'rect', caption?: string, hintSize?: number }`

**Conditional zoom (gating pattern):**
Return empty string from `getSrc` to block opening:
```typescript
attachZoomHint(photoEl, () =>
  photoEl.classList.contains("cv-photo-locked") ? "" : photoSrc,
  { shape: "rect", caption: photoCap }
);
```

**CSS suppression for locked state:**
```css
.cv-exp-photo.cv-photo-locked.plb-trigger { cursor: default; }
.cv-exp-photo.cv-photo-locked .plb-trigger-hint { display: none !important; }
```

**Where used:**
- CV headshot avatar (circle shape)
- Journey tab experience photos (rect, blocked while `cv-photo-locked`)
- About tab hover photo panel gallery (rect, blocked while not `.cpp-discovered`)

**Adding zoom to a new element:**
```typescript
import { attachZoomHint } from "./photoLightbox";
attachZoomHint(container, () => imgUrl, { shape: "rect", caption: "..." });
```

---

## 2. Discovery Tracker

**File:** `src/ui/discoveryTracker.ts`

**Pattern:** Click 3D object → `markDiscovered(id)` → toast + motes + badge + tab indicator.

**State:** Session-only `Set<string>`. No persistence.

**Discovery IDs:** `bmw`, `mtb`, `meny`, `monogram` (4 total, defined in `DISCOVERY_IDS`)

**Key exports:**
- `markDiscovered(id: DiscoveryId): boolean` — returns `true` on first discovery. Triggers: `addDiscoveryToBadge()`, `showGameToast(...)`, 4/4 bonus toast.
- `isDiscovered(id: string): boolean` — queried by `cvPanel.ts` → `refreshDynamicContent()`
- `getDiscoveryCount(): number`

**Reward chain on first discovery:**
1. `addDiscoveryToBadge()` — bumps Resume button badge count
2. `showGameToast({ icon, category, title, subtitle, hint })` — game notification card
3. `playDiscoveryMotes(screenX, screenY)` — 3 amber motes fly to Resume button (called from `worldTooltip.ts`)
4. `markAboutTabNew()` — pulsing dot on About tab

**Integration in `worldTooltip.ts`:**
Each target registered with `discoveryId` and `onClick`:
```typescript
registerTooltipTarget({
  object: bikeGroup,
  title: "BMW S1000RR",
  subtitle: "...",
  discoveryId: "bmw",
  onClick: () => markDiscovered("bmw"),
  onHoverStart: () => { /* emissive boost */ },
  onHoverEnd: () => { /* restore */ },
});
```

**Adding a new discoverable object:**
1. Add ID to `DISCOVERY_IDS` array and `DiscoveryId` type
2. Add entries to `DISCOVERY_LABELS`, `DISCOVERY_SUBTITLES`, `DISCOVERY_HINTS`
3. Register with `registerTooltipTarget` in `App.ts` including `discoveryId` and `onClick`
4. Optionally add photos to `CARD_PHOTOS` in `cvPanel.ts` and `data-photo-album` to the card HTML

---

## 3. Tab "New" Indicators

**File:** `src/ui/gateUnlockAnimation.ts`

**Pattern:** Event fires → `markXTabNew()` → pulsing dot on tab button → cleared on tab click.

**Two parallel systems, identical pattern:**

| System | Mark function | Clear function | Apply to DOM | Trigger |
|--------|-------------|----------------|-------------|---------|
| About tab | `markAboutTabNew()` | `clearAboutTabNew()` | `applyAboutTabNewToDom()` | Discovery motes arrive |
| Journey tab | `markJourneyTabNew()` | `clearJourneyTabNew()` | `applyJourneyTabNewToDom()` | Gate unlock revelation phase |

**DOM:** Adds `.cv-tab-btn-new` class + `.cv-tab-new-dot` span (pulsing amber dot) to the tab button.

**CSS:** `tabNewPulse` animation — pulsing gold dot.

**Integration in `cvPanel.ts`:**
```typescript
// On panel open — restore pending indicators
applyAboutTabNewToDom();
applyJourneyTabNewToDom();

// On tab switch — clear when user sees the content
if (tabId === "about")   clearAboutTabNew();
if (tabId === "journey") clearJourneyTabNew();
```

**Adding a new tab indicator:**
1. Add `let xTabNewPending = false;` state variable
2. Copy `markAboutTabNew` / `clearAboutTabNew` / `applyAboutTabNewToDom` pattern
3. Export all three functions
4. Call `mark` from the trigger, `clear` from `switchTab`, `apply` from `openCVPanel`

---

## 4. Experience Unlock Logic (Journey Tab)

**Pattern:** Gate walk-through → `markStopCompleted(id)` → `refreshDynamicContent()` on panel open → visual enhancements.

**Gate completion triggers (in `App.ts`):**
```typescript
const isFirstUnlock = markStopCompleted(stopId);
if (isFirstUnlock) {
  pulseGateOnUnlock(stopId);          // 3D emissive flash
  setTimeout(() => playCinematicUnlock(...), 600); // motes + toast
}
```

**`refreshDynamicContent()` checks per entry:**
1. **`✦ Explored` badge**: appended to `.cv-exp-meta` if not already present
2. **Timeline line → `.active`**: cyan glow upgrade
3. **Photo unlock**: removes `.cv-photo-locked` from journey photo (reveals blurred→clear transition)
4. **Shimmer**: `cvShimmer` keyframe plays once on newly-seen completions
5. **Dot nav**: `.completed` class added to corresponding dot-nav item

**Journey photo lock pattern:**
HTML starts locked:
```html
<div class="cv-exp-photo cv-photo-locked" data-photo-id="the5ers">
  <div class="cv-photo-teaser">
    <span class="cv-photo-teaser-icon">🔒</span>
    <span class="cv-photo-teaser-text">Walk through<br>the gate</span>
  </div>
  <img src="..." />
</div>
```
Unlock: `photo.classList.remove("cv-photo-locked")` — CSS transitions handle the reveal.

---

## 5. Game Toast System

**File:** `src/ui/gateUnlockAnimation.ts` → `showGameToast(opts)`

**Used by:** Gate unlock revelation, discovery tracker, 4/4 completion bonus.

**Options interface:**
```typescript
interface GameToastOptions {
  icon: string;        // glyph in icon column (✦, ◆, ★)
  category: string;    // small caps label (MILESTONE EXPLORED, OBJECT DISCOVERED)
  title: string;       // main text
  subtitle: string;    // smaller text below
  hint?: string;       // optional cyan line below subtitle
  isFinal?: boolean;   // gold accent for completion
  holdMs?: number;     // display duration (default 2500)
}
```

**Features:** Icon column, shimmer sweep (`toastShimmer`), drain bar (`toastDrain`), scale spring entry, auto-dismiss previous toast.

---

## 6. Hover Photo Panel (About Tab)

**File:** `src/ui/cvPanel.ts` (bottom section)

**Photo data:** `CARD_PHOTOS` record — keyed by album name (`bmw`, `mtb`, `meny`, `lego`).

**`PhotoEntry`:** `{ src, caption, objectPosition? }` — `objectPosition` controls per-image crop.

**States:**
- **Teaser** (undiscovered): softly blurred image, ⬡ icon, "Hidden" badge, CRT scanlines, shimmer
- **Gallery** (discovered or always-open): swipeable photos, `<`/`>` nav, dots, caption, lightbox zoom

**Toggle:** `#cv-photo-panel.cpp-discovered` class controls CSS visibility of teaser vs gallery wrap.

**Adding photos to a card:**
1. Add entry to `CARD_PHOTOS` with `src`, `caption`, `objectPosition`
2. Add `data-photo-album="key"` to the card HTML
3. If gated by discovery, also add `data-discovery-id="key"`

---

## Cross-Module Flow Diagram

```
3D Click (worldTooltip.ts)
  └─ markDiscovered() (discoveryTracker.ts)
       ├─ addDiscoveryToBadge() → refreshProgressDots() (gateUnlockAnimation.ts)
       ├─ showGameToast() with hint (gateUnlockAnimation.ts)
       └─ [from worldTooltip.ts] playDiscoveryMotes() → markAboutTabNew()

Gate E Press (App.ts)
  └─ markStopCompleted() (createTimelineStops.ts)
       ├─ pulseGateOnUnlock() — 3D emissive flash
       └─ playCinematicUnlock() (gateUnlockAnimation.ts)
            ├─ Phase 0: vignette flash
            ├─ Phase 1: 6 motes → Resume button
            ├─ Phase 2: badge pop + sonar
            └─ Phase 3: markJourneyTabNew() + toast

CV Panel Open (cvPanel.ts)
  └─ refreshDynamicContent()
       ├─ isStopCompleted() → badge, photo unlock, shimmer
       ├─ isDiscovered() → card state, photo panel toggle
       └─ applyAboutTabNewToDom() + applyJourneyTabNewToDom()
```
