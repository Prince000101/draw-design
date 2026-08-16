import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromeBinary } from "./engines.js";
import type { RecordOpts } from "./types.js";

/** Convert an SVG file to PNG by rendering it in headless Chromium. */
export async function svgToPng(svgPath: string, pngPath: string): Promise<string> {
  const exe = chromeBinary();
  if (!exe) throw new Error("no Chromium found");
  const browser = await chromium.launch({
    executablePath: exe,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.goto("file://" + resolve(svgPath));
    await page.waitForSelector("svg");
    const size = await page.evaluate(() => {
      const s = document.querySelector("svg")!;
      return {
        w: Number(s.getAttribute("width")) || s.viewBox.baseVal.width || 800,
        h: Number(s.getAttribute("height")) || s.viewBox.baseVal.height || 600,
      };
    });
    await page.setViewportSize({ width: Math.ceil(size.w), height: Math.ceil(size.h) });
    await page.waitForTimeout(200);
    const out = resolve(pngPath);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    return out;
  } finally {
    await browser.close();
  }
}

function runFfmpeg(
  workDir: string,
  out: string,
  fps: number,
  width: number,
  mp4: boolean,
): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const args = mp4
      ? [
          "-y", "-framerate", String(fps),
          "-i", join(workDir, "frame-%04d.png"),
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
          out,
        ]
      : [
          "-y", "-framerate", String(fps),
          "-i", join(workDir, "frame-%04d.png"),
          "-vf",
          `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
          "-loop", "0",
          out,
        ];
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += String(d)));
    p.on("error", rejectP);
    p.on("close", (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`ffmpeg exited ${code}: ${err.slice(-1200)}`));
    });
  });
}

/**
 * Record an (animated) SVG to GIF or MP4 by sweeping the SVG timeline in
 * headless Chromium and encoding the frames with ffmpeg.
 */
export async function recordSvgAnimation(
  svgPath: string,
  outPath: string,
  opts: RecordOpts = {},
): Promise<{ out: string; frames: number; fps: number; seconds: number; format: string }> {
  const fps = opts.fps ?? 15;
  const seconds = opts.seconds ?? 6;
  const format = opts.format ?? "gif";
  const frames = Math.max(2, Math.round(fps * seconds));

  const exe = chromeBinary();
  if (!exe) throw new Error("no Chromium found — install playwright browsers (npx playwright install chromium)");
  const browser = await chromium.launch({
    executablePath: exe,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("file://" + resolve(svgPath));
    await page.waitForSelector("svg");
    const size = await page.evaluate(() => {
      const s = document.querySelector("svg")!;
      const w =
        Number(s.getAttribute("width")) ||
        s.viewBox.baseVal.width ||
        800;
      const h =
        Number(s.getAttribute("height")) ||
        s.viewBox.baseVal.height ||
        600;
      return { w, h };
    });
    await page.setViewportSize({ width: Math.ceil(size.w), height: Math.ceil(size.h) });
    await page.waitForTimeout(300);

    const work = join(tmpdir(), `dd-record-${Date.now()}`);
    mkdirSync(work, { recursive: true });
    for (let i = 0; i < frames; i++) {
      const t = i / fps;
      await page.evaluate((tv) => {
        const s = document.querySelector("svg");
        if (s && typeof s.setCurrentTime === "function") s.setCurrentTime(tv);
      }, t);
      await page.waitForTimeout(18);
      await page.screenshot({
        path: join(work, `frame-${String(i).padStart(4, "0")}.png`),
      });
    }

    const ext = format === "mp4" ? "mp4" : "gif";
    const finalOut = outPath.endsWith("." + ext) ? outPath : `${outPath}.${ext}`;
    mkdirSync(dirname(resolve(finalOut)), { recursive: true });
    await runFfmpeg(work, resolve(finalOut), fps, Math.round(size.w), format === "mp4");
    rmSync(work, { recursive: true, force: true });
    return { out: finalOut, frames, fps, seconds, format: ext };
  } finally {
    await browser.close();
  }
}
