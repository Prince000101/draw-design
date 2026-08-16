import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { engineStatuses } from "./engines.js";
import { renderSource } from "./render.js";
import { animateDataflow, defaultFlow, writeAnimatedSvg } from "./animate.js";
import { recordSvgAnimation } from "./record.js";
import { buildGallery } from "./gallery.js";
import type { AnimateOpts, FlowNode, FlowStep } from "./types.js";

export const server = new McpServer({
  name: "draw-design",
  version: "0.1.0",
});

server.registerTool(
  "list_engines",
  {
    title: "List available diagram engines",
    description:
      "Reports which rendering backends are installed (graphviz dot, d2, svg-animation, record via chromium+ffmpeg) and their versions.",
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
      width: z.number().default(1080),
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
