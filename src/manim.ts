import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { AlgStep } from "./algorithm.js";

export type ManimQuality = "ql" | "qm" | "qh" | "qp";

export interface ManimSpec {
  kind: "bars" | "cells";
  values: number[];
  steps?: AlgStep[];
  target?: number;
  title?: string;
  quality?: ManimQuality;
}

const ACCENT = ["#6366f1", "#14b8a6", "#f59e0b", "#f43f5e", "#8b5cf6", "#0ea5e9", "#84cc16", "#ec4899"];

export function manimBinary(): string | undefined {
  const candidates = [
    process.env.MANIM_BIN,
    join(homedir(), ".venvs", "manim", "bin", "manim"),
    join(homedir(), ".local", "venvs", "manim", "bin", "manim"),
    join(process.cwd(), ".venv-manim", "bin", "manim"),
    "/tmp/opencode/manim-venv/bin/manim",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

export function manimAvailable(): boolean {
  return !!manimBinary();
}

const SORT_PROLOGUE = `from manim import *

# draw-design manim backend — generated scene, do not edit
class DDSort(Scene):
    def construct(self):
        config.frame_width = 16
        config.frame_height = 9
`;

function quote(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildSortScene(values: number[], title: string): string {
  const n = values.length;
  const maxv = Math.max(...values, 1);
  const slot = n > 1 ? 14.4 / n : 14.4;
  const barW = Math.min(1.3, slot * 0.72);
  const baseY = -3.4;

  const lines: string[] = [SORT_PROLOGUE];
  lines.push(`        values = ${JSON.stringify(values)}`);
  lines.push(`        n = len(values)`);
  lines.push(`        maxv = max(values)`);
  lines.push(`        slot = ${slot.toFixed(4)}`);
  lines.push(`        bar_w = ${barW.toFixed(4)}`);
  lines.push(`        base_y = ${baseY}`);
  lines.push(`        colors = ${JSON.stringify(ACCENT)}`);
  lines.push("        groups = []");
  lines.push("        for i, v in enumerate(values):");
  lines.push("            h = 0.6 + 5.2 * (v / maxv)");
  lines.push("            x = -7.2 + i * slot + slot / 2");
  lines.push("            r = Rectangle(width=bar_w, height=h, fill_opacity=1,");
  lines.push("                            stroke_color=WHITE, stroke_width=2)");
  lines.push("            r.move_to([x, base_y + h / 2, 0])");
  lines.push(`            lbl = Text(str(v), font_size=${n > 12 ? 20 : 26}, color=BLACK)`);
  lines.push("            lbl.move_to(r.get_center())");
  lines.push("            g = VGroup(r, lbl).move_to([x, base_y + h / 2, 0])");
  lines.push("            g.set_color(colors[i % len(colors)])");
  lines.push("            g[1].set_color(BLACK)");
  lines.push("            groups.append(g)");
  lines.push(`        self.play(*[GrowFromEdge(g, DOWN) for g in groups], run_time=1.2)`);
  lines.push(`        self.cap = Text("${quote(title)}", font_size=34, color=WHITE).to_edge(UP)`);
  lines.push("        self.add(self.cap)");
  lines.push("        self.wait(0.4)");
  lines.push("        def set_cap(t):");
  lines.push("            new = Text(t, font_size=30, color=WHITE).to_edge(UP)");
  lines.push("            self.play(Transform(self.cap, new), run_time=0.18)");
  lines.push("        def paint(i, col):");
  lines.push("            return groups[i][0].animate.set_color(col)");

  const a = [...values];
  const gIdx = a.map((_, i) => i);
  const done: number[] = [];
  let stepNum = 0;
  const appendCompare = (i: number, j: number) => {
    stepNum += 1;
    lines.push(`        self.play(paint(${i}, "#f59e0b"), paint(${j}, "#f59e0b"), run_time=0.3)`);
    lines.push(`        set_cap("${quote(`${stepNum}. Compare ${a[i]} and ${a[j]}`)}")`);
    lines.push("        self.wait(0.25)");
  };
  const appendSwap = (i: number, j: number) => {
    stepNum += 1;
    lines.push(`        self.play(paint(${i}, "#f43f5e"), paint(${j}, "#f43f5e"), run_time=0.18)`);
    lines.push(`        set_cap("${quote(`${stepNum}. Swap → ${a[j]} moves left`)}")`);
    lines.push(`        self.play(Swap(groups[${i}], groups[${j}]), run_time=0.55)`);
    lines.push(`        self.play(paint(${i}, colors[${i} % len(colors)]), paint(${j}, colors[${j} % len(colors)]), run_time=0.18)`);
    lines.push("        self.wait(0.25)");
  };
  const appendLock = (pos: number) => {
    stepNum += 1;
    lines.push(`        set_cap("${quote(`${stepNum}. ${a[pos]} locked in place`)}")`);
    lines.push(`        self.play(paint(${pos}, "#059669"), run_time=0.35)`);
    lines.push("        self.wait(0.3)");
  };

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      appendCompare(j, j + 1);
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        [gIdx[j], gIdx[j + 1]] = [gIdx[j + 1], gIdx[j]];
        appendSwap(j, j + 1);
      }
    }
    done.push(n - 1 - i);
    appendLock(n - 1 - i);
  }
  done.push(0);
  lines.push('        set_cap("All elements sorted")');
  lines.push("        self.play(*[paint(i, '#059669') for i in range(n)], run_time=0.6)");
  lines.push("        self.wait(1.2)");

  return lines.join("\n") + "\n";
}

