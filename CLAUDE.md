---
description:
alwaysApply: true
---

# CLAUDE.md - 3D Portfolio Project Guide

## Project Overview

This is an interactive 3D portfolio experience built with Three.js, TypeScript, and Vite. Visitors explore your work by navigating a character through a stylized 3D landscape, discovering projects at designated stops along the way. The experience feels like a small open-world game with a top-down angled view.

### Core Concept

- **Map**: A hexagonal 3D ground plane that acts as the playable area
- **Stops**: 3D markers placed on the map, each representing a project or section
- **Player Character**: A keyboard-controlled 3D character (loaded from GLTF models) that moves across the map
- **Dog Companion**: An AI-controlled dog that follows the player with realistic behavior and animations
- **Interaction**: When the character approaches a stop, proximity UI appears. Pressing E opens a cinematic transition with project details

## What's New

**Spawn Pad + Timeline Bridge** ✨

A two-piece entry zone added below (south, +Z side) the main arena:

- **Spawn Pad**: Hexagonal platform with underglow, Edge Energy Barrier (opacity 0.45, height 0.8), Void Cascade, ambient rising particles (50, rise above platform), warm vehicle spotlights, AL monogram, and breathing floor emissive. Player spawns at `(0, 0, SPAWN_CENTER_Z)`.
- **Timeline Bridge**: Thin glass-like slab (`BRIDGE_DEPTH = 0.25`) with transparent material (no transmission for performance). Same effects as arena plus: center runway strip (flow shader), stream particles (70 flowing toward arena), destination glow at arena end, 4 edge lights, brighter trim. Hosts the 4 timeline portal gates.
- **Multi-zone bounds**: `isInsideMap()` now checks three zones (arena hex, bridge rectangle, spawn pad hex) composed with OR — character can walk seamlessly between all three.
- **File**: `src/scene/createSpawnPad.ts` — builds both. `layoutConstants.ts` defines `BRIDGE_WIDTH`. Returns `SpawnPadContext` with `update(time)` for animated effects.
- **Portal layout moved**: Portals now placed along the straight bridge (Z axis) instead of the arena's curved arc. `rotationY = 0` so pillars span X and the opening faces ±Z — player walks straight through each arch.
- **Road strip removed from arena**: `createGround.ts` no longer imports `sampleRoadCurve` or renders a road on the arena floor; the bridge slab floor serves as the timeline road surface.

**Timeline Road System** ✨

The first real gameplay content: 4 interactive Timeline Checkpoints along the Timeline Bridge, each representing a career milestone (ASML 2018, Restigo 2022, Triolla 2023, The5ers 2024). Gates sit evenly spaced along the +Z bridge, oldest (2018) near the spawn pad, newest (2024) near the arena entrance.

- **Portal Gates**: Loaded from a GLB model (`Meshy_AI_Neon_Quantum_Portal`), scaled to character height + extra (~2.5 units)
- **Floor Pad**: Dark rounded-rect pad beneath each portal with cyan emissive trim
- **Activation Ring**: Breathing/pulsing ring around each checkpoint, intensifies on proximity and completion
- **Year Labels**: CanvasTexture sprites above each portal (always faces camera, gentle bobbing)
- **Ground Glow Disc**: Radial gradient disc beneath each checkpoint, pulses subtly at idle, brightens on proximity
- **Proximity Glow**: Model emissive materials, point light, ring, and glow disc all react to player distance
- **Completion State**: Checkpoints glow brighter after interaction (`completedStops` Set tracks visited stops)
- **Pillar Collision**: Two-circle collision per gate (one per pillar) — player walks through the opening but not through the solid frame
- **Content Overlay**: Press E to open cinematic overlay with year, title, subtitle, bullet points, and links

**Floating Hub Platform Overhaul**

The hexagonal platform has been transformed from a flat test room into a stylized floating hub with layered depth and intentional boundaries:

- **Center Hub**: Elevated circular plate (radius 3.0, raised 0.035 units) with concentric accent rings, 6 radial spokes, and a pulsing radial glow disc — creates a clear focal point
- **Edge Energy Barrier**: Vertical translucent ShaderMaterial planes along each hex edge with animated scanlines and shimmer — boundary feels like a force field, not "ran out of map"
- **Void Cascade**: Glowing energy waterfall planes hanging below platform edges with animated flow patterns (additive blending) — creates depth below the floating island
- **Enhanced Underglow**: Wider accent ring (45%–100% vs 70%–96%), brighter emissive (0.35 vs 0.25), plus a PointLight below the platform center — actual light illuminating the underside
- **Ambient Rising Particles**: 80 cyan dots drifting upward from below the platform perimeter with gentle sway — ambient life around the edges
- **Visual Hierarchy**: Center hub (focal, slightly elevated) → Road (directional path) → Inner plate (floor) → Rim (boundary) → Edge barrier (energy wall) → Void cascade (depth below)
- **Animated Update Loop**: `createGround()` now returns `GroundContext` with `update(time)` — pulses center glow, animates shader uniforms (barrier scanlines, void flow), and drifts particles
- **Previous features retained**: Road strip, edge pylons, panel lines, trim lines, specular-safe roughness maps, contrast hierarchy

**Gate Unlock Animation System** ✨

A multi-phase particle animation that fires when the player completes a timeline gate for the first time, bridging the 3D world and the 2D Resume button UI. Inspired by XP-orb mechanics from Zelda/mobile games — the world acknowledges the player's action and the "inventory" (resume) grows.

- **Trigger**: Cinematic overlay closes after a first-time gate completion (`markStopCompleted` returns `true`)
- **Phase 1 — Particle Burst (0–280ms)**: 4 cyan energy motes eject from the gate's projected screen position, scattering outward
- **Phase 2 — Screen-Space Travel (280–800ms)**: Motes arc along randomized quadratic bezier curves from gate position to the Resume pill button. Each mote has a unique arc (perpendicular offset, staggered arrival) — organic firefly feel, not a straight line
- **Phase 3 — Button Absorption (800–1200ms)**: Motes converge on the button → elastic scale pulse (1.0 → 1.12 → 1.0) → sonar ring radiates outward → border glow intensifies for 2.5 seconds
- **Progress Dots**: 4 tiny dots beneath the Resume button text (one per gate); fill in cyan as gates are completed. Persistent across the session, visible at all times after init
- **Persistent Glow**: After any unlock, the Resume button gains a subtle persistent `cv-btn-has-unlocks` border/shadow enhancement
- **First-Unlock Tooltip**: On the very first gate ever completed, a tooltip appears below the button: "Your dossier is building…" — fades after 3.2 seconds, never shown again (standard game-design onboarding: teach → trust)
- **File**: `src/ui/gateUnlockAnimation.ts` — exports `initGateUnlockAnimation()`, `triggerGateUnlock(worldPos, camera)`, `refreshProgressDots()`
- **Integration**: `App.ts` calls `initGateUnlockAnimation()` at setup; passes `onClosed` callback to `openTransition` with 900ms delay for camera return animation

**Teaching Photo** ✨

The5ers cinematic overlay and resume now show the teaching photo (`/img/alex-teaching.png`) — you standing in front of code, presenting to a team. This is the "Led internal training for 6 teams" bullet come to life.

- **Cinematic overlay**: Appears as the cover image in The5ers gate interaction (side panel, `#cinematic-img-panel`)
- **Resume Journey tab**: Inline thumbnail in The5ers experience entry with lightbox zoom-on-click, captioned "Architecture training session — The5ers, 2024"
- **Images**: `/public/img/alex-teaching.png` (photo), replaces previous `the5ers-trading.png` in config

**Character System Overhaul**

The character system has been completely refactored with an object-oriented architecture:

- **BaseCharacter**: Abstract base class providing physics, animation, and rendering for all characters
- **PlayerCharacter**: Keyboard-controlled player (formerly `CharacterController`)
- **DogCompanion**: New AI-controlled dog companion with realistic follow behavior and procedural animations
- **Extensible Design**: Easy to create new character types (NPCs, pets, enemies) by extending `BaseCharacter`

