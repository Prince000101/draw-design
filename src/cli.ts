import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { engineStatuses } from "./engines.js";
import { renderD2Animated, renderFile } from "./render.js";
import { animateDataflow, defaultFlow, writeAnimatedSvg } from "./animate.js";
import { recordSvgAnimation } from "./record.js";
import { buildGallery } from "./gallery.js";
import type { FlowNode, FlowStep } from "./types.js";

const HELP = `draw-design — diagram + animation generator

USAGE
  npm run diagram -- <command> [options]

COMMANDS
  list-engines                     show installed render backends
  render <dot|d2> <file>           render source file to SVG + PNG
    --format svg|png               (default: svg; pass 'all' for both)
    --out <dir>                    output directory (default: .)
    --name <base>                  output base name (default: input name)
  animate [file.json]              generate animated data-flow SVG
    --title <text>
    --width <px>                   (default: 1080)
    --out <dir>                    (default: .)
    --gif [gif|mp4]                also record a GIF/MP4 (default: none)
    --seconds <n> --fps <n>        recording settings
  record <file.svg> <out>          record animated SVG to GIF/MP4
    --seconds <n> --fps <n>
    --format gif|mp4               (default: gif)
  demo                             generate all examples + gallery
  gallery [dir]                    build gallery.html for a directory
  help                             this help

EXAMPLES
  npm run diagram -- render dot examples/data-flow.dot --out examples/out
  npm run diagram -- render d2 examples/data-flow.d2 --out examples/out
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

async function cmdDemo(outDir: string) {
  const dot = await renderFile("graphviz", "examples/data-flow.dot", "png", outDir, "data-flow-graphviz");
  console.log("graphviz png:", dot);
  const d2 = await renderFile("d2", "examples/data-flow.d2", "png", outDir, "data-flow-d2");
  console.log("d2 png:", d2);
  const boards = await renderD2Animated(
    readFileSync("examples/boards.d2", "utf8"),
    outDir,
    900,
    "data-flow-boards-animated",
  );
  console.log("d2 step-reveal animated svg:", boards);
  const { nodes, steps } = defaultFlow();
  const svgPath = writeAnimatedSvg(nodes, steps, outDir, "data-flow-animated", {
    title: "pocketwire — prompt + approval round trip",
    width: 1080,
  });
  console.log("animated svg:", svgPath);
  const rec = await recordSvgAnimation(svgPath, join(outDir, "data-flow.gif"), {
    seconds: 8,
    fps: 15,
    format: "gif",
  });
  console.log("gif:", rec.out);
  const gal = buildGallery(outDir);
  console.log("gallery:", gal);
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
        width: Number(opts.width ?? 1080),
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
