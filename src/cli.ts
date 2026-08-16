import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { engineStatuses } from "./engines.js";
import { renderD2Animated, renderFile } from "./render.js";
import { animateDataflow, defaultFlow, writeAnimatedSvg } from "./animate.js";
import { recordSvgAnimation } from "./record.js";
import { buildGallery } from "./gallery.js";
import { emitSvg } from "./emit.js";
import { archSvg, normalizeArchModel } from "./architecture.js";
import { mindmapSvg } from "./mindmap.js";
import { algoSvg, bubbleSortSteps, binarySearchSteps } from "./algorithm.js";
import {
  sampleArchitecture,
  sampleContainerArchitecture,
  sampleMindmap,
  sampleSortSpec,
  sampleSearchSpec,
} from "./presets.js";
import type { FlowNode, FlowStep } from "./types.js";
import type { ArchModel } from "./architecture.js";
import type { MindMapNode } from "./mindmap.js";
import type { AlgSpec } from "./algorithm.js";

const HELP = `draw-design — diagram + animation generator

USAGE
  npm run diagram -- <command> [options]

COMMANDS
  list-engines                     show installed render backends
  list-templates                   show themes / aspects / presets
  render <dot|d2> <file>           render source file to SVG + PNG
    --format svg|png               (default: svg; pass 'all' for both)
    --out <dir> --name <base>
  arch [file.json]                 generate a C4 architecture diagram
    --level context|container --theme light|dark
    --aspect 16:9|4:3|3:2|16:10|square   (default: 16:9)
    --format svg|png --out <dir> --name <base>
    --record [gif|mp4] --seconds <n> --fps <n>
  mindmap [file.json]              generate a mind map
    --layout radial|tree --title <text>  (default: radial)
    --aspect/--theme/--format/--out/--name/--record ...  (same as arch)
  algorithm [preset]               generate an algorithm animation
    preset: sort | search          (default: sort)
    --values "7,2,9,1" --target <n> --kind bars|cells
    --title <text> --aspect/--theme/--format/--out/--name/--record ...
  animate [file.json]              generate animated data-flow SVG
    --title <text> --width <px> (default: 1280) --out <dir>
    --gif [gif|mp4] --seconds <n> --fps <n>
  record <file.svg> <out>          record animated SVG to GIF/MP4
  demo                             generate all examples + gallery
  gallery [dir]                    build gallery.html for a directory
  help                             this help

EXAMPLES
  npm run diagram -- arch --level container --out examples/out
  npm run diagram -- mindmap --layout tree --format png --out examples/out
  npm run diagram -- algorithm sort --values "7,2,9,1,5" --record gif --out examples/out
  npm run diagram -- animate examples/data-flow.json --gif --out examples/out
`;

function argsOf(argv: string[]) {
  const opts: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = "true";
      }
    } else {
      rest.push(a);
    }
  }
  return { opts, rest };
}

function num(opts: Record<string, string>, key: string, dflt: number): number {
  const v = Number(opts[key]);
  return Number.isFinite(v) ? v : dflt;
}

