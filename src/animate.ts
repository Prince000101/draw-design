import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AnimateOpts, FlowNode, FlowStep } from "./types.js";

const PALETTE = [
  "#334155",
  "#2563eb",
  "#dc2626",
  "#059669",
  "#9333ea",
  "#d97706",
  "#0e7490",
];

function colorOf(step: FlowStep, i: number): string {
  return step.color ?? PALETTE[i % PALETTE.length];
}

function nodeColor(node: FlowNode): string {
  return node.color ?? "#334155";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markerId(color: string): string {
  return `ddA${color.replace("#", "").replace(/[^a-zA-Z0-9]/g, "")}`;
}

/**
 * Build a self-playing animated SVG: nodes on a horizontal lifeline,
 * packets travelling between them via SMIL <animateMotion>, and a CSS
 * pulse on every node. Deterministic on the SVG timeline so it can be
 * recorded to GIF/MP4 frame-by-frame with setCurrentTime().
 */
export function animateDataflow(
  nodes: FlowNode[],
  steps: FlowStep[],
  opts: AnimateOpts = {},
): string {
  if (nodes.length < 2) {
    throw new Error("animateDataflow needs at least 2 nodes");
  }
  if (steps.length === 0) {
    throw new Error("animateDataflow needs at least 1 step");
  }

  const W = opts.width ?? 1080;
  const margin = opts.margin ?? 90;
  const boxW = 150;
  const boxH = 56;
  const boxY = 66;
  const title = opts.title ?? "Data flow";
  const laneBaseY = 170;
  const laneStepY = 66;
  const laneCount = Math.max(
    1,
    ...steps.map((s, i) => (s.lane ?? i) + 1),
  );
  const H = Math.max(opts.height ?? 0, laneBaseY + laneCount * laneStepY + 40);
  const fps = opts.fps ?? 15;

  const cx = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    const x =
      nodes.length === 1
        ? W / 2
        : margin + (i * (W - 2 * margin)) / (nodes.length - 1);
    cx.set(nodes[i].id, x);
  }

  const laneY = (lane: number) => laneBaseY + lane * laneStepY;

  const markers = new Set<string>();
  for (let i = 0; i < steps.length; i++) markers.add(markerId(colorOf(steps[i], i)));

  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  parts.push(`<style>
  @keyframes ddPulse { 0%,100% { opacity: 0.12 } 50% { opacity: 1 } }
  .dd-pulse { animation: ddPulse 1.6s ease-in-out infinite; }
  text { font-family: Helvetica, Arial, sans-serif; }
</style>`);

  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(`<text x="${margin}" y="40" font-size="22" font-weight="bold" fill="#0f172a">${escapeXml(title)}</text>`);

  for (const id of markers) {
    const color = `#${id.slice(3)}`;
    parts.push(
      `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
        `<path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`,
    );
  }

  // lifelines
  for (const node of nodes) {
    const x = cx.get(node.id)!;
    parts.push(
      `<line x1="${x}" y1="${boxY + boxH + 24}" x2="${x}" y2="${H - 24}" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"/>`,
    );
  }

  // node boxes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const x = cx.get(node.id)!;
    const c = nodeColor(node);
    parts.push(
      `<g>` +
        `<rect x="${x - boxW / 2}" y="${boxY}" width="${boxW}" height="${boxH}" rx="10" fill="#ffffff" stroke="${c}" stroke-width="2"/>` +
        `<text x="${x}" y="${boxY + 24}" text-anchor="middle" font-size="14" font-weight="bold" fill="${c}">${escapeXml(node.label)}</text>` +
        (node.sub
          ? `<text x="${x}" y="${boxY + 43}" text-anchor="middle" font-size="10" fill="#475569">${escapeXml(node.sub)}</text>`
          : "") +
        `<circle cx="${x + boxW / 2 - 10}" cy="${boxY + 14}" r="4" fill="${c}" class="dd-pulse" style="animation-delay:${i * 0.45}s"/>` +
        `</g>`,
    );
  }

  // steps: arrow + label + travelling packet
  steps.forEach((step, i) => {
    const x1 = cx.get(step.from)!;
    const x2 = cx.get(step.to)!;
    const lane = step.lane ?? i;
    const y = laneY(lane);
    const c = colorOf(step, i);
    const dir = x2 >= x1 ? 1 : -1;
    const a1 = x1 + dir * (boxW / 2 + 14);
    const a2 = x2 - dir * (boxW / 2 + 14);
    const dur = step.dur ?? 2.4;
    const begin = 0.6 + lane * 0.55;
    const mid = (a1 + a2) / 2;

    parts.push(
      `<line x1="${a1}" y1="${y}" x2="${a2}" y2="${y}" stroke="${c}" stroke-width="2" marker-end="url(#${markerId(c)})"/>`,
      `<text x="${mid}" y="${y - 10}" text-anchor="middle" font-size="12" font-weight="bold" fill="${c}">${escapeXml(step.label)}</text>`,
      `<circle class="dd-packet" r="6" fill="${c}" stroke="#ffffff" stroke-width="1.5">` +
        `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="M ${a1},${y} L ${a2},${y}"/>` +
        `</circle>`,
    );
  });

  parts.push(`</svg>`);
  return parts.join("\n");
}

export function writeAnimatedSvg(
  nodes: FlowNode[],
  steps: FlowStep[],
  outDir: string,
  name = "data-flow-animated",
  opts: AnimateOpts = {},
): string {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const svg = animateDataflow(nodes, steps, opts);
  const out = join(dir, `${name}.svg`);
  writeFileSync(out, svg, "utf8");
  return out;
}

/** The pocketwire-style demo flow used by `demo` and the examples. */
export function defaultFlow() {
  const nodes: FlowNode[] = [
    { id: "phone", label: "Phone", sub: "PWA + APK", color: "#2563eb" },
    { id: "relay", label: "Relay", sub: "server + core", color: "#059669" },
    { id: "adapter", label: "Adapter", sub: "opencode ×N", color: "#0e7490" },
    { id: "agent", label: "Agent", sub: "opencode serve", color: "#475569" },
  ];
  const steps: FlowStep[] = [
    { from: "phone", to: "relay", label: "1 · POST /api/prompt", color: "#334155" },
    { from: "relay", to: "adapter", label: "2 · dequeue instruction", color: "#334155" },
    { from: "adapter", to: "agent", label: "3 · prompt_async", color: "#334155" },
    { from: "agent", to: "adapter", label: "4 · SSE events", color: "#2563eb", lane: 3 },
    { from: "adapter", to: "relay", label: "5 · normalize feed item", color: "#2563eb", lane: 4 },
    { from: "relay", to: "phone", label: "6 · SSE to chat", color: "#2563eb", lane: 5 },
    { from: "agent", to: "adapter", label: "7 · permission.request", color: "#dc2626", lane: 6 },
    { from: "adapter", to: "relay", label: "8 · approval.request", color: "#dc2626", lane: 7 },
    { from: "relay", to: "phone", label: "9 · approval sheet", color: "#dc2626", lane: 8 },
    { from: "phone", to: "relay", label: "10 · allow", color: "#059669", lane: 9 },
    { from: "relay", to: "adapter", label: "11 · forward decision", color: "#059669", lane: 10 },
    { from: "adapter", to: "agent", label: "12 · permissions allow", color: "#059669", lane: 11 },
  ];
  return { nodes, steps };
}
