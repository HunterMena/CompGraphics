# Haunted Grocery Run (Vanilla WebGL + JavaScript)

A browser horror-survival mini game implemented with **plain WebGL + JavaScript**.

## Run

Because pointer lock and ES modules are used, run with a static server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls

- **WASD**: Move
- **Space**: Jump
- **Mouse**: Look (pointer lock)
- **← →**: Turn (keyboard alternative to mouse)
- **E**: Pick up targeted item
- **F**: Toggle flashlight
- **R**: Restart game after win/lose

## Gameplay Loop

Collect all 10 shopping list items while avoiding the roaming monster. Decoy items on shelves can be picked up but are not required. Once all required items are collected, the exit door opens. Reach the south exit to win.

## Requirement Mapping

### 1) Engine/Core
- Canvas + WebGL context setup in `main.js`.
- `ShaderProgram` utility for shader compilation/linking.
- `Mat4` and `Vec3` helper modules for matrix/vector math.
- Render loop implemented with `requestAnimationFrame`.
- Reusable abstractions: `Mesh`, `Material`, `Texture`, `Entity`.
- Image preloader ensures all PNG assets are ready before the scene builds.

### 2) 3D Scene + Camera
- First-person camera with pointer lock mouse-look, WASD movement, and arrow-key turning.
- Camera head-bob while walking; jump mechanic with gravity.
- Grocery store layout: 6 labeled aisles, dairy/meat freezers (east wall), frozen food freezers (west wall), checkout counter, cash registers, storage backroom, and an exit tunnel.

### 3) Transforms + Collision
- Per-entity model transform stack (translate/rotateY/rotateZ/scale).
- Player capsule collision (XZ radius + vertical range) against solid AABB bounds.
- Monster movement and AABB-based obstacle avoidance.
- Collectible items rotate in place each frame via `rotationY`.

### 4) Lighting + Shading (Phong)
- GLSL Phong-style shading in the fragment shader: ambient + diffuse + specular.
- One directional light for base scene illumination.
- Up to 4 point lights via uniform arrays: 3 ceiling fixtures (flickering, green-tinted) + 1 flashlight (warm, toggleable).
- Distance-based exponential fog blended in the fragment shader.
- Global flicker uniform drives scare-event ambient drops.

### 5) Texturing
Procedurally generated canvas textures:
- Floor tiles, shelf wood grain, grime walls, concrete storage, ceiling panels, working/dead light fixtures, freezer glass, checkout belt, exit door, aisle signs (Pharmacy, Baking, Cleaning, Breakfast, Condiments, Beverages), monster skin, cash registers, dust particles.

PNG image textures loaded from `assets/`:
- Item faces: milk, cereal, bread, meat, soap, coffee, canofsoup, bandages, icecream, peas, flour, pasta, ketchup, mustard, butter, cheese, cream, sausage, chicken, candy.
- Section signs and entrance banner: milk, meat, icecream, venue.

### 6) Interactions (>=3)
- Raycast-based item pickup (`E`) with on-screen prompt and pickup notification.
- Flashlight toggle (`F`).
- Proximity-triggered flicker/scare events (store center, cross-aisle, storage room).
- Door opening animation when all required items are collected.
- Red vignette that intensifies as the monster closes in.

### 7) Scene Complexity + Gameplay
- Object types: floor, ceiling, walls, shelves, endcaps, freezers, registers, checkout, storage, door, exit tunnel, ceiling fixtures (working + dead), 10 required items, 5 decoy items, 20+ filler decorative items, 6 aisle signs, 4 section signs, 200 dust billboard particles, and an articulated 3-part monster.
- Monster alternates between waypoint patrol (6 points) and player-chasing based on distance; stuck-detection with side-bias steering.
- Core loop: collect, evade, then escape.

### 8) UI + Docs
- HUD shows objective, shopping list checklist (required + any collected decoys), status messages, and survival timer.
- In-game controls/instructions overlay, victory screen with time, and game-over screen with time.
- `R` restarts without page reload.
