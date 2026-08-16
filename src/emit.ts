import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { svgToPng } from "./record.js";

export interface EmitResult {
  svgPath: string;
  pngPath?: string;
}

/**
 * Write an SVG to disk and optionally rasterize it to PNG via headless
 * Chromium. `timeSec` advances the SVG timeline first so animated
 * (reveal/step) SVGs capture their fully-revealed state.
 */
export async function emitSvg(
  svg: string,
  outDir: string,
  name: string,
  format: "svg" | "png",
  timeSec?: number,
): Promise<EmitResult> {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const svgPath = join(dir, `${name}.svg`);
  writeFileSync(svgPath, svg, "utf8");
  if (format === "png") {
    const pngPath = join(dir, `${name}.png`);
    await svgToPng(svgPath, pngPath, timeSec);
    return { svgPath, pngPath };
  }
  return { svgPath };
}
