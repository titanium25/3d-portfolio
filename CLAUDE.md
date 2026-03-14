---
description:
alwaysApply: true
---

# CLAUDE.md - 3D Portfolio Project Guide

## Project Overview

Interactive 3D portfolio built with Three.js, TypeScript, and Vite. Visitors navigate a character through a stylized 3D landscape, discovering career milestones at portal gates along a Timeline Bridge. Top-down angled camera, open-world game feel.

### Core Concept

- **Map**: Hexagonal floating platform (arena) + Timeline Bridge + Spawn Pad
- **Timeline Gates**: 4 portal gates on the bridge, each a career milestone (ASML 2018, Restigo 2022, Triolla 2023, The5ers 2024)
- **Player Character**: GLTF-based, keyboard-controlled (WASD/arrows, Shift to run, E to interact)
- **Dog Companion**: AI-controlled dog that follows the player with procedural animations
- **Discovery System**: 7 clickable 3D objects (spawn pad + arena) with tooltip, toast, and CV panel integration
- **CV Panel**: Tabbed résumé modal ("Living Dossier") that enhances visually as gates are explored

## Tech Stack

Three.js v0.160.0, TypeScript v5, Vite v5, GLTFLoader

## Project Structure

```
src/
├── main.ts                 # Entry point
├── App.ts                  # Main orchestrator + animation loop
├── styles.css
├── scene/
│   ├── characters/
│   │   ├── BaseCharacter.ts      # Abstract base: physics, animation, rendering
│   │   ├── PlayerCharacter.ts    # Keyboard-controlled player
│   │   ├── DogCompanion.ts       # AI follow behavior + procedural animations
│   │   └── types.ts              # MovementInput, CharacterConfig interfaces
│   ├── timeline/
│   │   ├── timelineConfig.ts     # Content data (years, titles, bullets, skills)
│   │   ├── timelineLayout.ts     # Stop positions along bridge Z axis
│   │   ├── createTimelineCheckpoint.ts  # Portal gate mesh factory
│   │   └── createTimelineStops.ts      # Stop creation, proximity lighting, completion state
│   ├── createScene.ts      # Scene, camera, renderer, lighting
│   ├── createGround.ts     # Arena hex platform (hub, barriers, particles)
│   ├── createSpawnPad.ts   # Spawn pad + Timeline Bridge
│   ├── createCommandSpire.ts # Center tower VFX (beacon, particles, rings, ripple)
│   ├── createArenaProps.ts # Arena discovery objects (LEGO, kettlebell, drawing)
│   ├── discoverableGlow.ts # Ambient beacon FX for discoverable objects
│   ├── emissiveUtils.ts    # boostEmissive / restoreEmissive helpers
│   ├── layoutConstants.ts  # Single source of truth for all layout values
│   ├── hexUtils.ts         # Hex geometry helpers
│   ├── textureUtils.ts     # Shared texture generators
│   ├── createStops.ts      # Legacy mock stop markers
│   ├── introSequence.ts    # Opening cinematic
│   ├── environment.ts      # Environment map
│   ├── postProcessing.ts   # Post-processing effects
│   ├── bounds.ts           # Multi-zone boundary checking
│   └── types.ts
├── controls/
│   └── keyboardController.ts
├── collision/
│   ├── checkCollisions.ts
│   ├── proximityUtils.ts
│   └── stopCollision.ts    # Supports per-pillar collision for gates
└── ui/
    ├── transition.ts       # Cinematic overlay for gate interaction
    ├── gatePanel.ts        # Floating proximity panel (bottom-right)
    ├── proximityUI.ts      # Legacy proximity indicator
    ├── gateUnlockAnimation.ts  # Gate→Resume particle animation + badge + toast
    ├── discoveryTracker.ts # Discovery state + rewards (7 objects)
    ├── worldTooltip.ts     # Raycast tooltip + click-to-discover
    ├── onboardingHints.ts  # 3-step progressive tutorial
    ├── photoLightbox.ts    # FLIP zoom lightbox
    ├── cvPanel.ts          # Tabbed résumé modal
    └── loadingScreen.ts
```

## Key Architecture

### App.ts

