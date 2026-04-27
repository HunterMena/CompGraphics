# Haunted Grocery Run — Master Plan

**Class:** CS 4053 Computer Graphics · Dr. Doga Demirel  
**Team:** Hunter Mena & Parker Savage  
**Stack:** Raw WebGL (no Three.js; graded on graphics depth — hand-rolled pipeline is more impressive)  
**Asset Policy:** 100% procedural. All textures generated at runtime via Canvas 2D API. No external images or audio files.

---

## Current State Audit

### What is working
- First-person pointer-lock camera (WASD + mouse look + arrow-key turn)
- AABB collision detection for player and monster
- Phong shading with ambient + diffuse + specular, per-fragment
- Flashlight as a positional point light (F to toggle)
- Atmospheric fog in fragment shader
- Shopping list UI with per-item pickup via proximity ray cast (E)
- Monster AI: chases player, scales speed with distance, angle-deflects around obstacles
- One proximity flicker event at the aisle center
- Door that unlocks (teleports open) after all items collected
- Victory and game-over screens with restart (R)
- 8 procedural textures: floor, shelf, wall, item label, monster, checkout, door, ceiling

### Proposal promises not yet delivered (must fix before grading)
| Promised | Status |
|---|---|
| Storage area in the store | Not built |
| Door opening animation | Door teleports — no animation |
| "Lights flickering when player enters specific aisles" (plural) | Only one trigger |
| Monster that "strolls the aisles" naturally | Monster just beelines toward player |

### Dead code
`camera.js` and `controls.js` are not imported anywhere. A grader who opens the repo is confused. Delete in Sprint 1.

---

## DONE Definition

The project is complete when all of the following are true:

1. Every minimum technical requirement from the assignment sheet is clearly and visibly satisfied.
2. Every item promised in the proposal is implemented.
3. At least one advanced graphics feature beyond the baseline (chosen in Sprint 3) is working.
4. The game supports ≥ 2 minutes of meaningful interaction without bugs.
5. The store feels like a horror experience: dark, tense atmosphere, meaningful sound-alike feedback via visual cues.
6. Dead code is removed; source files are clean.

---

## Sprint 1 — Layout, Cleanup, and Item Variety

**Goal:** A richer, more believable store layout and a clean codebase. No new graphics tech — just geometry, scene architecture, and decoy items.

### Tasks

**Cleanup**
- Delete `camera.js` and `controls.js` (they are unused)

**Store Layout Expansion**
- Add a back-wall storage room: a separate rectangular region behind the north wall, accessible through a doorframe opening (no door). Different wall texture — raw concrete.
- Add cross-aisles (perpendicular corridors) connecting the left and right halves mid-store and near the back. This gives the monster and player room to maneuver and hides items around corners.
- Add three aisle end-caps: short shelf units capping the ends of the main aisles (scale 2.5 × 1.8 × 1), placed at z = ±12 on both sides.
- Add two chest freezer units along the east wall (long flat boxes, white-ish texture).
- Add two fallen shelf units on the floor in the storage room (rotated ~20° on Y, lying on their sides).
- Widen the play area from 44 × 44 to 52 × 52.

**Shopping List Overhaul**
- Expand from 8 items to 14 total items placed on shelves.
- Only 8 are on the required shopping list (win condition).
- The other 6 are "decoy" items — visible, pickable, on shelves, but not required. The HUD must make this clear.
- Update HUD: show required items as the current list. Show a separate small section "Extra (not needed)" if any decoys collected.
- Item positions should be spread across new aisles and the storage room (some items require exploring the whole store).

**New Item Textures**
- Give each of the 14 items a distinct procedural label texture (different label color band, different name text). Currently all items share the same generated label style — differentiate them.

**Flicker Triggers**
- Add two more proximity-flicker zones: one when the player enters the back storage room, one when the player walks into a cross-aisle. Each triggers a 3–5 second flicker at that location.

### Review Checklist (what to try after Sprint 1)
- Walk the full store — do you see cross-aisles, end-caps, and a back storage room?
- Can you find items in the storage room and along the east-wall freezers?
- Pick up a decoy item — does the HUD correctly show it as "not needed"?
- Walk into the storage room — does a separate flicker event fire (different from the center-aisle one)?
- Do all 14 items have visually distinct label textures?
- Are `camera.js` and `controls.js` gone?

---

## Sprint 2 — Lighting, Atmosphere, and Animation

