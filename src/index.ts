import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { engineStatuses } from "./engines.js";
import { renderSource } from "./render.js";
import { animateDataflow, defaultFlow, writeAnimatedSvg } from "./animate.js";
import { recordSvgAnimation } from "./record.js";
import { buildGallery } from "./gallery.js";
import { emitSvg } from "./emit.js";
import { archSvg, normalizeArchModel } from "./architecture.js";
import { mindmapSvg } from "./mindmap.js";
import { algoSvg, bubbleSortSteps, binarySearchSteps } from "./algorithm.js";
import { listTemplates } from "./presets.js";
import type { AnimateOpts, FlowNode, FlowStep } from "./types.js";
import type { ArchModel } from "./architecture.js";
import type { MindMapNode } from "./mindmap.js";
import type { AlgStep, AlgSpec } from "./algorithm.js";

export const server = new McpServer({
  name: "draw-design",
  version: "0.2.0",
});

const aspects = ["16:9", "4:3", "3:2", "16:10", "square"] as const;
const genCommon = {
  aspect: z.enum(aspects).default("16:9"),
  width: z.number().optional(),
  height: z.number().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  format: z.enum(["svg", "png"]).default("svg"),
  outDir: z.string().default("."),
  name: z.string().optional(),
  record: z.boolean().default(false),
  seconds: z.number().default(6),
  fps: z.number().default(15),
  videoFormat: z.enum(["gif", "mp4"]).default("gif"),
};

function baseName(name: string | undefined, fallback: string): string {
  return (name ?? fallback).replace(/\.(svg|png|gif|mp4)$/i, "");
}

