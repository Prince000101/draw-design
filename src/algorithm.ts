import { SvgDoc, canvasFor, circle, rect, textEl, stepWindow, tween, easedTransform, reveal, truncate, esc } from "./svg.js";
import { ACCENT, themeOf } from "./theme.js";
import type { ThemeName } from "./theme.js";

export interface AlgPointer {
  index: number;
  color: string;
  label?: string;
}

export interface AlgStep {
  state?: number[];
  compare?: [number, number];
  swap?: boolean;
  done?: number[];
  focus?: number[];
  pointers?: AlgPointer[];
  label?: string;
  order?: number[];
}

export interface AlgSpec {
  kind?: "bars" | "cells";
  values: number[];
  steps?: AlgStep[];
  target?: number;
  title?: string;
  subtitle?: string;
  theme?: ThemeName;
  aspect?: string;
  width?: number;
  height?: number;
}

const STEP_DUR = 1.0;
const COMPARE = "#f59e0b";
const SWAP = "#f43f5e";
const DONE = "#059669";
const FOCUS = "#6366f1";

/** Bubble-sort step script: states + swap order + highlights. */
export function bubbleSortSteps(values: number[]): AlgStep[] {
  const a = [...values];
  const order = a.map((_, i) => i);
  const steps: AlgStep[] = [];
  const n = a.length;
  const done: number[] = [];
  steps.push({ state: [...a], order: [...order], label: `Start with ${n} elements` });
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      const cmp: [number, number] = [j, j + 1];
      steps.push({
        state: [...a],
        order: [...order],
        compare: cmp,
        done: [...done],
        label: `Compare ${a[j]} and ${a[j + 1]}`,
      });
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        [order[j], order[j + 1]] = [order[j + 1], order[j]];
        steps.push({
          state: [...a],
          order: [...order],
          compare: cmp,
          swap: true,
          done: [...done],
          label: `Swap ${a[j + 1]} and ${a[j]}`,
        });
      }
    }
    done.push(n - 1 - i);
    steps.push({ state: [...a], order: [...order], done: [...done], label: `${a[n - 1 - i]} locked in place` });
  }
  done.push(0);
  steps.push({
    state: [...a],
    order: [...order],
    done: Array.from({ length: n }, (_, k) => k),
    label: "All elements sorted",
  });
  return steps;
}

/** Binary-search step script on a sorted copy of the values. */
export function binarySearchSteps(values: number[], target: number): AlgStep[] {
  const a = [...values].sort((x, y) => x - y);
  let lo = 0;
  let hi = a.length - 1;
  const pointers = (): AlgPointer[] => [
    { index: lo, color: "#f59e0b", label: "lo" },
    { index: hi, color: "#f59e0b", label: "hi" },
  ];
  const steps: AlgStep[] = [{ state: [...a], pointers: pointers(), label: `Binary search for ${target}` }];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ps = [...pointers(), { index: mid, color: "#6366f1", label: "mid" }];
    steps.push({ state: [...a], pointers: ps, focus: [mid], label: `mid = (${lo} + ${hi}) / 2 = ${mid}` });
    if (a[mid] === target) {
      steps.push({ state: [...a], pointers: ps, done: [mid], focus: [mid], label: `Found ${target} at index ${mid}` });
      return steps;
    }
    if (a[mid] < target) {
      lo = mid + 1;
      steps.push({ state: [...a], pointers: pointers(), focus: [mid], label: `${a[mid]} < ${target} → search right half` });
    } else {
      hi = mid - 1;
      steps.push({ state: [...a], pointers: pointers(), focus: [mid], label: `${a[mid]} > ${target} → search left half` });
    }
  }
  steps.push({ state: [...a], pointers: [], label: `${target} is not present` });
  return steps;
}

function baseColor(i: number): string {
  return ACCENT[i % ACCENT.length];
}