**Goal:** The store feels genuinely creepy. Multiple dynamic lights, independent flickering, animated door, camera head-bob, and monster proximity cue.

### Tasks

**Multiple Ceiling Fixture Lights**
- Add 6 ceiling light fixtures as actual geometry: thin rectangular boxes hanging from the ceiling, with a bright white-ish/green tinted material (emissive-looking texture).
- Extend the fragment shader to support up to 4 point lights simultaneously (uniform arrays: `uPointLightPos[4]`, `uPointLightColor[4]`, `uPointLightOn[4]`).
- Three of the six fixtures are "active" overhead lights; three are dead (contribute nothing). Player's flashlight remains a 5th dynamic point light.
- Each active fixture flickers independently on its own sine-noise phase. Overhead lighting is dim green-white; flashlight is warm yellow-white. This uses color tinting per light source.

**Swinging Door Animation**
- The exit door no longer teleports. When `doorOpened` becomes true, animate the door rotating on a Y hinge over 1.2 seconds (rotateY from 0 → -π/2). Use a `doorAngle` state variable updated each frame.
- During the swing, the door's collision box is removed immediately so the player can walk through.

**Camera Head-Bob**
- When the player is moving on the ground (not jumping), apply a sinusoidal vertical offset to the camera eye position: `eye[1] += 0.055 * Math.sin(bobPhase)` where `bobPhase` increments by `12 * dt` while moving.
- This gives a walking feel and is a free "animation" requirement checkbox.

**Monster Proximity Visual Cue**
- When the monster is within 9 units of the player, apply a red vignette: a CSS `box-shadow: inset 0 0 80px rgba(180,0,0,X)` on the canvas element, where X scales from 0 at distance 9 to 0.55 at distance 1.5.
- Update this every frame via JS.

**Monster Patrol Behavior**
- When the monster is more than 16 units from the player, it no longer beelines. Instead it follows a simple waypoint patrol: a fixed list of 6 waypoints covering the aisle mid-points. It cycles through them until the player gets close, then switches to chase mode.
- This makes the monster feel like it "strolls the aisles" as the proposal described.

### Review Checklist (what to try after Sprint 2)
- Look at the ceiling — do you see fixture geometry?
- Do different ceiling areas have different lighting colors (green-tint overhead vs. warm flashlight)?
- Toggle the flashlight (F) — does the scene feel noticeably darker with only ambient + ceiling lights?
- Collect all items and watch the exit door — does it swing open vs. snap?
- Walk forward — do you see the camera gently bobbing?
- Let the monster get close — does a red vignette appear and intensify?
- Hang back far from the monster — does it wander between aisles rather than stand still?

---

## Sprint 3 — Advanced Graphics Feature

**Goal:** Implement at least one graphics technique beyond Phong shading that elevates the technical grade. Pick exactly one from the ranked list below. Do not attempt more than one — depth beats breadth here.

### Ranked Options (implement #1 unless there is a compelling reason not to)

**Option 1 (Recommended): Screen-Space Post-Processing — Film Grain + Vignette Pass**
- Add a second rendering pass: render the scene to a WebGL framebuffer (color texture + depth), then draw a full-screen quad with a post-process fragment shader.
- Post-process shader applies: (a) animated film grain (`fract(sin(dot(vUV, vec2(t*127.1, t*311.7))) * 43758.5)` style noise), (b) radial vignette darkening, (c) slight color desaturation/greenshift for the horror palette.
- This demonstrates framebuffer objects, fullscreen quads, and multi-pass rendering — three distinct WebGL concepts in one feature.

**Option 2: Normal Mapping**
- Add a `aNormalMap` sampler uniform. Procedurally generate normal maps for the wall and floor textures (bumpiness encoded in RGB). Perturb fragment normals using tangent-space normal map lookup before Phong calculation.
- Demonstrates understanding of the tangent-space transform and texture-based shading modification.

**Option 3: Particle System (Dust)**
- A GPU-side particle system: a Float32Array of N (e.g., 300) particles stored on the CPU, updated each frame, uploaded as a dynamic VBO. Each particle is a camera-facing billboard quad. Draws slowly drifting dust motes in the store.
- Demonstrates dynamic geometry, billboarding (multiply normal by inverse-view rotation), and alpha blending.

### Review Checklist (what to try after Sprint 3)
- For Option 1: Does the screen have visible film grain? Does the edge of the screen darken compared to center? Take a screenshot and compare.
- For Option 2: Look at the wall from an angle with the flashlight — do you see per-pixel bumpiness that shifts as you move?
- For Option 3: Stand still and look up — do you see slowly drifting mote particles? Do they face the camera as you turn?

