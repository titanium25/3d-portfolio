# 3D Portfolio

## Idea

An interactive 3D portfolio where visitors explore your work by navigating a character across a map. Instead of scrolling through a traditional site, users drive a vehicle through a stylized landscape, discovering projects at designated stops along the way.

The experience feels like a small open-world game: you land on a 3D polygon map viewed from above with a slight angle, move around with the keyboard, and trigger content when you reach each stop.

## Core Concept

- **Map**: A 3D polygon ground plane (e.g., hexagon or irregular shape) that acts as the playable area
- **Stops**: 3D markers placed on the map, each representing a project or section of your portfolio
- **Vehicle**: A player-controlled object (car, ball, or character) that moves across the map
- **Interaction**: When the vehicle touches a stop, a popup or overlay shows the related content (project details, links, images, etc.)

## POC Scope

The current proof of concept validates the core loop:

1. User lands on a page with a 3D scene (top-down angled view)
2. User moves a ball with keyboard (WASD or arrow keys)
3. The ball has realistic movement: acceleration and deceleration, so it speeds up when holding keys and slows down when releasing
4. The ball stays within map boundaries (hexagonal play area)
5. The ball collides with stop markers (basic 3D shapes)
6. Touching a stop opens a simple popup with portfolio data (title, description)

The POC intentionally uses basic shapes (ball, boxes, cylinders) instead of polished 3D models to keep the focus on mechanics and interaction flow.

## Future Direction

- Replace the ball with a car or character model
- Replace stop markers with more distinctive 3D assets
- Add richer UX: modals, animations, project links and media
- Improve the map (terrain, styling, multiple areas)
- Optional: mobile touch controls

## Tech Stack

- **Three.js** for 3D rendering
- **Vite** for build and dev
- **TypeScript**

## Running the Project

- `npm install` – install dependencies
- `npm run dev` – start dev server
- `npm run build` – production build
