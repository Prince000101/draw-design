# draw-design

An **MCP server** that lets coding agents (opencode, Claude Code, …) render diagrams and generate **animated** SVGs, GIFs and MP4s — right from the agent's toolset.

- `render_diagram` — Graphviz **DOT** or **D2** source → SVG / PNG file.
- `animate_dataflow` — build a self-playing **animated SVG** (packets travel between nodes) and optionally record it to **GIF/MP4**.
- `record_svg_animation` — sweep any animated SVG's timeline in headless Chromium and encode with ffmpeg.
- `build_gallery` — assemble an HTML gallery of everything generated.
- `list_engines` — report which backends are installed.

Everything is also available as a plain **CLI** (`npm run diagram -- …`), so you can use it without an MCP client.

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

`list_engines` prints exactly what is available on your machine.

---

## CLI quick start

```bash
# render a Graphviz DOT file to SVG and PNG
npm run diagram -- render graphviz examples/data-flow.dot --out examples/out --format all

# render a D2 file
npm run diagram -- render d2 examples/data-flow.d2 --out examples/out

# build the animated data-flow SVG (SMIL travelling packets)
npm run diagram -- animate examples/data-flow.json --out examples/out

# ...and record it to a GIF
npm run diagram -- animate examples/data-flow.json --gif --out examples/out

# record any animated SVG to GIF/MP4
npm run diagram -- record examples/out/data-flow-animated.svg examples/out/data-flow.mp4 --format mp4

# generate every example + a gallery.html
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

| Tool | Arguments | Output |
|------|-----------|--------|
| `list_engines` | — | which backends are installed + versions |
| `render_diagram` | `engine` (`graphviz`\|`d2`), `source` or `sourceFile`, `format` (`svg`\|`png`), `outDir`, `name` | absolute path to the rendered file |
| `animate_dataflow` | `nodes[]` (`id`,`label`,`sub?`,`color?`), `steps[]` (`from`,`to`,`label`,`color?`,`dur?`,`lane?`), `title?`, `width`, `outDir`, `name`, `record` (bool), `seconds`, `fps`, `format` (`gif`\|`mp4`) | animated SVG path (+ GIF/MP4 path) |
| `record_svg_animation` | `svgPath`, `outPath?`, `seconds`, `fps`, `format?` | recorded GIF/MP4 path |
| `build_gallery` | `outDir` | `gallery.html` path |

**Input format for `animate_dataflow`** (same as `examples/data-flow.json`):

```json
{
  "title": "My flow",
  "nodes": [
    { "id": "phone", "label": "Phone", "sub": "PWA", "color": "#2563eb" },
    { "id": "server", "label": "Server", "color": "#059669" }
  ],
  "steps": [
    { "from": "phone", "to": "server", "label": "1 · POST /api", "color": "#334155" },
    { "from": "server", "to": "phone", "label": "2 · SSE event", "color": "#2563eb", "lane": 3 }
  ]
}
```

---

## How the animations work — four techniques

1. **SMIL travelling packets** (`animate_dataflow`) — nodes on horizontal lifelines; a `<circle>` with `<animateMotion>` glides along each step's path. Runs on the SVG timeline, so it can be swept deterministically for recording.
2. **CSS pulse** — each node has a `@keyframes`-driven status dot.
3. **D2 step-reveal** — multi-board D2 sources rendered with `--animate-interval` transition between boards (see `examples/boards.d2`).
4. **GIF/MP4** — headless Chromium screenshots frames while advancing `setCurrentTime()`, ffmpeg encodes the palette GIF or H.264 MP4.

---

## Why the pieces

- **`dot`** → reliable, expressive graph layout for architecture-style diagrams.
- **D2** → modern, clean diagrams with themes; SVG export is pure Go (PNG goes through our Chromium converter because D2's own PNG export needs a Playwright driver download that often 404s).
- **SMIL + CSS** → self-contained animated SVGs that play anywhere, no JS runtime.
- **Playwright + ffmpeg** → universal GIF/MP4 output for READMEs, docs, and sharing.

---

## Roadmap

- Mermaid backend (GitHub-native diagrams), PlantUML for state/sequence
- Interactive HTML "living diagram" export with hover/click
- Voice/async orchestration: `build_diagram` from a free-text spec
- Cloud-hosted rendering fallback when binaries are missing

## License

MIT
