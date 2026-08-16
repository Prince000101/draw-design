import { spawnSync, execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { d2Binary, dotBinary } from "./engines.js";
import { svgToPng } from "./record.js";
import type { Engine, ImageFormat } from "./types.js";

export async function renderSource(
  engine: Engine,
  source: string,
  format: ImageFormat,
  outDir: string,
  name = "diagram",
): Promise<string> {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.${format}`);

  if (engine === "graphviz") {
    const bin = dotBinary();
    if (!bin) throw new Error("graphviz 'dot' is not installed");
    const r = spawnSync(bin, [`-T${format}`, "-o", out], {
      input: source,
      encoding: "utf8",
    });
    if (r.status !== 0) {
      throw new Error(`dot failed:\n${r.stderr || r.stdout}`);
    }
    return out;
  }

  if (engine === "d2") {
    const bin = d2Binary();
    if (!bin) throw new Error("d2 is not installed");
    const tmpIn = join(dir, `${name}.d2`);
    writeFileSync(tmpIn, source);
    if (format === "png") {
      // d2's own PNG export needs a playwright driver download (often 404).
      // Render SVG (pure Go) then rasterize with our local Chromium instead.
      const svgOut = join(dir, `${name}.svg`);
      const r = spawnSync(bin, ["--layout", "dagre", "-t", "0", tmpIn, svgOut], {
        encoding: "utf8",
      });
      if (r.status !== 0) {
        throw new Error(`d2 failed:\n${r.stderr || r.stdout}`);
      }
      return svgToPng(svgOut, out);
    }
    const r = spawnSync(bin, ["--layout", "dagre", "-t", "0", tmpIn, out], {
      encoding: "utf8",
    });
    if (r.status !== 0) {
      throw new Error(`d2 failed:\n${r.stderr || r.stdout}`);
    }
    return out;
  }

  throw new Error(`render engine '${engine}' not supported`);
}

export async function renderFile(
  engine: Engine,
  filePath: string,
  format: ImageFormat,
  outDir: string,
  name?: string,
): Promise<string> {
  const src = readFileSync(resolve(filePath), "utf8");
  const base = name ?? filePath.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, "");
  return renderSource(engine, src, format, outDir, base);
}

/**
 * Render a multi-board D2 source with the --animate-interval flag: the
 * SVG transitions through each board at the given interval (step reveal).
 */
export async function renderD2Animated(
  source: string,
  outDir: string,
  intervalMs: number,
  name = "boards-animated",
): Promise<string> {
  const bin = d2Binary();
  if (!bin) throw new Error("d2 is not installed");
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const tmpIn = join(dir, `${name}.d2`);
  writeFileSync(tmpIn, source);
  const out = join(dir, `${name}.svg`);
  const r = spawnSync(
    bin,
    ["--layout", "dagre", "-t", "0", "--animate-interval", String(intervalMs), tmpIn, out],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(`d2 animate failed:\n${r.stderr || r.stdout}`);
  }
  return out;
}

export function engineVersion(engine: Engine): string | undefined {
  try {
    if (engine === "graphviz") {
      const bin = dotBinary();
      return bin
        ? execFileSync(bin, ["-V"], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim()
        : undefined;
    }
    if (engine === "d2") {
      const bin = d2Binary();
      return bin
        ? execFileSync(bin, ["version"], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim()
        : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
