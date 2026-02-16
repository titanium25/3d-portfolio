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

**Ground Platform Visual Overhaul** ✨

The floating megastructure ground has been significantly refined for visual quality and composition:

- **Specular fix**: Roughness/metalness/envMap rebalanced to eliminate hot-spot glare (roughnessMap × material.roughness double-attenuation issue fixed — material.roughness set to 1.0 so map alone controls)
- **Road-ready strip**: Dark directional path along Z-axis with accent edge lines and center dashes — signals "this is where you go"
- **Edge pylons**: 5 asymmetric placeholder volumes near the rim with accent caps — break up emptiness, provide scale
- **Calmed accent underglow**: Lower emissive intensity (0.4 → 0.25) with wider spread (70%–96% vs 78%–92%)
- **Contrast hierarchy**: Road (darkest) → inner plate (mid) → rim/body (lightest) → cyan accents
- **Exposure & fog**: Tonemapping exposure lowered (0.7 → 0.62), fog density nudged (0.045 → 0.052) for softer contrast

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
│   ├── createScene.ts      # Scene, camera, renderer, lighting setup
│   ├── createGround.ts     # Ground plane creation
│   ├── createStops.ts      # Portfolio stop markers creation
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
│   └── stopCollision.ts    # Stop collision checking
│
└── ui/                     # User interface
    ├── transition.ts       # Cinematic transition overlay
    ├── proximityUI.ts      # Proximity indicator UI
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
- Manages proximity detection and interactions
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
- Total: 7 assets with progress tracking
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

Builds the floating megastructure platform — a hexagonal slab with layered surfaces:

**Structure (bottom to top):**

1. **Platform body** — thick ExtrudeGeometry slab with beveled edges (`baseMat`)
2. **Raised rim ring** — stepped inset border (`baseMat`, shared with body)
3. **Inner plate** — dark recessed floor surface (`floorMat`)
4. **Road-ready strip** — darkest surface, Z-axis directional path (`roadMat`)
5. **Underside accent ring** — cyan emissive glow (`accentMat`)
6. **Panel lines** — hex-grid grooves (radial spokes + concentric rings)
7. **Edge trim lines** — brighter accent along rim borders
8. **Edge pylons** — 5 small placeholder volumes near rim (`baseMat` + accent caps)

**Materials (4 surface materials + line materials):**

| Material | Color | Roughness | Metalness | Purpose |
|---|---|---|---|---|
| `baseMat` | `0x7b8fa3` | 1.0 (map: 0.78) | 0.10 | Body, rim, pylons |
| `floorMat` | `0x1f2b38` | 1.0 (map: 0.85) | 0.08 | Inner plate |
| `roadMat` | `0x141c26` | 1.0 (map: 0.85) | 0.06 | Road strip |
| `accentMat` | cyan emissive | 0.9 | 0.0 | Underglow, pylon caps |

> **Note:** `material.roughness` is set to 1.0 so the roughnessMap alone controls effective roughness. This avoids the Three.js double-attenuation trap where `roughness × roughnessMap` produces unexpectedly glossy surfaces.

**Contrast Hierarchy (from 45° camera):**

- Road = darkest (`0x141c26`)
- Inner plate = mid-dark (`0x1f2b38`)
- Rim/body = lightest (`0x7b8fa3`)
- Accent = cyan emissive

**Road Strip:**

- Width: 2.4 units, Length: 18 units (Z = −9 to +9)
- Accent edge lines on both sides + dashed center line (opacity 0.14)
- Sits above inner plate (Y = 0.005) — panel lines beneath are naturally hidden
- Stops at (3, 0.5, 2) and (−3, 0.5, −2) sit along the road

**Edge Pylons:**

- 5 asymmetric boxes at radius ~7–8.5, varied heights (0.35–0.85 units)
- Each slightly Y-rotated to avoid grid-aligned look
- Accent caps (tiny emissive lids) on top
- Decorative only — not in collision system

**Procedural Roughness Maps:**

- Canvas-based noise textures (128px) with coarse + fine passes
- Tiled via RepeatWrapping for micro-sheen variation
- Prevents "flat plastic" appearance on large surfaces

**Key Constants:**

- `SIZE`: 12 (hexagon circumradius)
- `PLATFORM_DEPTH`: 1.5 (slab thickness)
- `ROAD_WIDTH`: 2.4, `ROAD_LENGTH`: 18
- `RIM_INSET`: 0.35, `RIM_WIDTH`: 1.1, `RIM_HEIGHT`: 0.07
- `INNER_RADIUS`: ~10.55 (SIZE − RIM_INSET − RIM_WIDTH)

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

### Transition System (`src/ui/transition.ts`)

Cinematic overlay system that:

- Smoothly zooms camera to stop position
- Displays project information in a styled modal
- Blurs background with backdrop filter
- Animates camera back to gameplay position on close
- Supports ESC key and click-outside-to-close

### Collision System (`src/collision/`)

**checkCollisions.ts:**

- Detects when character is within `PROXIMITY_RADIUS` of a stop
- Shows proximity UI when nearby
- Triggers interaction when within `INTERACT_RADIUS` and E is pressed

**stopCollision.ts:**

- Prevents character from walking through stops
- Uses bounding box checks

### Map Bounds (`src/scene/bounds.ts`)

Hexagonal boundary system:

- `SIZE`: 12 (hexagon radius)
- `SIDES`: 6 (hexagon sides)
- Uses point-in-polygon algorithm to check if position is inside map
- Accounts for character radius with margin

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

- Character animations use efficient GLTF clips
- Post-processing effects are optimized
- Shadow maps use reasonable resolution (2048x2048)
- Particle counts are limited (8 per stop)
- Camera lerp prevents jittery movement (0.045 factor)
- Dog procedural animations use reusable quaternions (no per-frame allocations)
- Asset loading happens in parallel with intro sequence
- Elegant progress indicator shows loading status
- Bone discovery happens once at initialization

## Future Enhancements

Based on the README and codebase:

- [ ] Replace basic stop shapes with polished 3D models
- [ ] Add richer project content (images, links, videos)
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
- `COL_ROAD`: Road strip color (currently `0x141c26` — deepest dark)
- `COL_ACCENT`: Emissive trim color (currently `0x00e5cc` — cyan/teal)

**Road strip:**

- `ROAD_WIDTH`: Road width (currently 2.4)
- `ROAD_LENGTH`: Road length along Z (currently 18)
- `ROAD_DASH_LEN` / `ROAD_DASH_GAP`: Center line dash pattern

**Edge pylons:**

- Edit `PYLON_CONFIGS` array to add/remove/reposition pylons
- Each entry: `{ pos: [x, y, z], size: [w, h, d], rotY: radians }`
- Pylons are decorative — not in collision system

**Material tuning:**

- Adjust roughnessMap `baseRoughness` in `createNoiseRoughnessMap()` calls (controls effective roughness since material.roughness = 1.0)
- Lower `envMapIntensity` to reduce environment reflections
- Lower `metalness` to reduce specular highlights

**Accent underglow:**

- Adjust `accentMat.emissiveIntensity` (currently 0.25)
- Change ring spread via the `createHexShape(SIZE * outer)` / `createHexPath(SIZE * inner)` ratios (currently 0.96 / 0.70)

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