function buildSearchScene(values: number[], target: number, title: string): string {
  const a = [...values].sort((x, y) => x - y);
  const n = a.length;
  const slot = n > 1 ? 13.5 / n : 13.5;
  const cellW = Math.min(1.6, slot * 0.74);

  const lines: string[] = [`from manim import *

class DDSearch(Scene):
    def construct(self):
        config.frame_width = 16
        config.frame_height = 9
        values = ${JSON.stringify(a)}
        target = ${target}
        n = len(values)
        slot = ${slot.toFixed(4)}
        cell_w = ${cellW.toFixed(4)}
        cell_h = 2.6
        cells = []
        for i, v in enumerate(values):
            x = -6.75 + i * slot + slot / 2
            r = Rectangle(width=cell_w, height=cell_h, fill_opacity=1,
                          stroke_color=WHITE, stroke_width=2).move_to([x, 0, 0])
            lbl = Text(str(v), font_size=${n > 12 ? 22 : 30}, color=BLACK).move_to(r.get_center())
            idx = Text(str(i), font_size=18, color=GREY_A).next_to(r, DOWN, buff=0.25)
            cells.append((r, lbl))
            self.add(r, lbl, idx)
        self.cap = Text("${quote(title)}", font_size=34, color=WHITE).to_edge(UP)
        self.add(self.cap)
        self.wait(0.4)
        def set_cap(t):
            new = Text(t, font_size=30, color=WHITE).to_edge(UP)
            self.play(Transform(self.cap, new), run_time=0.18)
        def ptr(color, label):
            tri = Triangle(color=color, fill_opacity=1, stroke_width=0).scale(0.22)
            lab = Text(label, font_size=20, color=color).next_to(tri, UP, buff=0.08)
            return VGroup(tri, lab).to_edge(UP, buff=0.6)
        lo_ptr = ptr("#f59e0b", "lo")
        hi_ptr = ptr("#f59e0b", "hi")
        mid_ptr = ptr("#6366f1", "mid")
        def over(g, i):
            x = -6.75 + i * slot + slot / 2
            return g.animate.move_to([x, 1.9, 0])
        self.play(over(lo_ptr, 0), over(hi_ptr, n - 1), run_time=0.5)
        lo, hi = 0, n - 1
        found = False
        while lo <= hi:
            mid = (lo + hi) // 2
            self.play(over(mid_ptr, mid), run_time=0.35)
            self.play(cells[mid][0].animate.set_color("#6366f1"), cells[mid][1].animate.set_color(WHITE), run_time=0.25)
            set_cap(f"mid = ({lo} + {hi}) / 2 = {mid}")
            self.wait(0.3)
            if values[mid] == target:
                self.play(cells[mid][0].animate.set_color("#059669"), run_time=0.3)
                set_cap(f"Found {target} at index {mid}")
                self.wait(1.0)
                found = True
                break
            if values[mid] < target:
                lo = mid + 1
                set_cap(f"{values[mid]} < {target} → search right half")
            else:
                hi = mid - 1
                set_cap(f"{values[mid]} > {target} → search left half")
            if lo <= hi:
                self.play(over(lo_ptr, lo), over(hi_ptr, hi), run_time=0.35)
            self.wait(0.3)
        if not found:
            set_cap(f"{target} is not present")
            self.play(*[c[0].animate.set_color("#e11d48") for c in cells], run_time=0.5)
            self.wait(1.0)
        self.wait(0.6)
`];
  return lines.join("\n");
}

function buildScene(spec: ManimSpec): string {
  return spec.kind === "cells"
    ? buildSearchScene(spec.values, spec.target ?? 0, spec.title ?? "Binary search")
    : buildSortScene(spec.values, spec.title ?? "Bubble sort");
}

/**
 * Render an algorithm animation with manim and return the MP4 path.
 * Renders at 16:9 (720p by default) to match the rest of draw-design.
 */
export async function renderManimScene(
  spec: ManimSpec,
  outDir: string,
  name: string,
): Promise<{ out: string; quality: ManimQuality }> {
  const bin = manimBinary();
  if (!bin) {
    throw new Error(
      "manim is not installed. Set up a venv and install it:\n" +
        "  python3 -m venv ~/.venvs/manim\n" +
        "  ~/.venvs/manim/bin/pip install manim\n" +
        "or set MANIM_BIN to the manim executable.",
    );
  }
  const quality = spec.quality ?? "qm";
  const work = join(resolve(outDir), `.manim-${Date.now()}`);
  const media = join(work, "media");
  const script = join(work, "scene.py");
  mkdirSync(work, { recursive: true });
  writeFileSync(script, buildScene(spec), "utf8");

  const sceneName = spec.kind === "cells" ? "DDSearch" : "DDSort";
  execFileSync(
    bin,
    ["render", `-${quality}`, "--disable_caching", "--format", "mp4", "--media_dir", media, script, sceneName],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (p.endsWith(".mp4")) {
        out.push(p);
      } else if (statSync(p).isDirectory()) {
        out.push(...walk(p));
      }
    }
    return out;
  };
  const mp4s = walk(media).filter((p) => p.endsWith(".mp4"));
  if (mp4s.length === 0) throw new Error("manim rendered but produced no mp4");

  const finalOut = join(resolve(outDir), `${name}.mp4`);
  copyFileSync(mp4s[0], finalOut);
  rmSync(work, { recursive: true, force: true });
  return { out: finalOut, quality };
}