---

## Sprint 4 — Game Feel, Polish, and Completeness

**Goal:** Ship-ready. Everything works, looks good, and a grader can navigate it without confusion.

### Tasks

**Start / Win / Lose Screens**
- Replace the plain text overlay card with a styled screen for each state.
- Start screen: title "Haunted Grocery Run" in a horror font style (CSS letter-spacing, red text-shadow), list of controls, Start button.
- Win screen: time survived, "YOU ESCAPED" in green, play again button.
- Lose screen: "CAUGHT." in red, your time, play again button.
- Each screen has a dark semi-transparent background over the 3D scene (which continues rendering behind it).

**Item Shape Variety**
- Add a second mesh type: a simple cylinder-approximation (N-sided prism, N=8 or 12). Use it for round items like "Soup Can" and "Milk" so not everything is a box.
- This satisfies "transformations" variety and adds visible scene complexity.

**HUD Improvements**
- Add a compass indicator: a small div in the top-right corner showing N/S/E/W based on `player.yaw`. Simple CSS text — no texture needed.
- Pulse the shopping list item name briefly when picked up (CSS animation).
- Timer counts up but displays as MM:SS.

**Store Signage**
- Add flat sign entities above each aisle (thin boxes with procedural text textures): "AISLE 1 — Dairy", "AISLE 2 — Dry Goods", "BACK — Storage". Makes the store feel real.

**Monster Visual Improvement**
- Give the monster a multi-cube body: a large torso box + two smaller arm boxes on each side (three separate entities grouped by position, all using the monster material). Arms translated relative to torso each frame. This is geometry transformation demonstration.

**Final Audio Cue (optional but impactful)**
- Add one Web Audio API sound: a looping low-frequency hum that increases in pitch/volume as the monster approaches. Purely programmatic (OscillatorNode + GainNode, no audio file). This is not a graphics requirement but adds a lot of perceived quality.

**Code cleanup**
- Consolidate any remaining duplication in shader uniform setup.
- Ensure `resetGame()` resets all new state added in sprints 1–3.

### Review Checklist (what to try after Sprint 4)
- Open the game cold — is the start screen polished and readable?
- Collect all items and reach the door — does the win screen look intentional?
- Let the monster catch you — does the lose screen feel distinct?
- Do you see the cylinder-shape items (Milk, Soup Can)?
- Is there a compass in the top right?
- Walk under an aisle sign — can you read the aisle name?
- Does the monster have arm geometry on its sides?
- Reset (R) after winning — does every system (door, items, monster, particles/grain) reset cleanly?

---

## Requirement Coverage Map

| Assignment Requirement | Where Satisfied |
|---|---|
| Navigable 3D environment | Main store + storage room, cross-aisles |
| User-controlled camera | First-person WASD + mouse, head-bob (Sprint 2) |
| Translation | Player/monster movement, door animation (Sprint 2), particle positions (Sprint 3) |
| Rotation | Monster Y-rotation toward player, door swing (Sprint 2), cylinder mesh normals |
| Scaling | All shelf/wall/item entities use non-uniform scale |
| Collision detection | AABB player↔walls/shelves, monster obstacles |
| Phong illumination | Fragment shader: ambient + diffuse + specular |
| Multiple light sources | Flashlight + 4 ceiling fixtures (Sprint 2) |
| At least 5 textures | 8 baseline + new textures in Sprint 1 |
| At least 3 interactive features | Pickup (E), flashlight (F), door opening, flicker events |
| At least 5 unique objects | Floor, shelves, end-caps, items, monster, freezers, checkout, door, ceiling fixtures |
| 2+ minutes of interaction | 14 items to collect + monster avoidance + multi-room exploration |
| Advanced feature | Post-processing OR normal mapping OR particles (Sprint 3) |

---

## Sprint Sequence Summary

| Sprint | Theme | Ends With |
|---|---|---|
| Sprint 1 | Layout, cleanup, decoy items | Bigger store, 14 items, dead code removed |
| Sprint 2 | Lighting, animation, atmosphere | Multi-light, door swing, head-bob, patrol AI |
| Sprint 3 | Advanced graphics feature | Post-process / normal maps / particles |
| Sprint 4 | Polish, shape variety, screens | Ship-ready build |

Each sprint is independently playable. Sprint N must not require Sprint N+1 to be functional.

---

*Last updated: 2026-04-24*