function posColor(steps: AlgStep[], k: number, i: number): string {
  const s = steps[k];
  const pos = s.order ? s.order[i] : i;
  if (s.done?.includes(pos)) return DONE;
  if (s.compare?.includes(pos)) return s.swap ? SWAP : COMPARE;
  if (s.focus?.includes(pos)) return FOCUS;
  return baseColor(i);
}

/** Generate a step-animated algorithm visualization (bars or cells). */
export function algoSvg(spec: AlgSpec): string {
  const theme = themeOf(spec.theme);
  const { w, h } = canvasFor(spec.aspect, spec.width, spec.height);
  const kind = spec.kind ?? "bars";
  const values = spec.values;
  const n = values.length;

  const steps: AlgStep[] =
    spec.steps ??
    (kind === "cells"
      ? binarySearchSteps(values, spec.target ?? Math.floor((Math.min(...values) + Math.max(...values)) / 2))
      : bubbleSortSteps(values));

  const states: number[][] = [];
  const orders: number[][] = [];
  let prevState = [...values];
  let prevOrder = values.map((_, i) => i);
  for (const s of steps) {
    if (s.state && s.state.length === n) prevState = [...s.state];
    if (s.order && s.order.length === n) prevOrder = [...s.order];
    states.push([...prevState]);
    orders.push([...prevOrder]);
  }
  const K = steps.length;
  const T = K * STEP_DUR;

  const doc = new SvgDoc({ theme, w, h });

  doc.add(textEl(40, 46, spec.title ?? "Algorithm animation", { size: 24, weight: 700, fill: theme.fg }));
  doc.add(textEl(40, 70, spec.subtitle ?? `${kind === "cells" ? "cell" : "bar"} visualization · ${K} steps`, { size: 13, fill: theme.muted }));

  const marginX = 90;
  const slotW = (w - 2 * marginX) / n;
  const barW = slotW * 0.78;
  const baseY = 596;
  const maxBarH = 396;
  const minBarH = 10;
  const allV = states.flat();
  const maxV = Math.max(...allV);
  const minV = Math.min(...allV);
  const barH = (v: number): number =>
    minBarH + (maxV === minV ? maxBarH : ((v - minV) / (maxV - minV)) * maxBarH);

  // --- fixed layers: index labels, gridline ---
  doc.add(`<g>${reveal(0.05)}`);
  doc.add(rect(marginX, 130, w - 2 * marginX, baseY - 130, { fill: "none", stroke: theme.border, sw: 1, rx: 12 }));
  for (let i = 0; i < n; i++) {
    doc.add(textEl(marginX + i * slotW + slotW / 2, baseY + 24, String(i), { size: 11, fill: theme.muted, anchor: "middle", mono: true }));
  }
  doc.add("</g>");

  // --- pointers (per-step, fade in their window) ---
  const pointerParts: string[] = [];
  const ptrY = kind === "bars" ? baseY - maxBarH - 22 : 240;
  steps.forEach((s, k) => {
    for (const p of s.pointers ?? []) {
      const idx = Math.max(0, Math.min(n - 1, p.index));
      const x = marginX + idx * slotW + slotW / 2;
      pointerParts.push(`<g>${stepWindow(STEP_DUR, k, K)}`);
      pointerParts.push(`<path d="M ${x - 8} ${ptrY} L ${x + 8} ${ptrY} L ${x} ${ptrY - 14} Z" fill="${p.color}"/>`);
      if (p.label) pointerParts.push(textEl(x, ptrY - 20, p.label, { size: 11, weight: 700, fill: p.color, anchor: "middle", mono: true }));
      pointerParts.push("</g>");
    }
  });
  doc.add(pointerParts.join(""));

  if (kind === "cells") {
    const cellY = 300;
    const cellH = 96;
    const cellW = barW;
    for (let i = 0; i < n; i++) {
      const x = marginX + i * slotW + (slotW - cellW) / 2;
      const fills: string[] = [];
      const strokes: string[] = [];
      const texts: string[] = [];
      for (let k = 0; k < K; k++) {
        const pos = orders[k][i];
        const s = steps[k];
        const hot = s.done?.includes(pos) || s.compare?.includes(pos) || s.focus?.includes(pos);
        const c = hot ? posColor(steps, k, i) : baseColor(i);
        fills.push(hot ? c : theme.bg);
        strokes.push(hot ? c : baseColor(i));
        texts.push(hot ? "#ffffff" : theme.fg);
      }
      doc.add(`<g>${reveal(0.15 + i * 0.03)}`);
      doc.add(`<rect x="${x}" y="${cellY}" width="${cellW}" height="${cellH}" rx="10" stroke-width="2">`);
      doc.add(tween("fill", fills, T));
      doc.add(tween("stroke", strokes, T));
      doc.add(easedTransform(orders.map((o) => (o[i] - i) * slotW), T));
      doc.add("</rect>");
      doc.add(`<text x="${x + cellW / 2}" y="${cellY + cellH / 2 + 5}" text-anchor="middle" font-size="${n > 12 ? 12 : 16}" font-weight="700" font-family="monospace" paint-order="stroke" stroke="${theme.fg}" stroke-width="1.5">`);
      doc.add(tween("fill", texts, T));
      doc.add(`${esc(states[0][i])}</text>`);
      doc.add("</g>");
    }
  } else {
    for (let i = 0; i < n; i++) {
      const v = values[i];
      const hh = barH(v);
      const x = marginX + i * slotW + (slotW - barW) / 2;
      const y = baseY - hh;
      const fills: string[] = [];
      for (let k = 0; k < K; k++) fills.push(posColor(steps, k, i));
      const dxs = orders.map((o) => (o[i] - i) * slotW);
      const labelInside = hh >= 34;
      doc.add(`<g>${reveal(0.15 + i * 0.03)}`);
      doc.add(`<g>`);
      doc.add(easedTransform(dxs, T));
      doc.add(`<rect x="${x}" y="${y}" width="${barW}" height="${hh}" rx="6">`);
      doc.add(tween("fill", fills, T));
      doc.add("</rect>");
      doc.add(`<text x="${x + barW / 2}" y="${labelInside ? y + hh / 2 + 4 : y - 8}" text-anchor="middle" font-size="${n > 12 ? 11 : 13}" font-weight="700" font-family="monospace" fill="#ffffff" paint-order="stroke" stroke="#0b1220" stroke-width="2">`);
      doc.add(`${esc(v)}</text>`);
      doc.add("</g>");
      doc.add("</g>");
    }
  }

  // --- captions per step ---
  const capY = h - 44;
  for (let k = 0; k < K; k++) {
    doc.add(`<g>${stepWindow(STEP_DUR, k, K)}`);
    doc.add(textEl(w / 2, capY, `${k + 1} / ${K} · ${steps[k].label ?? ""}`, { size: 14, weight: 600, fill: theme.fg, anchor: "middle" }));
    doc.add("</g>");
  }

  // --- legend (colors used) ---
  const legendChips: Array<[string, string]> = [];
  if (steps.some((s) => s.compare && !s.swap)) legendChips.push([COMPARE, "compare"]);
  if (steps.some((s) => s.swap)) legendChips.push([SWAP, "swap"]);
  if (steps.some((s) => s.done?.length)) legendChips.push([DONE, "sorted"]);
  if (steps.some((s) => s.focus?.length)) legendChips.push([FOCUS, "focus"]);
  let lx = w - 40;
  for (const [c, label] of legendChips.slice().reverse()) {
    const wd = label.length * 6.4 + 26;
    lx -= wd;
    doc.add(circle(lx + 5, h - 24, 4, { fill: c }));
    doc.add(textEl(lx + 14, h - 21, label, { size: 11, fill: theme.muted }));
  }

  return doc.toString();
}
