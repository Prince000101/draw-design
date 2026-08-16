import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { EngineInfo } from "./types.js";
import { manimBinary } from "./manim.js";

function which(cmd: string): string | undefined {
  try {
    return execSync(`which ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim() || undefined;
  } catch {
    return undefined;
  }
}

export function dotBinary(): string | undefined {
  return which("dot");
}

export function d2Binary(): string | undefined {
  const fromPath = which("d2");
  if (fromPath) return fromPath;
  const local = join(homedir(), ".local", "bin", "d2");
  return existsSync(local) ? local : undefined;
}

export function chromeBinary(): string | undefined {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const base = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(base)) return undefined;
  try {
    const dirs = readdirSync(base, { withFileTypes: true });
    const found: string[] = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const candidates: string[] = [];
      if (d.name.startsWith("chromium_headless_shell-")) {
        candidates.push(
          join(base, d.name, "chrome-linux", "headless_shell"),
          join(base, d.name, "chrome-linux64", "headless_shell"),
        );
      } else if (d.name.startsWith("chromium-")) {
        candidates.push(
          join(base, d.name, "chrome-linux64", "chrome"),
          join(base, d.name, "chrome-linux", "chrome"),
        );
      }
      for (const c of candidates) {
        if (existsSync(c)) found.push(c);
      }
    }
    found.sort();
    return found[0];
  } catch {
    return undefined;
  }
}

function versionOf(cmd: string, flag: string): string | undefined {
  try {
    const r = spawnSync(cmd, [flag], { stdio: ["ignore", "pipe", "pipe"] });
    return (r.stderr?.toString() || r.stdout?.toString() || "").trim() || undefined;
  } catch {
    return undefined;
  }
}

export function engineStatuses(): EngineInfo[] {
  const dot = dotBinary();
  const d2 = d2Binary();
  const chrome = chromeBinary();
  const dotVersion = dot ? versionOf(dot, "-V") : undefined;
  const d2Version = d2 ? versionOf(d2, "version") : undefined;
  return [
    {
      engine: "graphviz",
      available: !!dot,
      binary: dot,
      version: dotVersion,
      note: "dot -Tsvg/-Tpng renderer",
    },
    {
      engine: "d2",
      available: !!d2,
      binary: d2,
      version: d2Version,
      note: "d2 -Tsvg/-Tpng renderer with themes",
    },
    {
      engine: "svg-animation",
      available: true,
      note: "built-in SMIL/CSS animated SVG generator (no binary needed)",
    },
    {
      engine: "architecture",
      available: true,
      note: "C4 context/container generator (context, container levels)",
    },
    {
      engine: "mindmap",
      available: true,
      note: "radial + tree mind map generator",
    },
    {
      engine: "algorithm",
      available: true,
      note: "step-animated bars/cells algorithm visualizer (SMIL)",
    },
    {
      engine: "manim",
      available: !!manimBinary(),
      binary: manimBinary(),
      note: "manim (3b1b) Python renderer -> smooth 16:9 MP4 (720p+)",
    },
    {
      engine: "record",
      available: !!chrome,
      binary: chrome,
      note: "headless Chromium frame capture + ffmpeg -> GIF/MP4",
    },
  ];
}