Main orchestrator. Initializes scene, characters, stops. Manages animation loop, camera follow (smooth lerp), intro sequence, interaction system.

**Camera**: `HEIGHT=3, DISTANCE=5, OFFSET_X=3, LERP=0.045`

**Assets**: 12+ total (player: 5, dog: 2, portal: 1, arena props: 3, spire: 1) loaded in parallel.

**Interaction flow**: Player approaches gate → gate panel appears → E key or click → `markStopCompleted()` → if first time: `pulseGateOnUnlock()` + `playCinematicUnlock()` after 900ms → cinematic overlay opens.

### Character System (OOP)

**BaseCharacter** (abstract): Velocity-based steering physics, frame-rate independent (normalized via `dt = deltaSec × REFERENCE_FPS`). Animation state machine (idle/walk/run) with cross-fading. Subclasses implement `getMovementInput(): MovementInput`.

**PlayerCharacter**: `WALK=0.04, RUN=0.1, ACCEL=0.012, DECEL=0.88, RADIUS=0.5`. Models in `/public/models/` (idle, walk, run, wave GLBs).

**DogCompanion**: `WALK=0.016, RUN=0.065, RADIUS=0.25`. Follow behavior with state machine (resting→following→settling), commit distance/time, reaction delay. Procedural idle (tail wag, breathing, head bob via bone quaternion manipulation) and running gait (gallop bounce, spine flex). Bones auto-discovered via regex. `setExcited(true)` doubles tail-wag frequency.

### Layout System

All layout from `layoutConstants.ts` (single source of truth):

```
[Arena Hex]  SIZE=12, center (0,0,0)
     |
[Timeline Bridge]  LENGTH=16, WIDTH≈4.2, Z: ~10.39 → ~26.39
     |  4 portal gates evenly spaced (~4.33 apart)
[Spawn Pad]  SPAWN_CENTER_Z≈30.38
```

**Bounds** (`bounds.ts`): `isInsideMap()` checks arena hex OR bridge rect OR spawn hex.

### Arena Platform (`createGround.ts`)

Floating hex with layered surfaces. Returns `GroundContext` with `update(time)`.

Layers: body slab → rim → inner floor → underglow ring + PointLight → panel lines → edge pylons → center hub (elevated, radius 3.0, glow disc) → edge energy barrier (shader, animated scanlines) → void cascade (shader, flow pattern) → 80 ambient particles.

Materials: `baseMat` (0x7b8fa3), `floorMat` (0x1f2b38), `accentMat` (cyan emissive), `hubMat` (0x263a4a), plus 2 ShaderMaterials. All use `roughness=1.0` so roughnessMap alone controls effective roughness.

### Spawn Pad + Bridge (`createSpawnPad.ts`)

Returns `SpawnPadContext` with `update(time)`, `monogramMesh`.

**Spawn pad**: Same pattern as arena (hex body, barriers, particles). Plus: wayfinding energy conduit (flow shader toward bridge), vehicle spotlights (warm amber), AL monogram (slow rotation).

**Bridge**: Thin glass slab (`DEPTH=0.25`, transparent MeshStandardMaterial — no transmission for perf). Center runway strip (flow shader), stream particles (70 flowing toward arena), 4 edge lights, destination glow.

Accepts `options.onBikeLoaded` and `options.onMtbLoaded` callbacks for tooltip registration.

### Timeline System (`scene/timeline/`)

**timelineConfig.ts**: `TIMELINE_STOPS` array with 4 entries. Each has `id, year, title, subtitle, bullets, skills?, image?, logo?, companyContext?`.

**timelineLayout.ts**: Evenly spaces gates along bridge Z axis. `ROAD_PADDING=1.5` from bridge ends. `rotationY=0` (pillars span X, opening faces ±Z).

**createTimelineCheckpoint.ts**: Factory per gate. Portal GLB loaded once, cloned. Components: floor pad, portal model (height 2.5), year label sprite, activation ring, ground glow disc. Per-pillar collision (`collisionPoints` + `collisionRadius=0.25`).

**createTimelineStops.ts**: Creates all stops, manages proximity lighting and completion. `completedStops` Set, `markStopCompleted(id): boolean` (true on first-time), `isStopCompleted(id)`. Exports `pulseGateOnUnlock(stopId)` for 3D emissive flash.

