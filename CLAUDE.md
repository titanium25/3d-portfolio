# CLAUDE.md - 3D Portfolio Project Guide

## Project Overview

This is an interactive 3D portfolio experience built with Three.js, TypeScript, and Vite. Visitors explore your work by navigating a character through a stylized 3D landscape, discovering projects at designated stops along the way. The experience feels like a small open-world game with a top-down angled view.

### Core Concept

- **Map**: A hexagonal 3D ground plane that acts as the playable area
- **Stops**: 3D markers placed on the map, each representing a project or section
- **Character**: A player-controlled 3D character (loaded from GLTF models) that moves across the map
- **Interaction**: When the character approaches a stop, proximity UI appears. Pressing E opens a cinematic transition with project details

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
│   ├── createScene.ts      # Scene, camera, renderer, lighting setup
│   ├── createGround.ts     # Ground plane creation
│   ├── createStops.ts      # Portfolio stop markers creation
│   ├── CharacterController.ts  # Character movement and animation
│   ├── introSequence.ts    # Opening cinematic sequence
│   ├── environment.ts      # Environment map loading
│   ├── postProcessing.ts   # Post-processing effects
│   ├── bounds.ts           # Map boundary checking (hexagonal)
│   └── types.ts            # TypeScript interfaces
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

- Initializes the 3D scene, character, and stops
- Manages the animation loop
- Handles camera following (smooth lerp)
- Coordinates intro sequence
- Manages proximity detection and interactions
- Controls transition overlays

**Key Constants:**

- `CAMERA_HEIGHT`: 3 (camera Y position)
- `CAMERA_DISTANCE`: 5 (camera Z offset from character)
- `CAMERA_OFFSET_X`: 3 (camera X offset from character)
- `CAMERA_LERP`: 0.045 (camera smoothing factor)

### CharacterController (`src/scene/CharacterController.ts`)

Manages the 3D character:

- Loads GLTF models for idle, walk, run, and wave animations
- Handles character movement with acceleration/deceleration
- Manages animation blending and transitions
- Enforces map boundaries and stop collision
- Rotates character to face movement direction

**Movement Constants:**

- `PLAYER_RADIUS`: 0.5 (collision radius)
- `PLAYER_WALK_SPEED`: 0.06
- `PLAYER_RUN_SPEED`: 0.15 (when Shift is held)
- `PLAYER_ACCELERATION`: 0.012
- `PLAYER_DECELERATION`: 0.92 (friction factor)

**Character Models:**

- `/models/Meshy_AI_Animation_Idle_11_withSkin.glb`
- `/models/Meshy_AI_Animation_Walking_withSkin.glb`
- `/models/Meshy_AI_Animation_Running_withSkin.glb`
- `/models/Meshy_AI_Animation_Wave_One_Hand_withSkin.glb`

### IntroSequence (`src/scene/introSequence.ts`)

Handles the opening cinematic:

1. **Closeup**: Camera focuses on character
2. **Text phases**: Terminal-style text appears with typing animation
3. **Pullback**: Camera smoothly transitions to gameplay position
4. **Hint**: Control legend appears
5. **Complete**: Character waves, overlay fades out

The intro uses a retro terminal aesthetic with green text, CRT scanlines, and typing effects.

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

- **WASD** or **Arrow Keys**: Move character
- **Shift**: Run (faster movement)
- **E**: Interact with nearby stops
- **ESC**: Close transition overlay
- **M**: (Planned) Open map

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

1. Place GLTF files in `/public/models/`
2. Update paths in `CharacterController.create()` method
3. Ensure animations are named correctly (first animation in file is used)

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

- Uses Three.js `AnimationMixer` for character animations
- Smooth blending between idle/walk/run/wave states
- Animation actions fade in/out for smooth transitions

### Lighting

- **Ambient Light**: Base illumination (0.4 intensity)
- **Directional Light**: Main sun light with shadows (0.6 intensity)
- **Fill Light**: Soft blue fill from opposite side
- **Hemisphere Light**: Sky/ground color gradient
- **Rim Light**: Edge lighting for depth
- **Point Lights**: Dynamic lights on stops that intensify with proximity

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
- Character and stops cast shadows
- Ground receives shadows

## Performance Considerations

- Character animations use efficient GLTF clips
- Post-processing effects are optimized
- Shadow maps use reasonable resolution
- Particle counts are limited (8 per stop)
- Camera lerp prevents jittery movement

## Future Enhancements

Based on the README and codebase:

- [ ] Replace basic shapes with polished 3D models
- [ ] Add richer project content (images, links, videos)
- [ ] Implement map view (M key)
- [ ] Mobile touch controls
- [ ] Multiple map areas/levels
- [ ] Sound effects and background music
- [ ] More character animations
- [ ] Project categories/filtering
- [ ] Save/load system for progress
- [ ] Analytics tracking

## Common Tasks

### Changing the Map Shape

Edit `src/scene/bounds.ts`:

- Modify `SIZE` for map radius
- Change `SIDES` for different polygon shapes
- Adjust `HEX_VERTICES` calculation for custom shapes

### Adjusting Movement Speed

Edit `src/scene/CharacterController.ts`:

- `PLAYER_WALK_SPEED`: Normal movement speed
- `PLAYER_RUN_SPEED`: Running speed (Shift key)
- `PLAYER_ACCELERATION`: How quickly speed builds up
- `PLAYER_DECELERATION`: Friction when releasing keys

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

### Character Falls Through Ground

- Verify ground is created before character
- Check character Y position initialization
- Ensure collision detection is working

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