This architecture enables multiple characters to coexist in the scene with different behaviors while sharing common physics and animation logic.

## Tech Stack

- **Three.js** (v0.160.0) - 3D rendering engine
- **TypeScript** (v5.0.0) - Type-safe JavaScript
- **Vite** (v5.0.0) - Build tool and dev server
- **GLTFLoader** - For loading 3D character models and animations

## Project Structure

```
src/
├── main.ts                 # Entry point - initializes the app
├── App.ts                  # Main application logic and animation loop
├── styles.css              # Global styles
│
├── scene/                  # 3D scene management
│   ├── characters/         # Character system (OOP architecture)
│   │   ├── BaseCharacter.ts      # Abstract base class for all characters
│   │   ├── PlayerCharacter.ts    # Keyboard-controlled player
│   │   ├── DogCompanion.ts       # AI-controlled dog companion
│   │   ├── types.ts              # Character-related type definitions
│   │   └── index.ts              # Barrel exports
│   ├── timeline/           # Timeline Road system
│   │   ├── timelineConfig.ts          # Timeline content data (years, titles, bullets)
│   │   ├── timelineLayout.ts          # Stop positions along the road strip
│   │   ├── createTimelineCheckpoint.ts # Portal gate mesh + floor pad + ring + glow
│   │   ├── createTimelineStops.ts     # Stop creation, animations, proximity lighting
│   │   └── index.ts                   # Barrel exports
│   ├── createScene.ts      # Scene, camera, renderer, lighting setup
│   ├── createGround.ts     # Main arena hex platform creation
│   ├── createSpawnPad.ts   # Spawn pad + Timeline Bridge (glass, effects)
│   ├── layoutConstants.ts  # Shared arena, bridge, spawn layout constants (single source of truth)
│   ├── hexUtils.ts         # Shared hex geometry: hexVertex, createHexShape, createHexPath
│   ├── textureUtils.ts     # Shared textures: createNoiseRoughnessMap, createRadialGlowTexture, createDotTexture
│   ├── createStops.ts      # Portfolio stop markers creation (legacy mock stops)
│   ├── introSequence.ts    # Opening cinematic sequence
│   ├── environment.ts      # Environment map loading
│   ├── postProcessing.ts   # Post-processing effects
│   ├── bounds.ts           # Map boundary checking (hexagonal)
│   └── types.ts            # Scene-level TypeScript interfaces
│
├── controls/               # Input handling
│   └── keyboardController.ts  # Keyboard input management
│
├── collision/              # Collision detection
│   ├── checkCollisions.ts  # Proximity and interaction detection
│   ├── proximityUtils.ts   # Shared computeProximityFactor for stop lighting
│   └── stopCollision.ts    # Stop collision checking (supports per-pillar collision)
│
└── ui/                     # User interface
    ├── transition.ts       # Cinematic transition overlay (subtitle, bullets, links)
    ├── gatePanel.ts        # Floating proximity panel for timeline gates (center-right)
    ├── proximityUI.ts      # Proximity indicator UI (used by building stops)
    ├── gateUnlockAnimation.ts # Gate→Resume particle animation + progress dots + tooltip
    ├── loadingScreen.ts    # Loading screen management
    └── popup.ts            # (Legacy) Popup component
```

## Key Components

### App.ts (`src/App.ts`)

The main application orchestrator that:

- Initializes the 3D scene, player character, dog companion, and stops
- Manages the animation loop
- Handles camera following (smooth lerp)
- Coordinates intro sequence
- Manages two-tier interaction system: proximity gate panel (timeline) + E-key cinematic overlay (buildings)
- Controls transition overlays
- Tracks asset loading progress with elegant progress indicator
- Coordinates dog behavior with intro sequence

**Key Constants:**

- `CAMERA_HEIGHT`: 3 (camera Y position)
- `CAMERA_DISTANCE`: 5 (camera Z offset from character)
- `CAMERA_OFFSET_X`: 3 (camera X offset from character)
- `CAMERA_LERP`: 0.045 (camera smoothing factor)
- `POST_WAVE_DURATION`: 3.0 (camera transition after wave animation)

**Asset Loading:**

- Player assets: 5 (idle model + idle anim + walk + run + wave)
- Dog assets: 2 (model + walk animation)
- Portal assets: 1 (portal GLB, loaded once and cloned per checkpoint)
- Total: 8 assets with progress tracking
- Assets load in parallel with intro sequence for smooth experience

**Character Coordination:**

- Both player and dog visible during intro
- Dog shows procedural idle during intro (tail wag, breathing)
- After intro ends, dog resets to idle position behind player
- Dog follows player once gameplay starts

### Character System (`src/scene/characters/`)

The character system uses an object-oriented architecture with a base class and specialized implementations:

#### BaseCharacter (`BaseCharacter.ts`)

Abstract base class providing core functionality for all characters:

**Physics & Movement:**

- Velocity-based steering physics with acceleration/deceleration
- **Frame-rate independent**: all physics (acceleration, deceleration, position) normalized via `dt = deltaSec × REFERENCE_FPS` (60). At 60 FPS `dt = 1` (unchanged behavior); at lower/higher FPS the character covers the same distance per second. Capped at `dt ≤ 3` to prevent huge jumps on tab-switch.
- Arcing turns with automatic speed reduction on sharp turns
- Position updates with map bounds and stop collision checking
- Configurable steering parameters (steer rate, brake intensity, etc.)

**Visual Effects:**

- Automatic rotation to face velocity direction
- Dynamic lean into turns for realistic movement feel
- Smooth interpolation for all rotations

**Animation System:**

- State machine for idle → walk → run transitions
- Smooth cross-fading between animation states
- Speed-adaptive animation playback rates
- Animation mixer management

**GLTF Loading Utilities:**

- Static helper methods for loading character models
- Automatic model scaling to target height
- Material setup (shadows, PBR properties)
- Animation clip loading and registration

**Subclass Requirements:**
Each character subclass must implement `getMovementInput()` to provide movement intent (direction, max speed, has input).

#### PlayerCharacter (`PlayerCharacter.ts`)

The player-controlled character with keyboard input:

**Movement Constants:**

- `PLAYER_RADIUS`: 0.5 (collision radius)
- `PLAYER_WALK_SPEED`: 0.04
- `PLAYER_RUN_SPEED`: 0.1 (when Shift is held)
- `PLAYER_ACCELERATION`: 0.012
- `PLAYER_DECELERATION`: 0.88 (friction factor)

**Features:**

- WASD/Arrow key movement input
- Shift-to-run mechanic
- Wave animation (used during intro sequence)
- Collision with stops and map boundaries

**Character Models:**

- `/models/Meshy_AI_Animation_Idle_11_withSkin.glb` (idle + animation)
- `/models/Meshy_AI_Animation_Walking_withSkin.glb` (walk animation)
- `/models/Meshy_AI_Animation_Running_withSkin.glb` (run animation)
- `/models/Meshy_AI_Animation_Wave_One_Hand_withSkin.glb` (wave animation)

#### DogCompanion (`DogCompanion.ts`)

AI-controlled dog that follows the player with realistic behavior:

**Movement Constants:**

- `DOG_RADIUS`: 0.25 (collision radius)
- `DOG_WALK_SPEED`: 0.016 (relaxed trot)
- `DOG_RUN_SPEED`: 0.065 (can keep up with player)
- `DOG_ACCELERATION`: 0.004 (gentle acceleration)
- `DOG_DECELERATION`: 0.91

**Follow Behavior:**