function readJson(path?: string): unknown {
  if (!path) return undefined;
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

async function maybeRecord(
  svgPath: string,
  outDir: string,
  name: string,
  fmt: string,
  seconds: string | undefined,
  fps: string | undefined,
): Promise<void> {
  const f = fmt === "mp4" ? "mp4" : "gif";
  const rec = await recordSvgAnimation(svgPath, join(outDir, `${name}.${f}`), {
    seconds: num({ s: seconds ?? "6" }, "s", 6),
    fps: num({ s: fps ?? "15" }, "s", 15),
    format: f as "gif" | "mp4",
  });
  console.log(`  ${f}:`, rec.out);
}

async function cmdArch(opts: Record<string, string>, rest: string[]) {
  const model = (readJson(rest[0]) ?? sampleArchitecture()) as ArchModel;
  const svg = archSvg(model, {
    level: opts.level === "container" ? "container" : "context",
    theme: opts.theme === "dark" ? "dark" : "light",
    aspect: opts.aspect,
    width: opts.width ? Number(opts.width) : undefined,
    height: opts.height ? Number(opts.height) : undefined,
  });
  const outDir = opts.out ?? ".";
  const name = opts.name ?? "architecture";
  const fmt = opts.format ?? "svg";
  if (fmt === "all") {
    const e1 = await emitSvg(svg, outDir, name, "svg");
    console.log("  svg:", e1.svgPath);
    const e2 = await emitSvg(svg, outDir, name, "png", 2);
    console.log("  png:", e2.pngPath);
  } else {
    const f = fmt === "png" ? "png" : "svg";
    const emit = await emitSvg(svg, outDir, name, f, f === "png" ? 2 : undefined);
    console.log(`  ${f}:`, f === "png" ? emit.pngPath : emit.svgPath);
  }
  if (opts.record && opts.record !== "false") await maybeRecord(join(outDir, `${name}.svg`), outDir, name, opts.record, opts.seconds, opts.fps);
}

async function cmdMindmap(opts: Record<string, string>, rest: string[]) {
  const root = (readJson(rest[0]) ?? sampleMindmap()) as MindMapNode;
  const svg = mindmapSvg(root, {
    title: opts.title,
    layout: opts.layout === "tree" ? "tree" : "radial",
    theme: opts.theme === "dark" ? "dark" : "light",
    aspect: opts.aspect,
    width: opts.width ? Number(opts.width) : undefined,
    height: opts.height ? Number(opts.height) : undefined,
  });
  const outDir = opts.out ?? ".";
  const name = opts.name ?? "mindmap";
  const fmt = opts.format ?? "svg";
  if (fmt === "all") {
    const e1 = await emitSvg(svg, outDir, name, "svg");
    console.log("  svg:", e1.svgPath);
    const e2 = await emitSvg(svg, outDir, name, "png", 2);
    console.log("  png:", e2.pngPath);
  } else {
    const f = fmt === "png" ? "png" : "svg";
    const emit = await emitSvg(svg, outDir, name, f, f === "png" ? 2 : undefined);
    console.log(`  ${f}:`, f === "png" ? emit.pngPath : emit.svgPath);
  }
  if (opts.record && opts.record !== "false") await maybeRecord(join(outDir, `${name}.svg`), outDir, name, opts.record, opts.seconds, opts.fps);
}

async function cmdAlgorithm(opts: Record<string, string>, rest: string[]) {
  const preset = rest[0] ?? "sort";
  let spec: AlgSpec;
  if (rest[0]?.endsWith(".json")) {
    spec = readJson(rest[0]) as AlgSpec;
  } else if (preset === "search") {
    const target = opts.target !== undefined ? Number(opts.target) : 9;
    spec = { ...sampleSearchSpec(), target, values: parseValues(opts.values, sampleSearchSpec().values) };
  } else {
    spec = { ...sampleSortSpec(), values: parseValues(opts.values, sampleSortSpec().values) };
  }
  if (opts.kind) spec.kind = opts.kind as "bars" | "cells";
  if (opts.title) spec.title = opts.title;

  const effective =
    spec.steps ?? (spec.kind === "cells" ? binarySearchSteps(spec.values, spec.target ?? 0) : bubbleSortSteps(spec.values));
  const svg = algoSvg({
    ...spec,
    theme: opts.theme === "dark" ? "dark" : "light",
    aspect: opts.aspect,
    width: opts.width ? Number(opts.width) : undefined,
    height: opts.height ? Number(opts.height) : undefined,
  });
  const outDir = opts.out ?? ".";
  const name = opts.name ?? `algorithm-${spec.kind ?? "bars"}`;
  const fmt = opts.format ?? "svg";
  const midTime = (effective.length / 2) * 1.0;
  if (fmt === "all") {
    const e1 = await emitSvg(svg, outDir, name, "svg");
    console.log("  svg:", e1.svgPath);
    const e2 = await emitSvg(svg, outDir, name, "png", midTime);
    console.log("  png:", e2.pngPath);
  } else {
    const f = fmt === "png" ? "png" : "svg";
    const emit = await emitSvg(svg, outDir, name, f, f === "png" ? midTime : undefined);
    console.log(`  ${f}:`, f === "png" ? emit.pngPath : emit.svgPath);
  }
  if (opts.record && opts.record !== "false") await maybeRecord(join(outDir, `${name}.svg`), outDir, name, opts.record, opts.seconds, opts.fps);
}

function parseValues(raw: string | undefined, dflt: number[]): number[] {
  if (!raw) return dflt;
  const vs = raw.split(",").map((s) => Number(s.trim()));
  return vs.every((v) => Number.isFinite(v)) ? vs : dflt;
}

async function cmdDemo(outDir: string) {
  const out = resolve(outDir);
  console.log("== architecture (context) ==");
  await cmdArch({ out, format: "all" }, []);

  console.log("== architecture (container) ==");
  const container = archSvg(sampleContainerArchitecture(), { level: "container" });
  const ce = await emitSvg(container, out, "architecture-container", "png", 2);
  console.log("  png:", ce.pngPath);

  console.log("== architecture (dark) ==");
  const dark = archSvg(sampleArchitecture(), { theme: "dark" });
  const de = await emitSvg(dark, out, "architecture-dark", "png", 2);
  console.log("  png:", de.pngPath);

  console.log("== mind map (radial) ==");
  await cmdMindmap({ out, format: "all" }, []);

  console.log("== mind map (tree) ==");
  const tree = mindmapSvg(sampleMindmap(), { layout: "tree" });
  const te = await emitSvg(tree, out, "mindmap-tree", "png", 2);
  console.log("  png:", te.pngPath);

  console.log("== algorithm (bubble sort) ==");
  await cmdAlgorithm({ out, format: "all", values: sampleSortSpec().values.join(","), kind: "bars" }, ["sort"]);

  console.log("== algorithm (binary search) ==");
  await cmdAlgorithm({ out, format: "all", values: sampleSearchSpec().values.join(","), target: "9", kind: "cells" }, ["search"]);

  console.log("== data flow (graphviz / d2 / animated) ==");
  const dot = await renderFile("graphviz", "examples/data-flow.dot", "png", out, "data-flow-graphviz");
  console.log("  graphviz png:", dot);
  const d2 = await renderFile("d2", "examples/data-flow.d2", "png", out, "data-flow-d2");
  console.log("  d2 png:", d2);
  const boards = await renderD2Animated(readFileSync("examples/boards.d2", "utf8"), out, 900, "data-flow-boards-animated");
  console.log("  d2 step-reveal animated svg:", boards);
  const { nodes, steps } = defaultFlow();
  const svgPath = writeAnimatedSvg(nodes, steps, out, "data-flow-animated", {
    title: "pocketwire — prompt + approval round trip",
    width: 1280,
  });
  console.log("  animated svg:", svgPath);
  const rec = await recordSvgAnimation(svgPath, join(out, "data-flow.gif"), { seconds: 8, fps: 15, format: "gif" });
  console.log("  gif:", rec.out);

  console.log("== gallery ==");
  console.log("  gallery:", buildGallery(out));
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? "help";
  const { opts, rest } = argsOf(argv.slice(1));

  switch (cmd) {
    case "list-engines": {
      for (const e of engineStatuses()) {
        console.log(`${e.available ? "✓" : "✗"} ${e.engine}${e.version ? " " + e.version : ""}${e.note ? " — " + e.note : ""}`);
      }
      break;
    }
    case "list-templates": {
      const { listTemplates } = await import("./presets.js");
      console.log(JSON.stringify(listTemplates(), null, 2));
      break;
    }
    case "render": {
      const engine = rest[0] as "graphviz" | "d2";
      const file = rest[1];
      if (!engine || !file) {
        console.error("usage: render <graphviz|d2> <file>");
        process.exit(1);
      }
      const outDir = opts.out ?? ".";
      const name = opts.name;
      const fmt = opts.format ?? "svg";
      if (fmt === "all") {
        console.log("svg:", await renderFile(engine, file, "svg", outDir, name));
        console.log("png:", await renderFile(engine, file, "png", outDir, name));
      } else {
        const fmt2 = fmt === "png" ? "png" : "svg";
        console.log(`${fmt2}:`, await renderFile(engine, file, fmt2, outDir, name));
      }
      break;
    }
    case "arch":
      await cmdArch(opts, rest);
      break;
    case "mindmap":
      await cmdMindmap(opts, rest);
      break;
    case "algorithm":
      await cmdAlgorithm(opts, rest);
      break;
    case "animate": {
      const outDir = opts.out ?? ".";
      let nodes: FlowNode[] = defaultFlow().nodes;
      let steps: FlowStep[] = defaultFlow().steps;
      const spec = rest[0];
      if (spec) {
        const data = JSON.parse(readFileSync(resolve(spec), "utf8")) as {
          nodes: FlowNode[];
          steps: FlowStep[];
          title?: string;
        };
        nodes = data.nodes;
        steps = data.steps;
      }
      const svgPath = writeAnimatedSvg(nodes, steps, outDir, "data-flow-animated", {
        title: opts.title,
        width: Number(opts.width ?? 1280),
      });
      console.log("animated svg:", svgPath);
      if (opts.gif && opts.gif !== "false") {
        const fmt = opts.gif === "mp4" ? "mp4" : "gif";
        const rec = await recordSvgAnimation(svgPath, join(outDir, `data-flow.${fmt}`), {
          seconds: Number(opts.seconds ?? 8),
          fps: Number(opts.fps ?? 15),
          format: fmt,
        });
        console.log(`${fmt}:`, rec.out);
      }
      break;
    }
    case "record": {
      const svgFile = rest[0];
      const outFile = rest[1];
      if (!svgFile || !outFile) {
        console.error("usage: record <file.svg> <out.gif|out.mp4>");
        process.exit(1);
      }
      const fmt = (opts.format ?? (outFile.endsWith(".mp4") ? "mp4" : "gif")) as "gif" | "mp4";
      const rec = await recordSvgAnimation(svgFile, outFile, {
        seconds: Number(opts.seconds ?? 8),
        fps: Number(opts.fps ?? 15),
        format: fmt,
      });
      console.log(JSON.stringify(rec));
      break;
    }
    case "demo": {
      await cmdDemo(opts.out ?? "examples/out");
      break;
    }
    case "gallery": {
      const dir = rest[0] ?? opts.out ?? ".";
      console.log("gallery:", buildGallery(dir));
      break;
    }
    default:
      console.log(HELP);
  }
}

main().catch((err) => {
  console.error("draw-design:", err);
  process.exit(1);
});
