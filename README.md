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
- **Mouse**: Look (pointer lock)
- **E**: Pickup targeted item (raycast from reticle)
- **F**: Toggle flashlight
- **R**: Restart game after win/lose

## Gameplay Loop

Collect all shopping list items while avoiding the roaming monster. Once all items are collected, the exit door opens. Reach the exit to win.

The game is tuned for a meaningful loop that can exceed 2 minutes depending on player pathing and monster evasion.

## Requirement Mapping

### 1) Engine/Core
- Canvas + WebGL context setup in `main.js`.
- `ShaderProgram` utility for shader compilation/linking.
- `Mat4` and `Vec3` helper modules for matrix/vector math.
- Render loop implemented with `requestAnimationFrame`.
- Reusable abstractions: `Mesh`, `Material`, `Texture`, `Entity`.

### 2) 3D Scene + Camera
- First-person camera with pointer lock mouse-look + WASD movement.
- Grocery layout includes aisles/shelves, checkout counter, enclosing walls, and an exit door.

### 3) Transforms + Collision
- Per-entity model transform stack (translate/rotate/scale).
- Player capsule-like collision approximation (XZ radius + Y check) against solid AABB bounds.
- Monster movement and collider bounds against scene props.

### 4) Lighting + Shading (Phong)
- GLSL Phong-style shading in fragment shader: ambient + diffuse + specular.
- One directional light for base scene illumination.
- Flashlight as toggleable dynamic point light centered at the player camera.

### 5) Texturing
Distinct textures are procedurally generated for:
- Floor tiles
- Shelves
- Wall grime
- Item labels
- Monster skin

(plus checkout and door textures).

### 6) Interactions (>=3)
- Raycast-based item pickup (`E`).
- Flashlight toggle (`F`).
- Proximity-triggered event: aisle-center flicker/scare cue.
- Door opening event when collection objective is complete.

### 7) Scene Complexity + Gameplay
- Unique object types include: floor, shelf, wall, checkout, door, item, monster.
- Core loop: collect, evade, then escape.

### 8) UI + Docs
- HUD shows objective status, shopping list checklist, and survival timer.
- In-game controls/instructions overlay and this requirement mapping are included.