- Position history tracking for smooth delayed following
- State machine: resting → following → settling
- Realistic reaction delays (doesn't follow tiny movements)
- Commit distance/time before dog decides to follow
- Smart positioning behind player when idle
- Matches player sprint speed when necessary
- Teleports if too far behind (post-transition)

**Advanced Features:**

- **Procedural Idle Animations:** When resting, the dog shows lifelike behavior:
  - Tail wagging (staggered across tail bones)
  - Breathing motion (spine expansion/contraction)
  - Head bobbing (slow gentle nods)
  - Rest-pose blending (slerp to bind pose)
- **Procedural Running Gait:** When sprinting, layered on top of walk animation:
  - Vertical bounce (gallop hop with double-bounce per cycle)
  - Spine flex (compression/extension like real galloping)
  - Head pump (bobs down on landing)
  - Tail streaming (extends behind with minimal wag)
  - Speed-adaptive intensity
- **Collision Avoidance:**
  - Walks freely through stops (doesn't block them)
  - Maintains minimum separation from player
  - Respects map boundaries

**Configuration:**

- `FOLLOW_OFFSET_BEHIND`: 2.2 (stays behind player)
- `FOLLOW_OFFSET_SIDE`: -0.5 (slight lateral offset)
- `COMMIT_DISTANCE`: 2.2 (how far player must move)
- `COMMIT_TIME`: 1.0 seconds (or sustained movement)
- `REACTION_DELAY`: 0.45 seconds (delay before getting up)
- `CATCH_UP_RADIUS`: 3.5 (starts sprinting when this far)

**Character Model:**

- `/models/Meshy_AI_model_Animation_Walking_withSkin_DOG.glb` (model + walk animation)

**Bone Discovery:**
The dog automatically discovers skeleton bones by name patterns:

- Tail bones: `/tail/i`, `/queue/i`
- Spine bones: `/spine/i`, `/body/i`, `/torso/i`
- Head bones: `/head/i`, `/skull/i`

**API Methods:**

- `update()`: Main update loop (physics + animations)
- `updateIdleOnly()`: Update only procedural idle (used during intro)
- `snapToPlayer()`: Instantly reposition behind player
- `resetToIdleBehindPlayer()`: Reset to idle state after intro

#### Character Types (`types.ts`)

TypeScript interfaces for the character system:

**MovementInput:**
Produced each frame by `getMovementInput()` in character subclasses:

```typescript
interface MovementInput {
  dirX: number; // Normalized direction X (-1 to 1)
  dirZ: number; // Normalized direction Z (-1 to 1)
  maxSpeed: number; // Target speed for this frame
  hasInput: boolean; // Whether active input exists
}
```

**CharacterConfig:**
Core physics configuration passed to BaseCharacter constructor:

```typescript
interface CharacterConfig {
  radius: number; // Collision/bounds-checking radius
  walkSpeed: number; // Normal walk speed
  runSpeed: number; // Sprint speed
  acceleration: number; // Per-frame velocity increase
  deceleration: number; // Per-frame velocity decay (0-1)
}
```

**How It Works:**

1. Each frame, subclass returns `MovementInput` from `getMovementInput()`
2. `BaseCharacter.updateVelocity()` processes the input using physics config
3. Player reads keyboard, dog calculates follow vector, AI could use pathfinding
4. This design makes it easy to create new character types with different input strategies

### createGround (`src/scene/createGround.ts`)

Builds the floating hub platform — a hexagonal megastructure with layered surfaces, an elevated center hub, energy-barrier edges, void cascade glow, and ambient particles. Returns a `GroundContext` with `group` and `update(time)`.

**Structure (bottom to top):**

1. **Platform body** — thick ExtrudeGeometry slab with beveled edges (`baseMat`)
2. **Raised rim ring** — stepped inset border (`baseMat`, shared with body)
3. **Inner plate** — dark recessed floor surface (`floorMat`)
4. **Underside accent ring** — wide cyan emissive glow (`accentMat`) + PointLight below
5. **Panel lines** — hex-grid grooves (radial spokes + concentric rings)
6. **Edge trim lines** — brighter accent along rim borders (opacity 0.35)
7. **Edge pylons** — 5 small placeholder volumes near rim (`baseMat` + accent caps)
8. **Center Hub** — elevated circular plate (`hubMat`) with concentric rings, spokes, glow disc
9. **Edge Energy Barrier** — 6 vertical ShaderMaterial planes with scanline + shimmer animation
10. **Void Cascade** — 6 hanging ShaderMaterial planes below edges with flow animation (additive)
11. **Ambient Particles** — 80 rising cyan dots around perimeter (PointsMaterial, additive)

> **Note:** The road strip formerly rendered on the arena has been removed. The Timeline Bridge slab (in `createSpawnPad.ts`) now serves as the road surface.

**Materials (4 surface materials + 2 shader materials + line materials):**

| Material | Color | Roughness | Metalness | Purpose |
|---|---|---|---|---|
| `baseMat` | `0x7b8fa3` | 1.0 (map: 0.78) | 0.10 | Body, rim, pylons |
| `floorMat` | `0x1f2b38` | 1.0 (map: 0.85) | 0.08 | Inner plate |
| `accentMat` | cyan emissive (0.35) | 0.9 | 0.0 | Underglow, pylon caps |
| `hubMat` | `0x263a4a` | 1.0 (map: 0.85) | 0.10 | Center hub plate |
| `barrierMat` | ShaderMaterial | — | — | Edge energy barrier |
| `voidCascadeMat` | ShaderMaterial | — | — | Void cascade waterfall |

> **Note:** `material.roughness` is set to 1.0 so the roughnessMap alone controls effective roughness. This avoids the Three.js double-attenuation trap where `roughness × roughnessMap` produces unexpectedly glossy surfaces.

**Visual Hierarchy (from 45° camera):**

- Center Hub = focal point (elevated plate with glow, radius 3.0)
- Inner plate = floor area (mid-dark, `0x1f2b38`)
- Rim/body = boundary (lightest, `0x7b8fa3`)
- Edge Barrier = force field (translucent cyan, animated)
- Void Cascade = depth below (energy waterfall, additive glow)

**Center Hub:**

- CircleGeometry (radius 3.0, 48 segments) at Y = 0.035
- 3 concentric accent rings (radii 1.0, 1.8, 2.6) + 1 brighter outer ring
- 6 radial spokes (compass rose pattern)
- Radial glow disc (canvas gradient, AdditiveBlending, pulsing opacity)

**Edge Energy Barrier:**

- 6 custom BufferGeometry planes (one per hex edge), HEIGHT = 0.8
- ShaderMaterial: heightFade³ × scanline × shimmer, animated via time uniform
- Placed at SIZE × 0.99 (slightly inside outer edge), transparent, DoubleSide

**Void Cascade:**

- 6 custom BufferGeometry planes hanging below edges, HEIGHT = 3.0
- ShaderMaterial: cubic fade × flow pattern, animated via time uniform
- Placed at SIZE × 1.01 (slightly outside), starting at Y = −0.45, AdditiveBlending

**Ambient Particles:**

- 80 points scattered at radius 50%–100% of SIZE, below platform
- Drift upward (RISE_RANGE = 5.0) with gentle sinusoidal sway
- PointsMaterial with dot texture, AdditiveBlending, cyan accent

**Animated Update (called per frame):**

- `barrierMat.uniforms.time` — drives scanline + shimmer
- `voidCascadeMat.uniforms.time` — drives flow pattern
- `centerGlowMat.opacity` — pulses 0.6–1.0 at 0.6 Hz
- `underLight.intensity` — pulses 0.35–0.65 at 0.4 Hz
- Particle positions — time-based Y rise with X/Z sway

**Key Constants:**

- `SIZE`: 12 (hexagon circumradius)
- `PLATFORM_DEPTH`: 1.5 (slab thickness)
- `ROAD_WIDTH`: 2.4 (arc defined in timelineLayout.ts)
- `HUB_RADIUS`: 3.0, `HUB_HEIGHT`: 0.035
- `BARRIER_HEIGHT`: 0.8, `VOID_CASCADE_HEIGHT`: 3.0
- `PARTICLE_COUNT`: 80, `RISE_RANGE`: 5.0
- `INNER_RADIUS`: ~10.55 (SIZE − RIM_INSET − RIM_WIDTH)

### createSpawnPad (`src/scene/createSpawnPad.ts`)

Builds the entry zone south of the main arena — a hexagonal spawn pad connected by a thin glass-like Timeline Bridge. Returns `SpawnPadContext` with `group`, `spawnCenter`, and `update(time)` for animated effects.

**Layout (top-down, +Z = south / toward viewer):**

```
[Main Arena]  ←  centre (0, 0, 0)
     |
[Timeline Bridge]   Z: +10.392 → +24.392  (14 units long, BRIDGE_WIDTH from layoutConstants)
     |   4 portal gates evenly spaced along bridge
[Spawn Pad]   centre (0, 0, SPAWN_CENTER_Z)   ← player starts here
```

**Key Constants:**

- `ARENA_APOTHEM`: `≈ 10.392` — arena bottom flat-face Z position
- `BRIDGE_LENGTH`: 16, `BRIDGE_DEPTH`: 0.25 (thin glass slab)
- `BRIDGE_WIDTH`: from `layoutConstants` — `GATE_PAD_WIDTH + 1.0 ≈ 4.2`
- `BRIDGE_NEAR_Z`, `BRIDGE_FAR_Z`, `BRIDGE_CENTER_Z` — bridge Z range
- `SPAWN_APOTHEM`: `BRIDGE_WIDTH * 0.95` — spawn hex flat-face matches bridge
- `SPAWN_CENTER_Z`: `BRIDGE_FAR_Z + SPAWN_APOTHEM`

**Spawn Pad layers:**

1. Body slab, rim ring, inner floor — same pattern as arena (`baseMat`, `floorMat` with breathing emissive 0.0–0.03)
2. Underglow accent ring + PointLight
3. Edge Energy Barrier (6 hex edges, `BARRIER_HEIGHT = 0.8`, opacity 0.45), Void Cascade (6 edges)
4. Ambient rising particles (50, `size: 0.15`, `opacity: 0.7`, rise from below platform to Y = 2.5 above), edge trim lines
5. **Wayfinding energy conduit** — environmental wayfinding (no text). A flow-shader strip on the pad floor runs from near the centre to the bridge entrance, growing brighter toward the exit. A radial threshold glow + `PointLight` marks the junction. 10 guide particles drift along the conduit toward the bridge, reinforcing directionality through motion. Uses the same visual language as the bridge runway strip.
6. **Vehicle spotlights** — warm amber (`COL_WARM = 0xffaa44`) PointLights + radial glow discs beneath BMW motorcycle and MTB. Break the monochrome cyan palette with showroom-style warm pools. Lights pulse gently.
7. **AL monogram** — abstract geometric glyph (canvas-drawn AL mark) at centre floor, very low opacity (0.10), additive blending, slow continuous Y rotation (0.08 rad/s). Reads as a decorative sigil, not literal text.

**Bridge layers:**

1. Thin body slab (`BRIDGE_DEPTH = 0.25`) — `bridgeGlassMat` (transparent `MeshStandardMaterial`, no transmission for performance)
2. Full floor plate — same glass material
3. Center runway strip — flow shader animating toward arena
4. Underglow ring + PointLight; 4 edge PointLights; Edge Energy Barrier (4 edges); Void Cascade (4 edges)
5. Destination glow plane at arena end; stream particles (70) flowing toward arena
6. Brighter trim on all 4 edges (opacity 0.55)

**Performance:** Bridge uses `MeshStandardMaterial` with transparency instead of `MeshPhysicalMaterial` transmission to avoid FPS drops. Edge lights limited to 4 total.

**Exported constants:** `SPAWN_PAD_CENTER_X`, `SPAWN_PAD_CENTER_Z`

### IntroSequence (`src/scene/introSequence.ts`)

Handles the opening cinematic:

1. **Closeup**: Camera focuses on player character
2. **Text phases**: Terminal-style text appears with typing animation
3. **Pullback**: Camera smoothly transitions to gameplay position
4. **Hint**: Control legend appears
5. **Complete**: Character waves, overlay fades out

The intro uses a retro terminal aesthetic with green text, CRT scanlines, and typing effects.

**Character Coordination:**

- Player character performs wave animation at the end
- Dog companion shows procedural idle during intro (tail wag, breathing)
- After intro ends, dog resets to idle position behind player
- Both characters visible throughout intro sequence

### createStops (`src/scene/createStops.ts`)

Creates portfolio stop markers with:

- Animated floating motion
- Pulsing ring indicators
- Orbiting particle effects
- Dynamic lighting that intensifies as player approaches
- Configurable positions, shapes (box/cylinder), and colors

**Stop Configuration:**
Located in `STOPS_CONFIG` array - modify this to add/remove/change portfolio items.

**Proximity Lighting:**

- Lights and emissive materials intensify as player approaches
- `PROXIMITY_RADIUS`: 3.5 (detection range)
- `INTERACT_RADIUS`: 1.8 (interaction range)

### Timeline Road System (`src/scene/timeline/`)

The primary gameplay content — 4 interactive checkpoints along the Timeline Bridge (south of the main arena), representing career milestones. Player walks from the spawn pad northward (−Z) through each gate to reach the arena.

#### timelineConfig.ts

Defines content for each timeline stop:

```typescript
export interface TimelineStopData {
  id: string;
  year: number;
  title: string;           // "Company — Role"
  subtitle: string;        // "Full-time · Month Year – Month Year · duration · location"
  bullets: string[];       // 4-6 achievement bullets
  skills?: string[];       // tech stack chips shown in cinematic overlay
  image?: string;          // path to image shown in cinematic overlay image panel
  imageCaption?: string;   // caption under the image
  companyContext?: string; // one–two sentence company description for HR context
  logo?: string;           // company logo path (shown as badge next to company name)
}
```

`TIMELINE_STOPS` array holds 4 entries: 2018 (ASML), 2022 (Restigo), 2023 (Triolla), 2024 (The5ers). Each entry includes `skills`, `image`, `logo`, and `companyContext`.

#### timelineLayout.ts

Arranges stops in a straight line along the Timeline Bridge (+Z axis). Gates are evenly spaced from spawn end (high Z) to arena end (low Z), oldest milestone nearest the spawn pad.

**Exports:**

- `ROAD_ARC` — legacy stub (kept for API compatibility; bridge is straight)
- `buildTimelinePositions()` — returns evenly-spaced positions along the bridge Z axis
- `sampleRoadCurve()` — returns straight-line points along bridge for road geometry
- `BRIDGE_ROAD_HALF_WIDTH` — half of bridge width for road geometry

**Key Constants:**

- `ARENA_APOTHEM`: `12 × cos(30°) ≈ 10.392`
- `BRIDGE_LENGTH`: 16 — total bridge span in world units
- `BRIDGE_NEAR_Z`: `≈ 10.392` (arena side)
- `BRIDGE_FAR_Z`: `≈ 26.392` (spawn side)
- `ROAD_PADDING`: 1.5 — gap between bridge ends and first/last gate
- `GROUND_Y`: 0.15 — portal Y position on the bridge floor

**Portal orientation:**  
`rotationY = 0` — portal model pillars span the X axis; opening faces ±Z. Player walks along −Z (toward arena) and passes straight through each arch without turning.

Gates are ~4.33 units apart along Z (`(BRIDGE_LENGTH - 2×ROAD_PADDING) / 3`).

#### createTimelineCheckpoint.ts

Factory that builds a single checkpoint group from the cached portal GLB model:

**Components per checkpoint:**

1. **Floor Pad** — dark rounded-rect (`COL_PAD`), slightly raised, with cyan trim line
2. **Portal Model** — cloned from cached GLB, scaled to `MODEL_TARGET_HEIGHT` (2.5), grounded via bounding box
3. **Year Label** — CanvasTexture sprite above portal top, always faces camera
4. **Activation Ring** — thin cyan ring around the pad, pulses/breathes
5. **Ground Glow Disc** — radial gradient, proximity-reactive opacity

**Model Loading:**

- GLB loaded once in `loadPortalModel()`, cached in `portalCache`
- Each checkpoint clones the scene, scales, and grounds independently
- All `MeshStandardMaterial`s on the clone are deep-cloned for independent emissive control
- Base emissive intensity stored in `userData.baseEmissiveIntensity`

**Pillar Collision:**

- `group.userData.collisionPoints`: two `[x, z]` offsets (left/right pillar)
- `group.userData.collisionRadius`: 0.25 (narrow pillar radius)
- Player can walk through the gate opening but not through the solid frame

**Portal Model:**

- `/models/Meshy_AI_Neon_Quantum_Portal_0216123143_texture.glb`
- `MODEL_TARGET_HEIGHT`: 2.5 units

#### createTimelineStops.ts

Creates all timeline stops, manages animations and proximity lighting:

**Completion State:**

- `completedStops` Set tracks visited checkpoint IDs
- `markStopCompleted(id): boolean` — returns `true` on first-time completion (used to trigger gate unlock animation), `false` if already completed
- `isStopCompleted(id)` — called from App.ts, cvPanel, and gateUnlockAnimation
- Completed stops get persistent brighter glow

**Per-frame Updates:**

- `updateTimelineAnimations(stops, time)`: ring breathing, trim opacity, label bob, glow disc pulse
- `updateTimelineLighting(stops, playerPosition)`: point light intensity, accent emissive, model emissive, glow disc opacity, ring opacity — all lerp based on distance

**Key Constants:**

- `BASE_LIGHT_INTENSITY`: 0.3, `MAX_LIGHT_INTENSITY`: 2.2
- `BASE_EMISSIVE`: 0.2, `MAX_EMISSIVE`: 0.8
- `COMPLETED_EMISSIVE_BOOST`: 0.15

### Gate Panel (`src/ui/gatePanel.ts`)

Floating proximity panel for timeline gates. Fades in from the right as the player approaches, showing company context, bullets, and a two-state CTA. Clicking the card or pressing E (when in range) opens the full cinematic overlay.

**Position:** `right: 3vw; top: 50%` — vertically centered, fixed to the right side

**Proximity radius for panel:** `2.5` units (tighter than the global `PROXIMITY_RADIUS = 3.5`) — ensures the panel for one gate fully fades out before the next gate's panel fades in, preventing content overlap between adjacent gates (spacing ≈ 4.33 units on a 16-unit bridge).

**API:**
- `initGatePanel()` — creates the DOM element once (called during app setup)
- `updateGatePanel(data: StopData | null, proximityFactor: number, canInteract?: boolean, onInteract?: () => void)` — called every frame. Drives panel opacity and slide. `canInteract` unlocks the CTA button and card click; `onInteract` is invoked on click or E press.

**Behavior:**
- **Crossfade on gate switch**: when `data.id` changes while the panel is visible, the card fades to `opacity:0` (200ms), swaps content, then fades back in — prevents content pop when walking between gates
- **Two-state CTA** at panel bottom:
  - _Approaching_: muted `↑ walk closer to interact` hint (default visible)
  - _In range_: glowing animated `[E] Open full story →` button (CSS class `.gp-active` triggers slide-up + fade-in)
  - Transitions between states use CSS `opacity`/`transform` — no `display` toggling
- Card is `pointer-events: auto` and clickable — triggers `onInteract` callback when in range
- Title split on ` — ` into year badge + company/role
- `#controls-hint` (intro control legend) hidden via CSS `body.transition-open #controls-hint` when overlay is open

**Tilt effect:** Applied to the inner card via `addTiltEffect` with `useGlobalMouse: true`, so the 3D tilt tracks the cursor even though the outer positioner has `pointer-events: none`.

### Transition System (`src/ui/transition.ts`)

Cinematic overlay system triggered by pressing E or clicking the gate panel CTA when within `INTERACT_RADIUS` of a timeline gate.

**Features:**
- Smoothly zooms camera to stop position, blurs backdrop
- Displays company logo, year badge, role, period, context paragraph, bullet list, and skill chips
- `max-height: min(620px, calc(92vh - 2rem))` caps the card; `#cinematic-panel-body` is `overflow-y: auto` so content-heavy cards (e.g. ASML with 6 bullets) scroll rather than overflow the viewport
- Image panel (`width: 235px`, `align-self: stretch`) stays pinned at full card height while the body column scrolls
- ESC pill close button (`[ESC] Close ×`) in the top-right of the card; a muted "click backdrop to close" hint appears below the card
- `body.transition-open` class added on open / removed on close — CSS rule hides `#controls-hint` (intro control legend) during overlay
- Animates camera back to gameplay position on close (ESC, close button, or backdrop click)

**Skills section (`#cinematic-skills`):**
- Appears below bullets, separated by a faint divider, labeled "TECH STACK" in small caps
- Each skill is a rounded pill chip: `rgba(0,229,204,0.06)` background, subtle cyan border
- Rendered from `data.skills[]`; hidden if no skills provided

### CV Panel — "The Living Dossier" (`src/ui/cvPanel.ts`)

Tabbed résumé modal accessible via the "Resume" pill button in the top-right corner. Designed as a **living dossier** that bridges the 3D exploration and a traditional CV — experience sections unlock as the player walks through timeline gates.

**Opening the panel:** Click the `#cv-btn` pill button (top-right, `z-index: 2000`). ESC or clicking the backdrop closes it. Dynamic content (unlock states, progress) refreshes on every open.

**DOM structure (flex-column with tab switching):**
1. `#cv-topbar` — `flex-shrink: 0`, non-scrolling. Contains the `[ESC] Close ×` pill button.
2. `#cv-tabs` — Tab bar with 4 buttons: **Overview**, **Journey**, **Stack**, **About**. Active tab has cyan underline indicator. Tab switch triggers CSS fade animation.
3. `.cv-tab-panel` containers — one per tab, `flex: 1; overflow-y: auto`. Only the active panel is visible (`display: block`).
4. `#cv-footer` — `flex-shrink: 0`, non-scrolling. Centered "Download Full CV" CTA.

**Tab Architecture:**

| Tab | Content | Purpose |
|---|---|---|
| **Overview** | Hero + summary + signature skills (6 chips) + availability badge + contact row + journey progress | The "30-second glance" — most recruiters never need more |
| **Journey** | Experience timeline with unlock states tied to gate visits, dot-nav | Deep-dive for serious evaluation |
| **Stack** | Competency map with categorized cards, context labels, core skill highlighting | Technical screeners who need to checkbox-match |
| **About** | "Working With Me" blurb, education, interests | Culture-fit closer |

**Living Dossier Mechanic:**
- `refreshDynamicContent()` runs on every `openCVPanel()` call
- Reads `isStopCompleted(id)` from `createTimelineStops.ts` for each timeline entry
- **Unlocked entries**: normal display; first-time unlocks play a shimmer gradient animation (`cvShimmer` keyframe, 1.4s)
- **Locked entries**: body at `opacity: 0.35`, `filter: saturate(0.2)`, with a dashed-border hint: "Walk through the [year] gate to see this story come alive"
- `seenUnlocks` Set tracks which shimmer animations have already played (prevents re-shimmer on re-open)

**Overview Tab (`#cv-tab-overview`):**
- Hero cover photo: `alex-office.png` at **22% opacity** with stronger 4-stop gradient mask
- Availability badge: green pulsing dot (`#4ade80`, `cvAvailPulse` animation) + "Open to opportunities · Full-time / Contract" — positioned directly under the title for maximum HR visibility
- Signature Stack: 6 headline skills (React, TypeScript, Node / NestJS, Nx Monorepo, Redis, Microservices) as cyan-bordered chips
- Contact pills: `border-color: rgba(255,255,255,0.16)`, `background: rgba(255,255,255,0.04)` — more visible than before against dark background
- Journey Progress: visual gate timeline showing `●` (completed) / `○` (unexplored) per milestone with connecting lines, e.g. "3 of 4 milestones explored"

**Journey Tab (`#cv-tab-journey`):**
- Experience entries with `data-stop-id` attributes for dynamic unlock tracking
- Dot-nav (`.cv-dot-nav`): sticky vertical dots on the left edge, one per entry; click scrolls to entry; active dot highlights via scroll event tracking
- ASML career pivot narrative: italic block beneath the ASML entry with amber left border, framing the semiconductor-to-software reinvention story
- The5ers inline photo thumbnail: teaching photo (`/img/alex-teaching.png`) with lightbox zoom-on-click via `attachZoomHint`, captioned "Architecture training session — The5ers, 2024"
- Company logos in white pills, per-role skill chips, highlighted metrics/keywords via `highlightUtils`

**Stack Tab (`#cv-tab-stack`):**
- Competency map organized as category cards (`.cv-competency-card`) with left cyan accent border
- 5 categories: Frontend, Backend, Data & Storage, DevOps & Infra, Engineering & Leadership
- Each card has a context label (e.g. "Node.js primary since 2023, PHP/Laravel at Restigo & Triolla")
- Core skills marked with `.core` class — stronger background and border for visual hierarchy

**About Tab (`#cv-tab-about`):**
- "Working With Me" section: blockquote-style card with decorative `"` glyph, describing collaboration style (high-ownership, document-first, mentor-by-pairing)
- Education: B.Sc. Electrical & Electronics Engineering, Ariel University
- Beyond the Code: interest tags (Motorcycles, Mountain Biking, 3D / Game Dev, System Design, Travel)

**Font:** **Inter** loaded from Google Fonts applied to `#cv-overlay` and `#cv-btn`.

**Animation:** Panel scales from `scale(0.96) translateY(16px)` to `scale(1) translateY(0)` with `opacity 0→1` via CSS class toggle (`.cv-visible`). Tab switch uses `cvTabFade` keyframe (0.28s ease-out). Close removes the class and waits 360ms before `display: none`.

**Images used:**
- `/public/img/alex-headshot.png` — professional headshot (circular avatar)
- `/public/img/alex-office.png` — office/desk photo (hero cover background, 22% opacity)
- `/public/img/alex-teaching.png` — architecture training session photo (The5ers Journey entry thumbnail, lightbox-zoomable)

### Gate Unlock Animation (`src/ui/gateUnlockAnimation.ts`)

Multi-phase particle animation system that bridges the 3D game world and the 2D Resume button UI. Fires on first-time gate completion.

**Exports:**
- `initGateUnlockAnimation()` — inject styles, create progress dots beneath Resume button (called once at app setup)
- `triggerGateUnlock(gateWorldPos, camera)` — project gate 3D position to screen, run full 3-phase animation
- `refreshProgressDots()` — sync dot fill states with `isStopCompleted()` (called on CV panel open)

**Animation Pipeline:**
1. Project gate `THREE.Vector3` to screen coordinates via `camera.project()`
2. Create 4 DOM motes at projected position, scatter outward (280ms burst)
3. Each mote follows a unique quadratic bezier arc toward `#cv-btn` center (520ms travel, 0.06 stagger per mote)
4. On arrival: remove motes, elastic scale pulse on button, sonar ring expansion (CSS `gateRingPulse` keyframe), 2.5s sustained glow
5. Update progress dots, show first-unlock tooltip if applicable

**Progress Dots:**
- 4 small dots (`#cv-btn-dots`) appended inside `#cv-btn`
- `.cv-btn-dot.filled` — cyan with glow shadow
- `#cv-btn.cv-btn-has-unlocks` — persistent border/shadow enhancement

**First-Unlock Tooltip:**
- `#gate-unlock-tooltip` — fixed-position element below Resume button
- Shown once per session on the very first gate completion
- Text: "Your dossier is building…" — fades after 3.2 seconds

**Key Constants:**
- `MOTE_COUNT`: 4
- `BURST_MS`: 280 (scatter phase)
- `TRAVEL_MS`: 520 (bezier arc phase)

**Integration in App.ts:**
- `markStopCompleted()` returns `boolean` — `true` on first-time completion
- If first time: `onClosed` callback passed to `openTransition` triggers `triggerGateUnlock` after 900ms delay (waits for camera return animation)

### Collision System (`src/collision/`)

**checkCollisions.ts:**

- Detects when character is within `PROXIMITY_RADIUS` of a stop
- Shows proximity UI when nearby
- Triggers interaction when within `INTERACT_RADIUS` and E is pressed

**stopCollision.ts:**

- Prevents character from walking through stops
- Default: single circle per stop (`STOP_COLLISION_RADIUS = 0.85`)
- **Per-pillar collision**: If `stop.group.userData.collisionPoints` exists (array of `[x, z]` offsets), checks each sub-point with `stop.group.userData.collisionRadius` instead — used by timeline gates so the player can walk through the opening but not the frame

### Map Bounds (`src/scene/bounds.ts`)

Multi-zone boundary system. `isInsideMap(x, z, margin)` returns `true` if the point is inside **any** of three zones:

1. **Arena hex** (`isInsideArena`) — point-in-polygon on the main hex (radius 12, same angle offset as `createGround`)
2. **Bridge rectangle** (`isInsideBridge`) — axis-aligned box: X ∈ [−BRIDGE_HALF_WIDTH, +BRIDGE_HALF_WIDTH], Z ∈ [BRIDGE_NEAR_Z, BRIDGE_FAR_Z]
3. **Spawn pad hex** (`isInsideSpawnPad`) — point-in-polygon on the smaller hex centred at `(0, SPAWN_CENTER_Z)`

All three zones use the `margin` parameter (character collision radius) so the character cannot walk to the very edge.

**Key constants (all from `layoutConstants.ts` — single source of truth):**

- `SIZE`: 12, `SIDES`: 6
- `ARENA_APOTHEM`: `≈ 10.392`
- `BRIDGE_LENGTH`: 16, `BRIDGE_WIDTH`: `≈ 4.2`
- `BRIDGE_NEAR_Z`: `≈ 10.392`, `BRIDGE_FAR_Z`: `≈ 26.392`
- `SPAWN_SIZE`: `≈ 4.606`, `SPAWN_CENTER_Z`: `≈ 30.38`

## Controls

- **WASD** or **Arrow Keys**: Move player character
- **Shift**: Run (faster movement) - dog will match your speed
- **E**: Interact with nearby stops
- **ESC**: Close transition overlay
- **M**: (Planned) Open map

## Character System Overview

The project uses an object-oriented character system with a base class that provides shared functionality:

### BaseCharacter (Abstract Base Class)

All characters inherit from `BaseCharacter`, which provides:

- **Physics Engine**: Velocity-based steering with acceleration, deceleration, and arcing turns
- **Animation System**: State machine with smooth cross-fading (idle/walk/run)
- **Visual Effects**: Auto-rotation to face movement direction, lean into turns
- **Collision Detection**: Map boundaries and stop collision
- **GLTF Loading**: Utilities for loading models and animations

### Character Types

1. **PlayerCharacter**: Keyboard-controlled player
   - Input from WASD/Arrow keys
   - Shift-to-run mechanic
   - Wave animation for intro sequence
2. **DogCompanion**: AI-controlled follower
   - Realistic follow behavior with delayed reactions
   - State machine: resting → following → settling
   - Procedural idle animations (tail wag, breathing, head bob)
   - Procedural running gait (gallop bounce, spine flex, head pump)
   - Matches player sprint speed
3. **Future Characters**: The system is extensible
   - Create new character types by extending `BaseCharacter`
   - Implement custom `getMovementInput()` for AI behavior
   - Add character-specific animations and features

## Development Workflow

### Running the Project

```bash
npm install    # Install dependencies
npm run dev    # Start dev server (typically http://localhost:5173)
npm run build  # Production build
npm run preview # Preview production build
```

### Adding New Portfolio Stops

Edit `src/scene/createStops.ts`:

```typescript
const STOPS_CONFIG: Array<{
  position: [number, number, number];
  data: { id: string; title: string; description: string };
  shape: "box" | "cylinder";
}> = [
  // Add your new stop here
  {
    position: [x, y, z],
    data: {
      id: "unique-id",
      title: "Project Title",
      description: "Project description...",
    },
    shape: "box", // or "cylinder"
  },
];
```

### Modifying Character Models

**For Player Character:**

1. Place GLTF files in `/public/models/`
2. Update paths in `PlayerCharacter.create()` method in `src/scene/characters/PlayerCharacter.ts`
3. Ensure animations are named correctly (first animation in file is used)
4. Model will be auto-scaled to 0.4 units height

**For Dog Companion:**

1. Place GLTF files in `/public/models/`
2. Update path in `DogCompanion.create()` method in `src/scene/characters/DogCompanion.ts`
3. Adjust `DOG_MODEL_HEIGHT` constant if needed (currently 0.38)
4. Ensure skeleton has recognizable bone names (tail, spine, head) for procedural animations

**Creating New Character Types:**

The character system is designed to be extensible. Here's how to create a new character type:

1. **Create a new class** in `src/scene/characters/YourCharacter.ts`:

```typescript
export class YourCharacter extends BaseCharacter {
  private constructor(group: THREE.Group) {
    super(group, {
      radius: 0.3,
      walkSpeed: 0.05,
      runSpeed: 0.12,
      acceleration: 0.01,
      deceleration: 0.9,
    });
  }

  // Define movement behavior (AI, pathfinding, scripted, etc.)
  protected getMovementInput(): MovementInput {
    // Your logic here - return direction and speed
    return { dirX: 0, dirZ: 0, maxSpeed: 0, hasInput: false };
  }

  // Optional: Override updateAnimations for custom animations
  protected override updateAnimations(
    deltaSec: number,
    input: MovementInput,
  ): void {
    super.updateAnimations(deltaSec, input);
    // Add character-specific animation logic
  }

  // Factory method
  static async create(
    scene: Scene,
    onAssetLoaded?: () => void,
  ): Promise<YourCharacter> {
    const group = new THREE.Group();
    group.rotation.order = "YZX";
    scene.add(group);

    const character = new YourCharacter(group);
    const loader = new GLTFLoader();

    // Load models and animations using BaseCharacter utilities
    const model = await BaseCharacter.loadCharacterModel(
      loader,
      "/models/your_model.glb",
      0.5,
    );
    BaseCharacter.setupModelMaterials(model);
    group.add(model);

    // Set up animation mixer and actions...
    return character;
  }
}
```

2. **Export from** `src/scene/characters/index.ts`:

```typescript
export { YourCharacter } from "./YourCharacter";
```

3. **Instantiate in** `App.ts`:

```typescript
const yourCharacter = await YourCharacter.create(scene, assetLoaded);
```

4. **Update in animation loop**:

```typescript
yourCharacter.update(deltaSec, stops);
```

**Example Use Cases:**

- **Bug/Insect Character**: Wanders randomly, avoids player
- **Cat Companion**: Similar to dog but with different follow distance and idle behavior
- **NPC Character**: Scripted patrol path with dialogue triggers
- **Bird Character**: Flies above ground, different physics constants

### Adjusting Camera Behavior

Modify constants in `src/App.ts`:

- `CAMERA_HEIGHT`: Vertical camera position
- `CAMERA_DISTANCE`: Distance behind character
- `CAMERA_OFFSET_X`: Horizontal offset
- `CAMERA_LERP`: Smoothing speed (lower = smoother but slower)

### Customizing Intro Sequence

Edit `src/scene/introSequence.ts`:

- Modify text content in the `update()` method
- Adjust timing in phase transitions
- Change terminal styling in constructor

## Technical Details

### Animation System

**Standard Animation System (Player & Dog Walk):**

- Uses Three.js `AnimationMixer` for character animations
- Smooth blending between animation states
- Animation actions fade in/out for smooth transitions
- Speed-adaptive playback rates (walk/run timescale)

**Procedural Animation System (Dog Idle & Run Gait):**

- **Two-pass approach:**
  1. Slerp bones toward rest pose (blend factor)
  2. Apply procedural effects on top
- **Idle animations:** Direct bone quaternion manipulation for:
  - Tail wag (staggered phase per bone)
  - Breathing (spine oscillation)
  - Head bob (slow nod)
- **Run gait animations:** Layered effects during sprint:
  - Vertical bounce (group position Y)
  - Spine flex (compression/extension)
  - Head pump (synced with stride)
  - Tail streaming (extends behind)
- **Bone discovery:** Automatic detection via regex patterns
- **Blend factors:** Smooth transitions (exponential interpolation)
- **Performance:** Reusable quaternions/eulers to avoid allocations

### Lighting & Tone

**Lights:**

- **Ambient Light**: Base illumination (0.4 intensity)
- **Directional Light**: Main sun light with shadows (0.6 intensity, warm 0xfff5e6)
- **Fill Light**: Soft blue fill from opposite side (0.2 intensity)
- **Hemisphere Light**: Sky/ground color gradient (0.25 intensity)
- **Rim Light**: Edge lighting for depth (0.2 intensity)
- **Point Lights**: Dynamic lights on stops that intensify with proximity

**Tonemapping & Atmosphere:**

- ACES Filmic tonemapping with exposure 0.62
- Exponential fog (`FogExp2`, color `0x1a1d2e`, density 0.052) — helps the platform sit in space and softens harsh contrast at edges

### Post-Processing

Post-processing effects are configured in `src/scene/postProcessing.ts`:

- Uses `EffectComposer` for advanced rendering
- Configured in `createScene.ts`

### Environment Map

Environment map loading handled in `src/scene/environment.ts`:

- Provides reflections and ambient lighting
- Loaded asynchronously

### Shadow System

- Shadow maps enabled with `PCFSoftShadowMap`
- Shadow map resolution: 2048x2048
- Characters (player and dog) and stops cast shadows
- Ground receives shadows
- Character models automatically configured for shadows in `setupModelMaterials()`

## Performance Considerations

- **Frame-rate independent physics**: movement speed is consistent regardless of FPS — avoids slowdowns in visually heavy areas (spawn pad / bridge)
- Character animations use efficient GLTF clips
- Bridge uses transparent `MeshStandardMaterial` (not `MeshPhysicalMaterial` transmission) to avoid FPS drops
- Bridge edge lights limited to 4 (not per-unit along length) for performance
- Post-processing effects are optimized
- Shadow maps use reasonable resolution (2048x2048)
- Portal GLB loaded once, cloned per checkpoint (4 clones from 1 load)
- Camera lerp prevents jittery movement (0.045 factor)
- Dog procedural animations use reusable quaternions (no per-frame allocations)
- Asset loading happens in parallel with intro sequence
- Elegant progress indicator shows loading status
- Bone discovery happens once at initialization

## Future Enhancements

Based on the README and codebase:

- [x] Replace basic stop shapes with polished 3D portal models (Timeline Road)
- [x] Add richer project content (subtitle, bullets, links in cinematic overlay)
- [x] Spawn pad + Timeline Bridge entry zone (Phase 1 structural layout)
- [ ] Implement map view (M key)
- [ ] Mobile touch controls
- [ ] Multiple map areas/levels
- [ ] Sound effects and background music
- [ ] More character animations (sit, jump, dance)
- [ ] More dog animations and behaviors (sit on command, fetch, play)
- [ ] Additional companion types (cat, bird, etc.) using BaseCharacter
- [ ] Project categories/filtering
- [ ] Save/load system for progress
- [ ] Analytics tracking
- [ ] NPC characters with dialogue
- [ ] Day/night cycle with different lighting

## Common Tasks

### Changing the Map Shape

Edit `src/scene/bounds.ts`:

- Modify `SIZE` for map radius
- Change `SIDES` for different polygon shapes
- Adjust `HEX_VERTICES` calculation for custom shapes

### Adjusting Movement Speed

**Player Movement:**
Edit `src/scene/characters/PlayerCharacter.ts`:

- `PLAYER_WALK_SPEED`: Normal movement speed (currently 0.04)
- `PLAYER_RUN_SPEED`: Running speed when Shift held (currently 0.1)
- `PLAYER_ACCELERATION`: How quickly speed builds up (currently 0.012)
- `PLAYER_DECELERATION`: Friction when releasing keys (currently 0.88)

**Dog Movement:**
Edit `src/scene/characters/DogCompanion.ts`:

- `DOG_WALK_SPEED`: Dog's relaxed trot speed (currently 0.016)
- `DOG_RUN_SPEED`: Dog's sprint speed (currently 0.065)
- `DOG_ACCELERATION`: Dog's acceleration rate (currently 0.004)
- `DOG_DECELERATION`: Dog's friction (currently 0.91)

**Follow Behavior Tuning:**
Also in `DogCompanion.ts`:

- `FOLLOW_OFFSET_BEHIND`: Distance behind player (currently 2.2)
- `COMMIT_DISTANCE`: How far player must move before dog follows (currently 2.2)
- `REACTION_DELAY`: Delay before dog starts moving (currently 0.45s)
- `CATCH_UP_RADIUS`: Distance at which dog starts sprinting (currently 3.5)

### Customizing Ground Appearance

Edit `src/scene/createGround.ts`:

**Palette:**

- `COL_BASE`: Rim/body color (currently `0x7b8fa3` — cool light gray-blue)
- `COL_FLOOR`: Inner plate color (currently `0x1f2b38` — deep slate)
- `COL_ACCENT`: Emissive trim color (currently `0x00e5cc` — cyan/teal)
- `COL_HUB`: Center hub plate color (currently `0x263a4a` — between floor and base)

> `COL_ROAD` has been removed. The bridge floor in `createSpawnPad.ts` uses `bridgeGlassMat` (transparent glass). Bridge width comes from `layoutConstants.ts`.

**Center hub:**

- `HUB_RADIUS`: Hub plate radius (currently 3.0)
- `HUB_HEIGHT`: Hub elevation above floor (currently 0.035)
- `HUB_RING_RADII`: Concentric ring positions (currently [1.0, 1.8, 2.6])

**Edge effects:**

- `BARRIER_HEIGHT`: Energy barrier height (currently 0.8)
- `VOID_CASCADE_HEIGHT`: Void cascade drop distance (currently 3.0)
- `PARTICLE_COUNT`: Number of ambient particles (currently 80)
- Adjust `barrierMat` shader opacity uniform (currently 0.12)
- Adjust `voidCascadeMat` shader opacity uniform (currently 0.2)

**Bridge appearance:**

The Timeline Bridge in `createSpawnPad.ts` is a thin glass slab (`BRIDGE_DEPTH = 0.25`, `bridgeGlassMat`). To adjust width, edit `BRIDGE_WIDTH` in `layoutConstants.ts` (and keep `bounds.ts` in sync). Bridge-specific effects: runway strip, stream particles, destination glow, edge lights.

**Edge pylons:**

- Edit `PYLON_CONFIGS` array to add/remove/reposition pylons
- Each entry: `{ pos: [x, y, z], size: [w, h, d], rotY: radians }`
- Pylons are decorative — not in collision system

**Material tuning:**

- Adjust roughnessMap `baseRoughness` in `createNoiseRoughnessMap()` calls (controls effective roughness since material.roughness = 1.0)
- Lower `envMapIntensity` to reduce environment reflections
- Lower `metalness` to reduce specular highlights

**Accent underglow:**

- Adjust `accentMat.emissiveIntensity` (currently 0.35)
- Change ring spread via the `createHexShape(SIZE * outer)` / `createHexPath(SIZE * inner)` ratios (currently 1.0 / 0.45)
- Adjust `underLight.intensity` base value (currently 0.5)

### Customizing Timeline Content

Edit `src/scene/timeline/timelineConfig.ts`:

- Add/remove/edit entries in the `TIMELINE_STOPS` array
- Each entry needs: `id`, `year`, `title`, `subtitle`, `bullets`
- Optional fields: `skills` (chip array shown in cinematic overlay), `image`, `imageCaption`, `companyContext`, `logo`
- Positions are auto-calculated in `timelineLayout.ts` (straight line along bridge Z axis, evenly spaced)
- To change bridge length, edit `BRIDGE_LENGTH` in `layoutConstants.ts` (single source of truth — all dependent constants update automatically)
- To change gate spacing, edit `ROAD_PADDING` in `timelineLayout.ts`
- To move the bridge to a different hex face, change `BRIDGE_NEAR_Z` to point to the desired apothem and update `bounds.ts` accordingly

**Changing the portal model:**

1. Place new GLB in `/public/models/`
2. Update `PORTAL_MODEL_PATH` in `createTimelineCheckpoint.ts`
3. Adjust `MODEL_TARGET_HEIGHT` if needed (currently 2.5)
4. Pillar collision points may need updating (`collisionPoints` offsets near bottom of factory)

### Customizing Stop Appearance

Edit `src/scene/createStops.ts`:

- `STOP_COLORS`: Array of colors for stops
- Modify geometry sizes in `createStops()`
- Adjust animation parameters in `updateStopAnimations()`
- Change particle count and behavior

### Styling the Transition Overlay

Edit `src/ui/transition.ts`:

- Modify CSS styles in `getOrCreateOverlay()`
- Adjust animation timing (`DURATION_MS`)
- Change easing function (`EASE_OUT`)

## Troubleshooting

### Character Not Loading

- Check that model files exist in `/public/models/`
- Verify file paths match exactly (case-sensitive)
- Check browser console for loading errors
- Ensure `assetLoaded()` callback is being called
- Check progress indicator for asset loading status

### Character Falls Through Ground

- Verify ground is created before character
- Check character Y position initialization (should be 0)
- Model auto-positioning sets feet at y = 0 in `loadCharacterModel()`

### Dog Not Following Player

- Check that dog is created with correct player group reference
- Verify `COMMIT_DISTANCE` and `COMMIT_TIME` values aren't too high
- Check console for bone discovery messages
- Ensure dog's `update()` is being called in animation loop
- Try `dog.snapToPlayer()` to reset position if stuck

### Stops Not Interacting

- Verify `PROXIMITY_RADIUS` and `INTERACT_RADIUS` values
- Check that E key is being detected (`keyboardController.ts`)
- Ensure `checkProximityAndInteract` is called in animation loop

### Camera Jitter

- Adjust `CAMERA_LERP` value (try lower values like 0.03)
- Check frame rate (use browser dev tools)
- Verify delta time calculation is correct

### Performance Issues

- Reduce shadow map resolution
- Lower particle counts
- Disable post-processing temporarily
- Check for memory leaks in animation loop

## Code Style

- TypeScript strict mode enabled
- ES6 modules (`type: "module"`)
- Consistent naming: camelCase for variables, PascalCase for classes
- Three.js objects use `THREE.*` namespace
- Async/await for asset loading
- RequestAnimationFrame for animation loop
- Object-oriented design with inheritance (BaseCharacter)
- Factory pattern for character creation (static `create()` methods)
- Template method pattern (BaseCharacter defines algorithm, subclasses implement steps)
- Configuration constants at file top
- Protected methods for overridable behavior
- Readonly properties for immutable config

## Dependencies

```json
{
  "three": "^0.160.0",
  "@types/three": "^0.182.0",
  "typescript": "^5.0.0",
  "vite": "^5.0.0"
}
```

## Build Output

Production build outputs to `/dist/`:

- Optimized JavaScript bundle
- Assets (models, etc.) copied to public path
- HTML file with script references

---

_This document provides a comprehensive guide to understanding and working with the 3D Portfolio codebase. For specific implementation details, refer to the source code and inline comments._
