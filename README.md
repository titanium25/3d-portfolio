# 3D Portfolio

## Overview

An interactive 3D portfolio where visitors explore your work by navigating a character across a map. Instead of scrolling through a traditional site, users control a character through a stylized landscape, discovering projects at designated stops along the way.

The experience feels like a small open-world game: you land on a 3D hexagonal map viewed from above with a slight angle, move around with the keyboard, and trigger content when you reach each stop. A loyal dog companion follows alongside you on your journey.

## Core Features

- **Map**: A hexagonal 3D floating megastructure with layered surfaces and boundary collision
  - Edge pylons near the rim for scale and composition
  - Procedural roughness maps for realistic material feel
  - Contrast hierarchy: inner plate → rim/body (lightest) → cyan accents
  - Cyan accent underglow on the underside
- **Spawn Pad + Timeline Bridge**: A distinct entry zone south of the arena
  - Spawn pad matches arena effects: underglow, energy barrier, void cascade, rising particles
  - Thin glass-like bridge leads from spawn to arena — translucent slab with glowing runway strip
  - Stream particles flow toward the arena; destination glow marks the entrance
  - Four timeline portal gates line the bridge — walk through each arch to progress
- **Timeline Road**: 4 interactive portal gates along the Timeline Bridge, each representing a career milestone (2018–2024)
  - GLB portal models with floor pads, activation rings, and year labels
  - Proximity glow: model emissive, point lights, ground glow disc all react to player distance
  - Completion tracking: visited checkpoints glow brighter persistently
  - Pillar collision: walk through the gate opening, blocked by the frame
  - Walk near a gate to reveal a floating info panel — company context, bullets, skill chips, and a "Open full story" CTA
  - Panel crossfades between gates so switching never pops or flashes
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
- **Interaction System**: Two-tier proximity-based interactions
  - **Timeline gates**: Walk near a gate — a floating info panel fades in at center-right, driven by distance; fades out as you walk away
  - **Timeline gates**: Press **E** or click the panel CTA for a full cinematic overlay — company logo, cover image, bullets, tech stack chips — with camera zoom and backdrop blur
  - **Buildings/stops**: Press **E** when near a stop for a cinematic overlay
  - Press **ESC**, click the close button, or click the backdrop to close

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
✅ Hexagonal map with multi-zone boundary checking (arena + bridge + spawn pad)  
✅ Layered ground platform with contrast hierarchy  
✅ Edge pylons for composition and scale reference  
✅ Procedural roughness maps and tuned PBR materials  
✅ ACES Filmic tonemapping with atmospheric fog  
✅ Spawn pad + Timeline Bridge with arena effects (underglow, barrier, cascade, particles) and glass bridge with runway strip  
✅ Timeline Road with 4 interactive portal gates (2018–2024) along glass bridge with runway strip and stream particles  
✅ GLB portal models with proximity glow and completion tracking  
✅ Per-pillar collision (walk through gate openings)  
✅ Rich cinematic overlay — cover image, company logo, bullet points, per-role tech stack chips  
✅ Scrollable overlay card with height cap (content-heavy entries don't overflow the viewport)  
✅ Résumé modal (CV panel) — headshot avatar, cover photo, Inter font, logo pills, skills, animated download CTA  
✅ Gate panel crossfade — smooth content transition when walking between adjacent gates  
✅ Click-to-discover system — click BMW, MTB, Meny, or the monogram in 3D to trigger discovery rewards (toast, motes, badge bump)  
✅ Discovery photo albums — discovered objects unlock photo galleries in the About tab; undiscovered show a teaser  
✅ Photo lightbox — FLIP-animated zoom for headshot, journey photos, and About tab gallery images  
✅ Journey photo teasers — experience photos start blurred/locked, revealed when walking through the gate  
✅ Film strip indicators — interest cards with photos show a visual strip (locked vs. unlocked state)  
✅ Tab "New" indicators — pulsing amber dot on Journey/About tabs when new content is available  
✅ Resume badge — counts gates explored + discoveries; gold accent on full completion  
✅ Animated download CTA — breathing glow, shimmer sweep, bouncing icon; impossible to miss

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
- **Spawn Pad + Timeline Bridge**: Entry zone with spawn hex (arena effects) and thin glass bridge; runway strip, stream particles, destination glow; hosts 4 timeline portal gates
- **Timeline Road**: 4 portal checkpoints along the bridge with GLB models, proximity glow, completion tracking, and per-pillar collision
- **Scene Management**: Modular scene setup with lighting, shadows, fog, tonemapping, and post-processing
- **Ground Platform**: Layered megastructure with edge pylons, procedural roughness maps, and contrast hierarchy
- **Collision System**: Efficient proximity and collision detection with support for multi-point collision shapes (gate pillars)
- **UI System**: Three-layer overlay stack — gate panel (proximity), cinematic overlay (full story with image + skills), CV modal (résumé with headshot, logos, download)
- **World Tooltip System**: Raycasting-based hover Easter eggs on spawn pad objects — styled tooltip card + per-object reactive 3D animation (emissive boost, dog tail excitement)
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
│   ├── createGround.ts    # Main arena hex platform
│   ├── createSpawnPad.ts  # Spawn pad + Timeline Bridge (glass, effects)
│   ├── layoutConstants.ts # Bridge width and gate dimensions
│   ├── createStops.ts     # Legacy mock stop markers
│   ├── introSequence.ts   # Opening cinematic
│   └── bounds.ts          # Hexagonal boundary checking
├── controls/
│   └── keyboardController.ts  # Input handling
├── collision/
│   ├── checkCollisions.ts     # Proximity detection
│   └── stopCollision.ts       # Stop collision (supports per-pillar)
├── ui/
│   ├── transition.ts      # Cinematic overlay (image, bullets, skill chips)
│   ├── gatePanel.ts       # Proximity panel for timeline gates
│   ├── cvPanel.ts         # Résumé modal (headshot, logos, skills, download)
│   ├── tiltEffect.ts      # Reusable 3D tilt + shine + border light effect
│   ├── proximityUI.ts     # Proximity indicators (building stops)
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
- Bridge uses transparent material (no refraction) to maintain 60 FPS
- Optimized animation blending
- Efficient collision detection
- Smooth camera interpolation (lerp)
- Delta-time based animation updates