server.registerTool(
  "list_engines",
  {
    title: "List available diagram engines and generators",
    description:
      "Reports which rendering backends are installed (graphviz dot, d2, svg-animation, record via chromium+ffmpeg) plus the built-in generators (architecture, mindmap, algorithm) and their versions.",
  },
  async () => {
    const statuses = engineStatuses();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(statuses, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "list_templates",
  {
    title: "List templates, presets and design options",
    description:
      "Returns the available themes, aspect ratios (all generators default to a consistent 16:9 canvas), architecture kinds/levels, mind map layouts and algorithm presets.",
  },
  async () => {
    return {
      content: [{ type: "text", text: JSON.stringify(listTemplates(), null, 2) }],
    };
  },
);

server.registerTool(
  "render_diagram",
  {
    title: "Render a diagram source to SVG/PNG",
    description:
      "Renders Graphviz DOT or D2 source into an SVG or PNG file on disk and returns the absolute path. Use graphviz for detailed graphs, d2 for clean modern diagrams.",
    inputSchema: {
      engine: z.enum(["graphviz", "d2"], {
        description: "renderer to use",
      }),
      source: z
        .string({ description: "inline diagram source (DOT or D2)" })
        .optional(),
      sourceFile: z
        .string({ description: "path to a .dot/.gv/.d2 source file (alternative to source)" })
        .optional(),
      format: z.enum(["svg", "png"]).default("svg"),
      outDir: z
        .string({ description: "directory to write the output file into" })
        .default("."),
      name: z.string({ description: "output file base name" }).optional(),
    },
  },
  async ({ engine, source, sourceFile, format, outDir, name }) => {
    try {
      const src = sourceFile ? (await import("node:fs")).readFileSync(sourceFile, "utf8") : source;
      if (!src) throw new Error("provide either source or sourceFile");
      const out = await renderSource(engine, src, format, outDir, name ?? "diagram");
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, path: out, format, engine }) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String((err as Error).message) }) }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "generate_architecture",
  {
    title: "Generate a C4-style architecture diagram",
    description:
      "Builds a polished C4 context (level 1) or container (level 2) diagram from a JSON model. Model: { title?, subtitle?, theme?, level?, systems: [{ id, name, kind, desc?, tech?, color?, containers? }], edges: [{ from, to, label?, tech?, color? }] }. Kinds: person, system, container, database, queue, external. Outputs a consistent 16:9 SVG (or PNG) with a staged reveal animation; optionally record it to GIF/MP4.",
    inputSchema: {
      model: z.record(z.string(), z.any(), { description: "architecture model JSON" }),
      level: z.enum(["context", "container"]).optional(),
      ...genCommon,
    },
  },
  async (args) => {
    try {
      const { model, level, aspect, width, height, theme, format, outDir, name, record, seconds, fps, videoFormat } = args as Record<string, unknown> & {
        model: Record<string, unknown>;
        level?: "context" | "container";
        aspect?: string;
        width?: number;
        height?: number;
        theme?: "light" | "dark";
        format: string;
        outDir: string;
        name?: string;
        record: boolean;
        seconds: number;
        fps: number;
        videoFormat: "gif" | "mp4";
      };
      const arch = normalizeArchModel(model as unknown as ArchModel);
      const svg = archSvg(arch, { level, theme, aspect, width, height });
      const nm = baseName(name, "architecture");
      const emit = await emitSvg(svg, outDir, nm, format as "svg" | "png", format === "png" ? 2 : undefined);
      let videoPath: string | undefined;
      if (record) {
        const rec = await recordSvgAnimation(emit.svgPath, `${nm}.${videoFormat}`, {
          seconds,
          fps,
          format: videoFormat,
        });
        videoPath = rec.out;
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, ...emit, videoPath, level: arch.level, systems: arch.systems.length, edges: arch.edges.length }) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String((err as Error).message) }) }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "generate_mindmap",
  {
    title: "Generate a mind map (radial or tree)",
    description:
      "Builds a radial mind map (root centered, branches color-coded on rings) or a left-right tree from a nested model: { label, note?, color?, children? }. Outputs a consistent 16:9 SVG (or PNG) with a staged reveal animation; optionally record it to GIF/MP4.",
    inputSchema: {
      root: z.record(z.string(), z.any(), { description: "nested mind map node" }),
      title: z.string().optional(),
      layout: z.enum(["radial", "tree"]).default("radial"),
      ...genCommon,
    },
  },
  async (args) => {
    try {
      const { root, title, layout, aspect, width, height, theme, format, outDir, name, record, seconds, fps, videoFormat } = args as Record<string, unknown> & {
        root: Record<string, unknown>;
        title?: string;
        layout?: "radial" | "tree";
        aspect?: string;
        width?: number;
        height?: number;
        theme?: "light" | "dark";
        format: string;
        outDir: string;
        name?: string;
        record: boolean;
        seconds: number;
        fps: number;
        videoFormat: "gif" | "mp4";
      };
      const svg = mindmapSvg(root as unknown as MindMapNode, { title, layout, theme, aspect, width, height });
      const nm = baseName(name, "mindmap");
      const emit = await emitSvg(svg, outDir, nm, format as "svg" | "png", format === "png" ? 2 : undefined);
      let videoPath: string | undefined;
      if (record) {
        const rec = await recordSvgAnimation(emit.svgPath, `${nm}.${videoFormat}`, {
          seconds,
          fps,
          format: videoFormat,
        });
        videoPath = rec.out;
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, ...emit, videoPath, layout }) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String((err as Error).message) }) }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "animate_algorithm",
  {
    title: "Generate a step-animated algorithm visualization (SVG or manim MP4)",
    description:
      "Creates a step-animated visualization of an algorithm over an array. Engine 'smil' (default) produces a self-playing SVG (kind 'bars' animates a bubble sort, kind 'cells' a binary search; pass explicit steps for full control) and can be recorded to GIF/MP4. Engine 'manim' renders a buttery-smooth MP4 via the manim Python library (3b1b) at 1280x720; it ignores 'steps' and requires manim installed (see README).",
    inputSchema: {
      kind: z.enum(["bars", "cells"]).default("bars"),
      values: z.array(z.number()).min(1),
      steps: z.array(z.record(z.string(), z.any())).optional(),
      target: z.number().optional(),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      engine: z.enum(["smil", "manim"]).default("smil"),
      quality: z.enum(["ql", "qm", "qh", "qp"]).default("qm"),
      ...genCommon,
    },
  },
  async (args) => {
    try {
      const { kind, values, steps, target, title, subtitle, engine, quality, aspect, width, height, theme, format, outDir, name, record, seconds, fps, videoFormat } = args as Record<string, unknown> & {
        kind?: "bars" | "cells";
        values: number[];
        steps?: AlgStep[];
        target?: number;
        title?: string;
        subtitle?: string;
        engine?: "smil" | "manim";
        quality?: "ql" | "qm" | "qh" | "qp";
        aspect?: string;
        width?: number;
        height?: number;
        theme?: "light" | "dark";
        format: string;
        outDir: string;
        name?: string;
        record: boolean;
        seconds: number;
        fps: number;
        videoFormat: "gif" | "mp4";
      };
      const nm = baseName(name, "algorithm");

      if (engine === "manim") {
        const { renderManimScene, manimAvailable } = await import("./manim.js");
        if (!manimAvailable()) {
          throw new Error(
            "manim is not installed. Set up a venv and install it:\n" +
              "  python3 -m venv ~/.venvs/manim\n" +
              "  ~/.venvs/manim/bin/pip install manim\n" +
              "or set MANIM_BIN to the manim executable.",
          );
        }
        const res = await renderManimScene(
          { kind: kind ?? "bars", values, target, title: title ?? undefined, quality },
          outDir,
          nm,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, path: res.out, format: "mp4", engine: "manim", quality: res.quality }),
            },
          ],
        };
      }

      const spec: AlgSpec = {
        kind: kind ?? "bars",
        values,
        steps: steps as AlgStep[] | undefined,
        target,
        title,
        subtitle,
        theme,
        aspect,
        width,
        height,
      };
      const effective = steps ?? (kind === "cells" ? binarySearchSteps(values, target ?? 0) : bubbleSortSteps(values));
      const svg = algoSvg(spec);
      const midTime = (effective.length / 2) * 1.0;
      const emit = await emitSvg(svg, outDir, nm, format as "svg" | "png", format === "png" ? midTime : undefined);
      let videoPath: string | undefined;
      if (record) {
        const need = effective.length * 1.0 + 1.2;
        const rec = await recordSvgAnimation(emit.svgPath, `${nm}.${videoFormat}`, {
          seconds: Math.max(seconds, Math.ceil(need)),
          fps,
          format: videoFormat,
        });
        videoPath = rec.out;
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: true, ...emit, videoPath, engine: "smil", kind: kind ?? "bars", steps: effective.length }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String((err as Error).message) }) }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "animate_dataflow",
  {
    title: "Generate an animated data-flow SVG (and optional GIF/MP4)",
    description:
      "Builds a self-playing animated SVG: the given nodes are laid out on horizontal lifelines and packets travel between them along each step. Returns the SVG path and, if requested, a GIF/MP4 recorded from it.",
    inputSchema: {
      nodes: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          sub: z.string().optional(),
          color: z.string().optional(),
        }),
      ),
      steps: z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          label: z.string(),
          color: z.string().optional(),
          dur: z.number().optional(),
          lane: z.number().optional(),
        }),
      ),
      title: z.string().optional(),
      width: z.number().default(1280),
      outDir: z.string().default("."),
      name: z.string().default("data-flow-animated"),
      record: z.boolean().default(true),
      seconds: z.number().default(6),
      fps: z.number().default(15),
      format: z.enum(["gif", "mp4"]).default("gif"),
    },
  },
  async ({ nodes, steps, title, width, outDir, name, record, seconds, fps, format }) => {
    try {
      const opts: AnimateOpts = { title, width };
      const svgPath = writeAnimatedSvg(nodes as FlowNode[], steps as FlowStep[], outDir, name, opts);
      let videoPath: string | undefined;
      if (record) {
        const res = await recordSvgAnimation(svgPath, svgPath.replace(/\.svg$/, `.${format}`), {
          seconds,
          fps,
          format,
        });
        videoPath = res.out;
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              svgPath,
              videoPath,
              nodes: nodes.length,
              steps: steps.length,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String((err as Error).message) }) }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "record_svg_animation",
  {
    title: "Record an animated SVG to GIF or MP4",
    description:
      "Loads an animated SVG in headless Chromium, sweeps its timeline frame-by-frame, and encodes the result with ffmpeg. Output is a GIF or MP4 usable anywhere.",
    inputSchema: {
      svgPath: z.string(),
      outPath: z.string({ description: "output file (extension decides gif/mp4 if format omitted)" }).optional(),
      seconds: z.number().default(6),
      fps: z.number().default(15),
      format: z.enum(["gif", "mp4"]).optional(),
    },
  },
  async ({ svgPath, outPath, seconds, fps, format }) => {
    try {
      const out = outPath ?? svgPath.replace(/\.svg$/, ".gif");
      const res = await recordSvgAnimation(svgPath, out, { seconds, fps, format });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...res }) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String((err as Error).message) }) }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "build_gallery",
  {
    title: "Build an HTML gallery of generated diagrams",
    description:
      "Scans a directory for *.svg/*.png/*.gif/*.mp4 and writes gallery.html embedding them all for quick visual review.",
    inputSchema: {
      outDir: z.string().default("."),
    },
  },
  async ({ outDir }) => {
    try {
      const out = buildGallery(outDir);
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, path: out }) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String((err as Error).message) }) }],
        isError: true,
      };
    }
  },
);

export const demoFlow = defaultFlow;

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("draw-design server error:", err);
  process.exit(1);
});
