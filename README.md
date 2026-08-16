# draw-design

An **MCP server** that lets coding agents (opencode, Claude Code, …) generate **design-quality diagrams and animations** — C4 architecture diagrams, mind maps and step-animated algorithm visualizations (plus Graphviz/D2 rendering) — as self-contained SVGs, GIFs and MP4s. Every generator outputs a consistent **16:9 (1280×720)** canvas by default, so images and videos look uniform in READMEs, docs and slides. Algorithm animations come in two flavors: smooth **SMIL** in-browser animation, or high-fidelity **MP4** rendered with [manim](https://github.com/3b1b/manim).

## Generators

| Tool | What it produces |
|------|------------------|
| `generate_architecture` | **C4-style architecture diagrams** (context / container levels) with person, system, database, queue and external-system shapes, color-coded per C4 conventions |
| `generate_mindmap` | **Radial** (root-centered, color-coded rings) or **left-right tree** mind maps from a nested model |
| `animate_algorithm` | **Step-animated algorithm visualizations** — bubble sort as sliding bars, binary search with `lo`/`mid`/`hi` pointers, or your own step script. `engine: "manim"` renders a buttery-smooth **MP4** via the [3b1b manim](https://github.com/3b1b/manim) Python library |
| `animate_dataflow` | Self-playing **animated SVG** with travelling packets between nodes |
| `render_diagram` | Graphviz **DOT** or **D2** source → SVG / PNG |
| `record_svg_animation` | Sweep any animated SVG's timeline in headless Chromium and encode with ffmpeg |
| `build_gallery` | An HTML gallery of everything generated (filters + dark mode) |
| `list_engines` / `list_templates` | Report installed backends and available themes / presets / aspects |

Everything is also available as a plain **CLI** (`npm run diagram -- …`).

---

## Screenshots & demos

All images below are 1280×720 (16:9). GIFs autoplay on GitHub.

### Architecture

<img src="docs/screenshots/architecture-context.png" width="900" alt="C4 context diagram" style="border-radius:10px;border:1px solid #e2e8f0"/>

C4 **context** level (top) and **container** level with a dashed system boundary:

<img src="docs/screenshots/architecture-container.png" width="900" alt="C4 container diagram" style="border-radius:10px;border:1px solid #e2e8f0"/>

Dark theme, same model:

<img src="docs/screenshots/architecture-dark.png" width="900" alt="C4 context diagram, dark theme" style="border-radius:10px;border:1px solid #1e293b"/>

Animated reveal (recorded to GIF):

<img src="docs/screenshots/architecture-context.gif" width="900" alt="architecture reveal animation" style="border-radius:10px;border:1px solid #e2e8f0"/>

### Mind maps

Radial (root centered, rings by depth, color-coded branches):

<img src="docs/screenshots/mindmap-radial.png" width="900" alt="radial mind map" style="border-radius:10px;border:1px solid #e2e8f0"/>

<img src="docs/screenshots/mindmap-radial.gif" width="900" alt="radial mind map animation" style="border-radius:10px;border:1px solid #e2e8f0"/>

Left-right tree layout:

<img src="docs/screenshots/mindmap-tree.png" width="900" alt="tree mind map" style="border-radius:10px;border:1px solid #e2e8f0"/>

### Algorithm animations

Bubble sort — bars slide into place with eased motion, colors blend smoothly to mark compare / swap / sorted:

<img src="docs/screenshots/algorithm-sort.png" width="900" alt="bubble sort bars" style="border-radius:10px;border:1px solid #e2e8f0"/>

<img src="docs/screenshots/algorithm-sort.gif" width="900" alt="bubble sort animation" style="border-radius:10px;border:1px solid #e2e8f0"/>

Same model rendered to **MP4 with manim** (`--engine manim`):

<video src="docs/screenshots/algorithm-sort.mp4" width="900" controls playsinline muted style="border-radius:10px;border:1px solid #e2e8f0"></video>

Binary search — `lo` / `mid` / `hi` pointers sweep the array:

<img src="docs/screenshots/algorithm-search.png" width="900" alt="binary search cells" style="border-radius:10px;border:1px solid #e2e8f0"/>

<img src="docs/screenshots/algorithm-search.gif" width="900" alt="binary search animation" style="border-radius:10px;border:1px solid #e2e8f0"/>

<video src="docs/screenshots/algorithm-search.mp4" width="900" controls playsinline muted style="border-radius:10px;border:1px solid #e2e8f0"></video>

---

## Install

```bash
git clone https://github.com/Prince000101/draw-design && cd draw-design
npm install
npm run diagram -- list-engines
```

### Backends

| Engine | Needed for | Install |
|--------|-----------|---------|
| **Graphviz** `dot` | `.dot`/`.gv` → SVG/PNG | `apt install graphviz` (or brew/dnf) |
| **D2** | `.d2` → SVG/PNG + step-reveal animation | `curl -fsSL https://d2lang.com/install.sh \| sh -s --` |
| **Chromium + ffmpeg** | PNG rasterization, GIF/MP4 recording | reuse cached Playwright Chromium or `npx playwright install chromium`; `apt install ffmpeg` |
| **manim** (3b1b) | `--engine manim` algorithm MP4s (720p+) | `python3 -m venv ~/.venvs/manim && ~/.venvs/manim/bin/pip install manim` (requires `libcairo2-dev libpango1.0-dev` on Debian/Ubuntu). Set `MANIM_BIN` to point at a custom venv |

The architecture / mind map / algorithm generators are **built-in** — the SMIL engine needs no binaries at all.

---

## CLI quick start

```bash
# C4 architecture diagram (16:9, light theme)
npm run diagram -- arch --out examples/out --format png

# Container level, dark theme, recorded to GIF
npm run diagram -- arch --level container --theme dark --format png --record gif --out examples/out

# Mind map — radial or tree
npm run diagram -- mindmap --out examples/out --format png
npm run diagram -- mindmap --layout tree --format png --out examples/out

# Algorithm animations (SMIL SVG → PNG/GIF, or manim MP4)
npm run diagram -- algorithm sort   --values "7,2,9,1,5,3,8,4,6" --format png --out examples/out
npm run diagram -- algorithm search --values "1,3,5,7,9,11,13,15" --target 9 --record gif --out examples/out
npm run diagram -- algorithm sort   --engine manim --quality qm --out examples/out

# render DOT / D2 sources
npm run diagram -- render graphviz my-flow.dot --out examples/out --format all
npm run diagram -- render d2 my-flow.d2 --out examples/out

# everything + gallery.html
npm run diagram -- demo
```

Open `examples/out/gallery.html` in a browser to view all outputs at once.

---

## MCP usage

Register the server in your agent config, e.g. for opencode (`~/.config/opencode/opencode.jsonc`):

```jsonc
{
  "mcp": {
    "draw-design": {
      "type": "local",
      "command": ["node", "/abs/path/draw-design/node_modules/tsx/dist/cli.mjs", "/abs/path/draw-design/src/index.ts"]
    }
  }
}
```

### Tools

| Tool | Key arguments | Output |
|------|---------------|--------|
| `generate_architecture` | `model` (JSON: `systems[]`, `edges[]`), `level` (`context`\|`container`), `theme`, `aspect`, `format`, `outDir`, `name`, `record` | SVG / PNG path (+ GIF/MP4) |
| `generate_mindmap` | `root` (nested `{label, note?, color?, children?}`), `layout` (`radial`\|`tree`), `title`, `theme`, `aspect`, `format`, `outDir`, `record` | SVG / PNG path (+ GIF/MP4) |
| `animate_algorithm` | `kind` (`bars`\|`cells`), `values[]`, `steps?`, `target?`, `engine` (`smil`\|`manim`), `quality` (`ql`\|`qm`\|`qh`\|`qp`), `title`, `theme`, `aspect`, `format`, `outDir`, `record` | SVG / PNG path, or MP4 for manim (+ GIF/MP4 via `record`) |
| `animate_dataflow` | `nodes[]`, `steps[]`, `title?`, `width`, `outDir`, `name`, `record` | animated SVG path (+ GIF/MP4) |
| `render_diagram` | `engine` (`graphviz`\|`d2`), `source` or `sourceFile`, `format`, `outDir`, `name` | rendered file path |
| `record_svg_animation` | `svgPath`, `outPath?`, `seconds`, `fps`, `format?` | recorded GIF/MP4 path |
| `build_gallery` | `outDir` | `gallery.html` path |
| `list_engines` / `list_templates` | — | backend status / template catalog |

Common options on all generators: `aspect` (`16:9` default · `4:3` · `3:2` · `16:10` · `square`), `theme` (`light`\|`dark`), `format` (`svg`\|`png`), `record` (bool, default `false`), `seconds`, `fps`, `videoFormat` (`gif`\|`mp4`).

### Input format for `generate_architecture`

```json
{
  "title": "pocketwire — system context",
  "level": "context",
  "systems": [
    { "id": "user", "name": "Mobile user", "kind": "person", "desc": "sends prompts from the app" },
    { "id": "pocketwire", "name": "pocketwire", "kind": "system", "desc": "relay server + device app", "tech": "PWA" },
    { "id": "db", "name": "Queue", "kind": "queue", "desc": "instruction backlog", "tech": "Redis" },
    { "id": "agent", "name": "opencode", "kind": "external", "desc": "coding agent runtime", "tech": "SSE" }
  ],
  "edges": [
    { "from": "user", "to": "pocketwire", "label": "prompts", "tech": "HTTPS" },
    { "from": "pocketwire", "to": "db", "label": "enqueue", "tech": "Redis" },
    { "from": "pocketwire", "to": "agent", "label": "instructions", "tech": "MCP" }
  ]
}
```

Kinds: `person` · `system` · `container` · `database` · `queue` · `external`. Set `level: "container"` and add a `containers[]` array to a system to draw it as a dashed boundary with nested containers.

### Input format for `generate_mindmap`

```json
{
  "label": "pocketwire",
  "children": [
    { "label": "Mobile app", "note": "PWA", "children": [ { "label": "Chat UI" }, { "label": "Approvals" } ] },
    { "label": "Relay server", "children": [ { "label": "Queue" }, { "label": "SSE fan-out" } ] }
  ]
}
```

### Input format for `animate_algorithm`

Presets: omit `steps` — `bars` runs a bubble sort, `cells` a binary search (`target` required). Or pass explicit steps for full control. Set `engine: "manim"` to render with manim instead of SMIL — the manim backend uses the same model but expresses it as smooth Python animations (a `swap` step becomes a real 3B1B-style `Swap()` tween); `quality` maps to manim's `ql`/`qm`/`qh`/`qp` presets (`qm` = 720p).

```json
{
  "kind": "bars",
  "values": [7, 2, 9, 1, 5],
  "title": "Bubble sort",
  "steps": [
    { "state": [7, 2, 9, 1, 5], "compare": [0, 1], "label": "Compare 7 and 2" },
    { "state": [2, 7, 9, 1, 5], "compare": [0, 1], "swap": true, "label": "Swap" },
    { "state": [2, 7, 9, 1, 5], "compare": [1, 2], "label": "Compare 7 and 9" }
  ]
}
```

Step fields: `state` (full array), `compare` `[i,j]`, `swap` (bool), `done` / `focus` (index arrays), `pointers` (`[{index, color, label}]`), `order` (permutation for bar sliding), `label` (caption). This generic script covers any step-based visualization — pointer scans, graph traversals, state machines.

---

## How the animations work

1. **SMIL, not JavaScript** — everything runs on the SVG timeline (`setCurrentTime()`), so frames are deterministic and recordable frame-by-frame to GIF/MP4.
2. **Staged reveals** — architecture and mind map elements fade in on a staggered timeline.
3. **Tweened fills + spline-eased transforms** — algorithm bars slide between positions with a cubic-bezier easing (`keySplines`), and highlight colors interpolate smoothly each step (`<animate attributeName="fill" calcMode="linear">`). Bars and cells show their current value with a white-on-rim label so state stays legible during motion.
4. **Manim MP4 (optional)** — the same bubble sort / binary search model is regenerated as a 3B1B-style scene (compare/swap/lock with `Swap()` tweens and `lo`/`mid`/`hi` pointer triangles) and rendered to H.264 MP4 by manim.
5. **Recording** — headless Chromium screenshots frames while advancing the timeline; ffmpeg encodes the palette GIF or H.264 MP4.

## Design system

- **Consistent canvas** — every generator defaults to **1280×720 (16:9)** so READMEs and videos look uniform; `aspect` and `width`/`height` let you override.
- **Two themes** — `light` and `dark` share one token set (palette, fonts, spacing, arrowheads, shadows).
- **C4 colors** — person (indigo), system (blue), container (cyan), database (violet), queue (pink), external (slate).
- **Deterministic output** — the same model always yields the same pixels, so generated assets are safe to commit and diff.

## Roadmap

- PlantUML backend for state/sequence diagrams
- Interactive HTML "living diagram" export with hover/click
- `build_diagram` from a free-text spec (voice/async orchestration)
- Cloud-hosted rendering fallback when binaries are missing

## License

MIT