### Gate Panel (`ui/gatePanel.ts`)

Floating card, right side, proximity-driven opacity. Proximity radius `2.5` (tighter than global 3.5 to prevent overlap between adjacent gates). Crossfade on gate switch. Two-state CTA (approaching hint vs active "Press E" button). First-gate hint shown once per session. Tilt effect via `addTiltEffect`.

### Cinematic Overlay (`ui/transition.ts`)

Full-screen overlay on E press. Shows logo, year, role, period, context, bullets, skill chips, image panel. Card `max-height` capped, body scrolls. `body.transition-open` class toggled.

### Gate Unlock Animation (`ui/gateUnlockAnimation.ts`)

4-phase cinematic (~3s) on first-time gate completion:
- Phase 0: Vignette flash
- Phase 1: 6 motes arc from gate to Resume button, micro-sparks on impact
- Phase 2: Button elastic pop, sonar ring, badge update
- Phase 3: Scanline sweep, achievement toast (clickable → opens CV panel + spotlights entry)
- 4/4 bonus: Gold accent, "Journey Complete" toast, permanent gold button border

**Badge** (`.cv-btn-badge`): Shows gate + discovery count. Hidden at 0. "✦" gold at 4/4 complete.

**Toast system** (`showGameToast`): Used by both gates and discoveries. Clickable toasts open CV panel tab and spotlight target element.

**Discovery motes** (`playDiscoveryMotes`): 3 amber motes from 3D object to Resume button.

**Tab indicators**: `markJourneyTabNew()` / `markAboutTabNew()` add pulsing dots, cleared on tab click.

### Click-to-Discover (`ui/worldTooltip.ts`)

Raycasting tooltip (throttled 120ms) + click-to-discover for 3D objects.

`registerTooltipTarget(target)` — target has `object, title, subtitle, onHoverStart?, onHoverEnd?, onClick?, discoveryId?, yOffset?`. Pre-computes flat mesh list, O(1) hit lookup.

Auto-disables during overlays. Dynamic hints: undiscovered → "Click to discover →"; discovered → "✦ Photos in Resume → About tab".

**Registered targets**: BMW S1000RR (emissive boost), MTB, Meny the dog (`setExcited`), AL monogram (opacity pulse), LEGO, kettlebell, framed drawing.

### Discovery Tracker (`ui/discoveryTracker.ts`)

7 IDs: `bmw, mtb, meny, monogram` (spawn) + `lego, gym, twins` (arena). `markDiscovered(id)` triggers toast + motes + badge + About tab indicator. 7/7 bonus: gold "Fully Explored" toast.

### Discoverable Beacons (`scene/discoverableGlow.ts`)

Ambient visual cues for all 7 discoverable objects. Ground glow disc (amber, breathing) + 3–5 floating particles. Proximity-reactive. Post-discovery: shifts to muted cyan at 20% intensity.

### Arena Props (`scene/createArenaProps.ts`)

3 GLBs at desk-toy scale (0.3–0.45). LEGO at (4.5,0,-2), drawing at (-3.5,0,-4), kettlebell at (7.5,0,3.5). Walk-through only, no collision. Warm accent PointLights.

### Command Spire (`scene/createCommandSpire.ts`)

Center tower VFX system — the arena's visual centerpiece at (0,0,0). GLB model (`Meshy_AI_Cyan_Ring_Spire`) scaled to height 4, wrapped in 6 layered effects:

1. **Beacon Ray**: Two crossed vertical quads (height 6) with custom ShaderMaterial — vertical gradient, horizontal soft-edge, upward energy pulses, breathing, width shimmer. Visible from spawn pad through fog. 1 draw call.
2. **Rising Particles**: 40 GPU-animated points spiraling upward through the tower body. All animation in vertex shader (zero JS per-particle updates). 1 draw call.
3. **Emissive Pulse**: Breathing emissiveIntensity on tower's cyan meshes + tip PointLight (0x00e5cc, range 8). No extra draw calls.
4. **Holographic Rings**: 3 horizontal RingGeometry planes at different heights, independent rotation speeds/directions, shared scanline ShaderMaterial. 3 draw calls.
5. **Ground Ripple**: Expanding radar-ping ring, only visible when player is nearby (`proximity * 0.5` alpha). 1 draw call.
6. **Data Fragments**: 10 ambient floating point sprites orbiting the tower at low opacity. 1 draw call.

