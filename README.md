# BOUNCE

> A modern HTML5 tribute to the classic Nokia Bounce platformer.

A browser-based platformer inspired by the legendary Nokia Bounce series, rebuilt from the ground up using HTML5 Canvas, Vanilla JavaScript, and CSS3. Navigate challenging levels, avoid hazards, collect gems, pass through size-changing hoops, and reach the exit gate while mastering precise physics-based movement.

---

## Features

* Classic Nokia-inspired gameplay
* Physics-based movement and bouncing mechanics
* Dynamic camera system
* Multiple themed levels
* Collectibles, checkpoints, and exit gates
* Enemy AI and environmental hazards
* Mobile-friendly touch controls
* Responsive UI for desktop and mobile devices
* Modular architecture
* JSON-driven level system
* HTML5 Canvas rendering
* Smooth 60 FPS gameplay using `requestAnimationFrame`

---

## Screenshots

---

## Gameplay Preview

---

## Live Demo

Since levels are loaded dynamically using JSON files and browser `fetch()` requests, the game must be served through a local or remote web server.

---

## Technology Stack

* HTML5
* CSS3
* Vanilla JavaScript (ES6+)
* HTML5 Canvas
* JSON-based level configuration

No external frameworks or game engines are required.

---

## Project Structure

```text
BOUNCE/
├── index.html
├── favicon.ico
│
├── css/
│   └── style.css
│
├── js/
│   ├── main.js
│   ├── game.js
│   │
│   ├── engine/
│   │   ├── audio.js
│   │   ├── camera.js
│   │   ├── collision.js
│   │   ├── input.js
│   │   ├── particles.js
│   │   ├── physics.js
│   │   └── renderer.js
│   │
│   ├── entities/
│   │   ├── collectible.js
│   │   ├── enemy.js
│   │   ├── hazard.js
│   │   ├── platform.js
│   │   └── player.js
│   │
│   ├── ui/
│   │   ├── hud.js
│   │   └── menus.js
│   │
│   ├── levels/
│   │   └── levelLoader.js
│   │
│   └── utils/
│       ├── constants.js
│       ├── helpers.js
│       └── math.js
│
└── levels/
    ├── level1.json
    ├── level2.json
    ├── level3.json
    ├── level4.json
    └── level5.json
```

---

## Architecture

The game follows a modular architecture designed for maintainability and scalability.

### Engine Layer

Responsible for:

* Physics simulation
* Collision detection
* Audio management
* Camera movement
* Rendering
* Input handling

### Entity Layer

Contains all gameplay objects:

* Player
* Enemies
* Platforms
* Hazards
* Collectibles

### UI Layer

Handles:

* HUD
* Menus
* Level selection
* Mobile controls

### Data Layer

Levels are stored as standalone JSON files, allowing game content to be modified without changing engine code.

---

## Running Locally

### Option 1: VS Code Live Server

1. Install the **Live Server** extension.
2. Open the project folder.
3. Click **Go Live**.

---

### Option 2: Python HTTP Server

Navigate to the project directory and run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

### Option 3: GitHub Pages

1. Push the project to GitHub.
2. Open Repository Settings.
3. Enable GitHub Pages.
4. Select the desired branch.

The game will become publicly accessible through GitHub Pages.

---

## Controls

### Desktop

| Action        | Keys                 |
| ------------- | -------------------- |
| Move Left     | A / Left Arrow       |
| Move Right    | D / Right Arrow      |
| Jump / Bounce | W / Up Arrow / Space |

---

### Mobile

Use the built-in virtual controls:

* ◀ Move Left
* ▶ Move Right
* ▲ Jump / Bounce

---

## Level System

Each level is defined using JSON data.

Example:

```json
{
  "id": 1,
  "name": "GREEN HILLS",
  "spawn": {
    "x": 32,
    "y": 200
  },
  "platforms": [],
  "hazards": [],
  "collectibles": [],
  "enemies": []
}
```

This allows level designers to create new content without modifying gameplay code.

---

## Creating New Levels

1. Duplicate an existing JSON level file.

```text
levels/level5.json
→
levels/level6.json
```

2. Modify:

* Spawn position
* Platforms
* Hazards
* Gems
* Exit gates
* Enemies

3. Update level selection limits if necessary.

No engine modifications are required.

---

## Roadmap

### Completed

* [x] Physics system
* [x] Dynamic camera
* [x] Mobile controls
* [x] JSON level loading
* [x] Multi-level support
* [x] Responsive UI

### Planned

* [ ] Save system
* [ ] Additional enemy types
* [ ] Expanded audio system
* [ ] Achievement system
* [ ] Level editor
* [ ] Community-created levels

---

## Performance

The game is optimized for modern browsers and aims to maintain smooth gameplay at 60 FPS using:

* Canvas rendering
* RequestAnimationFrame
* Efficient collision checks
* Lightweight asset management

---

## Contributing

Contributions, bug reports, and gameplay suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit changes.
4. Submit a Pull Request.

---

## Disclaimer

BOUNCE is a fan-made tribute inspired by the classic Nokia Bounce series.

This project is not affiliated with, endorsed by, or associated with Nokia Corporation.

---

## Author

**Aritra Bakshi**

---

## License

[Click Here](https://github.com/AritraBakshi/Bounce/blob/264d32c4463a587364a9ca5a0aebb535e1b9799c/LICENSE)
