# 3D Portfolio

## Overview

An interactive 3D portfolio where visitors explore your work by navigating a character across a map. Instead of scrolling through a traditional site, users control a character through a stylized landscape, discovering projects at designated stops along the way.

The experience feels like a small open-world game: you land on a 3D hexagonal map viewed from above with a slight angle, move around with the keyboard, and trigger content when you reach each stop. A loyal dog companion follows alongside you on your journey.

## Core Features

- **Map**: A hexagonal 3D floating megastructure with layered surfaces and boundary collision
  - Road-ready strip along Z-axis — darkest surface that signals "this is where you go"
  - Edge pylons near the rim for scale and composition
  - Procedural roughness maps for realistic material feel
  - Contrast hierarchy: road (darkest) → inner plate → rim/body (lightest) → cyan accents
  - Calmed cyan accent underglow on the underside
- **Timeline Road**: 6 interactive portal gates along the road, each representing a career milestone (2018–2025)
  - GLB portal models with floor pads, activation rings, and year labels
  - Proximity glow: model emissive, point lights, ground glow disc all react to player distance
  - Completion tracking: visited checkpoints glow brighter persistently
  - Pillar collision: walk through the gate opening, blocked by the frame
  - Press **E** to open cinematic overlay with year title, bullets, and links
- **Player Character**: A fully animated 3D character controlled via keyboard
  - Smooth acceleration/deceleration physics
  - Multiple animations: idle, walk, run, and wave
  - Realistic turning with visual lean into curves
  - Collision detection with stops and map boundaries
- **Dog Companion**: An AI-controlled dog that follows the player
  - Realistic follow behavior with delayed reactions
  - Independent path finding and movement
  - Multiple animations synchronized with behavior
  - Procedural idle animations (tail wagging, breathing, head bobbing)
  - Smart collision avoidance with player and stops
- **Cinematic Intro Sequence**: Terminal-style opening with retro aesthetic
  - Camera closeup on character
  - Typing animation with CRT scanlines
  - Smooth pullback transition to gameplay
  - Character wave animation
- **Interaction System**: Proximity-based interactions with cinematic transitions
  - Press **E** when near a checkpoint to view project details
  - Smooth camera zoom to stop position
  - Styled modal overlay with title, subtitle, bullet points, and links
  - Background blur effect
  - Press **ESC** or click outside to close

## Controls

- **WASD** or **Arrow Keys**: Move character
- **Shift**: Run (faster movement)
- **E**: Interact with nearby stops
- **ESC**: Close project overlay

## Current Implementation

The project has evolved from a simple proof of concept to a fully-featured 3D experience:

✅ Animated 3D character with realistic movement physics  
✅ Dog companion with advanced AI follow behavior  
✅ Cinematic intro sequence with camera animations  
✅ Proximity-based interaction system  
✅ Dynamic lighting and visual effects  
✅ Collision detection and boundary enforcement  
✅ Character animation state machine (idle/walk/run)  
✅ Smooth camera following with lerp  
✅ Hexagonal map with boundary checking  
✅ Layered ground platform with road strip and contrast hierarchy  
✅ Edge pylons for composition and scale reference  
✅ Procedural roughness maps and tuned PBR materials  
✅ ACES Filmic tonemapping with atmospheric fog  
✅ Timeline Road with 6 interactive portal gates (2018–2025)  
✅ GLB portal models with proximity glow and completion tracking  
✅ Per-pillar collision (walk through gate openings)  
✅ Rich content overlay (subtitle, bullet points, links)

## Future Enhancements

- Add map view (M key) to see all stops at once
- Mobile touch controls for broader accessibility
- Multiple map areas or levels to explore
- Sound effects and background music
- Additional character animations and interactions
- Project categories and filtering
- Save/load system for progress tracking
- Analytics integration

## Tech Stack

- **Three.js** (v0.160.0) - 3D rendering engine and scene management
- **TypeScript** (v5.0.0) - Type-safe development
- **Vite** (v5.0.0) - Build tool and lightning-fast dev server
- **GLTFLoader** - Loading 3D character models and animations

### Architecture

The project uses a clean, modular architecture:

- **Character System**: Object-oriented design with `BaseCharacter` abstract class
  - `PlayerCharacter` - Keyboard-controlled player
  - `DogCompanion` - AI-controlled follower with procedural animations
- **Timeline Road**: 6 portal checkpoints with GLB models, proximity glow, completion tracking, and per-pillar collision
- **Scene Management**: Modular scene setup with lighting, shadows, fog, tonemapping, and post-processing
- **Ground Platform**: Layered megastructure with road strip, edge pylons, procedural roughness maps, and contrast hierarchy
- **Collision System**: Efficient proximity and collision detection with support for multi-point collision shapes (gate pillars)
- **UI System**: Cinematic transitions with rich content (subtitle, bullets, links), proximity indicators, and loading screens
- **Animation System**: State machine with smooth blending between animations

## Running the Project

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build
npm run preview    # Preview production build
```

## Project Structure

```
src/
├── scene/
│   ├── characters/        # Character classes and types
│   │   ├── BaseCharacter.ts      # Abstract base class
│   │   ├── PlayerCharacter.ts    # Player implementation
│   │   └── DogCompanion.ts       # Dog follower AI
│   ├── timeline/          # Timeline Road system
│   │   ├── timelineConfig.ts          # Content data (years, titles, bullets)
│   │   ├── timelineLayout.ts          # Stop positions along road
│   │   ├── createTimelineCheckpoint.ts # Portal gate + pad + ring + glow
│   │   └── createTimelineStops.ts     # Creation, animation, lighting
│   ├── createScene.ts     # Scene, camera, renderer setup
│   ├── createGround.ts    # Ground plane creation
│   ├── createStops.ts     # Legacy mock stop markers
│   ├── introSequence.ts   # Opening cinematic
│   └── bounds.ts          # Hexagonal boundary checking
├── controls/
│   └── keyboardController.ts  # Input handling
├── collision/
│   ├── checkCollisions.ts     # Proximity detection
│   └── stopCollision.ts       # Stop collision (supports per-pillar)
├── ui/
│   ├── transition.ts      # Cinematic transitions (subtitle, bullets, links)
│   ├── proximityUI.ts     # Proximity indicators
│   └── loadingScreen.ts   # Loading management
├── App.ts                 # Main application logic
└── main.ts               # Entry point
```

## Development

For detailed development documentation, including how to add new portfolio stops, customize character behavior, and modify animations, see [CLAUDE.md](./CLAUDE.md).

## Models

All 3D assets are stored in `/public/models/` and loaded via GLTF:

- Player character animations (idle, walk, run, wave)
- Dog companion model + walk animation
- Portal gate model (`Meshy_AI_Neon_Quantum_Portal`) — loaded once, cloned per checkpoint

## Performance

- Shadow mapping with PCF soft shadows
- Optimized animation blending
- Efficient collision detection
- Smooth camera interpolation (lerp)
- Delta-time based animation updates