**Total: 7 draw calls, ~530 vertices.** All transparent/additive meshes use `depthWrite: false`. No shadow casters.

**Proximity UX arc** (continuous 0–1 via `computeProximityFactor(distance, 8.0, 2.0)`):
- Far: beacon at 60% + idle heartbeat
- Mid: rings speed up, ground ripple activates, particles accelerate
- Close: everything at peak, PointLight illuminates player

**Collision**: radius 1.2 at center, added to `collisionStops` in App.ts.

Returns `CommandSpireContext` with `update(time, playerPosition)` called each frame.

### CV Panel (`ui/cvPanel.ts`)

Tabbed résumé modal. 4 tabs: **Overview** (hero, summary, skills, availability, contact, progress), **Journey** (experience timeline with dot-nav, photos), **Stack** (competency map, 5 categories), **About** (working style, education, interests grid with photo panel).

**Living Dossier**: All content always visible. Gate exploration adds visual enhancements (✦ Explored badge, active timeline line, shimmer). No locked/hidden content.

**About tab interests**: 3×3 grid. Cards with `data-discovery-id` show discovery state. Cards with `data-photo-album` have hover photo panel (desktop: hover; mobile: tap). Teaser state: blurred photo + scanlines. Gallery state: swipeable with lightbox zoom.

**Photos**: `/public/img/discoveries/` — bmw, mtb, meny, lego albums.

Font: Inter (Google Fonts). Download CTA in footer with animated effects.

### Photo Lightbox (`ui/photoLightbox.ts`)

FLIP-animated zoom. Shapes: `circle` or `rect`. `attachZoomHint` adds cursor + magnifier overlay.

### Onboarding (`ui/onboardingHints.ts`)

3-step progressive tutorial: Move (arrow keys) → Sprint (Shift) → Click objects. Each dismisses on use or timeout. Click interceptor nudges keyboard usage. Post-completion directional hint toward portals.

### Intro Sequence (`scene/introSequence.ts`)

Retro terminal aesthetic. Phases: closeup → text typing → pullback → hint → wave. Dog shows procedural idle during intro, resets after.

## Collision System

- `checkCollisions.ts`: Proximity detection + E key interaction
- `stopCollision.ts`: Circle collision per stop. Per-pillar mode for gates (walk through opening, not frame)
- `PROXIMITY_RADIUS=3.5`, `INTERACT_RADIUS=1.8`, `STOP_COLLISION_RADIUS=0.85`

## Lighting

Ambient (0.4) + Directional sun (0.6, warm) + Fill (0.2, blue) + Hemisphere (0.25) + Rim (0.2) + dynamic PointLights on stops. ACES Filmic tonemapping, exposure 0.62. Fog: `FogExp2` 0x1a1d2e density 0.052. Shadows: PCFSoftShadowMap 2048².

## Key Files to Edit

| Task | File |
|---|---|
| Timeline content | `scene/timeline/timelineConfig.ts` |
| Layout constants | `scene/layoutConstants.ts` |
| Player movement | `scene/characters/PlayerCharacter.ts` |
| Dog behavior | `scene/characters/DogCompanion.ts` |
| Arena appearance | `scene/createGround.ts` |
| Bridge/spawn | `scene/createSpawnPad.ts` |
| CV panel content | `ui/cvPanel.ts` |
| Gate interaction | `ui/transition.ts` |
| Portal model | `createTimelineCheckpoint.ts` (`PORTAL_MODEL_PATH`) |
| Center tower VFX | `scene/createCommandSpire.ts` |

## Dev Commands

```bash
npm install && npm run dev    # http://localhost:5173
npm run build                 # Production → /dist/
```

## Code Style

TypeScript strict, ES6 modules, camelCase vars, PascalCase classes. OOP with BaseCharacter inheritance. Factory pattern (`static create()`). Config constants at file top.