import { SvgDoc, canvasFor, circle, rect, textEl, path, reveal, wrapLines, truncate, esc } from "./svg.js";
import { ACCENT, themeOf } from "./theme.js";
import type { ThemeName } from "./theme.js";

export interface MindMapNode {
  id?: string;
  label: string;
  note?: string;
  color?: string;
  children?: MindMapNode[];
}

export interface MindMapOpts {
  theme?: ThemeName;
  aspect?: string;
  width?: number;
  height?: number;
  layout?: "radial" | "tree";
  title?: string;
}

interface FlatNode {
  id: string;
  label: string;
  note?: string;
  depth: number;
  color: string;
  parent?: string;
  children: FlatNode[];
  size: number;
}

function flatten(root: MindMapNode): FlatNode[] {
  let counter = 0;
  const nodes: FlatNode[] = [];
  const visit = (n: MindMapNode, depth: number, color: string, parent?: string): FlatNode => {
    const id = n.id ?? `n${counter++}`;
    const fn: FlatNode = {
      id,
      label: n.label,
      note: n.note,
      depth,
      color: n.color ?? color,
      parent,
      children: [],
      size: 1,
    };
    nodes.push(fn);
    for (const ch of n.children ?? []) {
      fn.children.push(visit(ch, depth + 1, fn.color, id));
      fn.size += fn.children[fn.children.length - 1].size;
    }
    return fn;
  };
  visit(root, 0, ACCENT[0], undefined);
  return nodes;
}

function header(doc: SvgDoc, title: string): void {
  doc.add(textEl(40, 46, title, { size: 22, weight: 700, fill: doc.theme.fg, letterSpacing: 0.2 }));
  doc.add(textEl(40, 70, "concept map", { size: 12.5, fill: doc.theme.muted }));
}

function footer(doc: SvgDoc, nodes: FlatNode[], layout: string): void {
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const leaves = nodes.filter((n) => n.children.length === 0).length;
  doc.add(
    textEl(40, doc.h - 24, `${nodes.length} concepts · ${leaves} leaves · depth ${maxDepth} · ${layout}`, {
      size: 11,
      fill: doc.theme.muted,
      mono: true,
    }),
  );
}

function radial(root: FlatNode, all: FlatNode[], w: number, h: number): Map<string, { x: number; y: number; angle: number }> {
  const cx = w / 2;
  const cy = h / 2;
  const maxDepth = Math.max(...all.map((n) => n.depth));
  const usable = Math.min(h / 2 - 120, w / 2 - 140);
  const step = maxDepth > 0 ? Math.max(66, Math.min(150, usable / maxDepth)) : 0;
  const R0 = 100;

  const positions = new Map<string, { x: number; y: number; angle: number }>();
  const leaves = (n: FlatNode): number => (n.size === 1 ? 1 : n.children.reduce((a, c) => a + leaves(c), 0));
  const total = leaves(root);

  const dfs = (n: FlatNode, startLeaf: number): number => {
    const span = leaves(n);
    const mid = startLeaf + span / 2;
    const angle = -Math.PI / 2 + (mid / total) * 2 * Math.PI;
    const r = n.depth === 0 ? 0 : R0 + (n.depth - 1) * step;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    positions.set(n.id, { x, y, angle });
    let childStart = startLeaf;
    for (const c of n.children) {
      dfs(c, childStart);
      childStart += leaves(c);
    }
    return span;
  };
  dfs(root, 0);
  return positions;
}

function drawRadial(doc: SvgDoc, root: FlatNode, all: FlatNode[], w: number, h: number): void {
  const positions = radial(root, all, w, h);
  const maxDepth = Math.max(...all.map((n) => n.depth));

  const deep = all.filter((n) => n.depth === maxDepth);
  const ringR = deep.length
    ? Math.max(
        120,
        Math.min(
          ...deep.map((n) => Math.hypot((positions.get(n.id)?.x ?? w / 2) - w / 2, (positions.get(n.id)?.y ?? h / 2) - h / 2)),
        ) + 36,
      )
    : 0;
  doc.add(`<g>`);
  for (let d = 1; d <= maxDepth; d++) {
    doc.add(circle(w / 2, h / 2, ringR * (d / maxDepth), { fill: "none", stroke: doc.theme.border, sw: 1 }));
    doc.add(`<animate attributeName="opacity" values="0;1" begin="${0.1 + d * 0.05}s" dur="0.4s" fill="freeze"/>`);
  }
  doc.add("</g>");

  const edgeParts: string[] = [];
  for (const n of all) {
    if (!n.parent) continue;
    const p = positions.get(n.parent)!;
    const c = positions.get(n.id)!;
    const pr = Math.hypot(p.x - w / 2, p.y - h / 2);
    const cr = Math.hypot(c.x - w / 2, c.y - h / 2);
    const ang = (p.angle + c.angle) / 2;
    const rMid = (pr + cr) / 2;
    const qx = w / 2 + Math.cos(ang) * rMid;
    const qy = h / 2 + Math.sin(ang) * rMid;
    edgeParts.push(`<g>${reveal(0.2 + n.depth * 0.05)}`);
    edgeParts.push(
      path(`M ${p.x} ${p.y} Q ${qx} ${qy} ${c.x} ${c.y}`, {
        stroke: n.color,
        sw: 2,
        dash: "none",
      }),
    );
    edgeParts.push(`<animate attributeName="stroke-opacity" values="0;${n.depth === 1 ? 0.7 : 0.4}" begin="${0.2 + n.depth * 0.05}s" dur="0.4s" fill="freeze"/>`);
    edgeParts.push("</g>");
  }
  doc.add(edgeParts.join(""));

  const nodeParts: string[] = [];
  for (const n of all) {
    const pos = positions.get(n.id)!;
    const isRoot = n.depth === 0;
    const leaf = n.children.length === 0;
    const begin = 0.25 + n.depth * 0.06;
    if (isRoot) {
      const bw = Math.max(120, n.label.length * 8.6 + 44);
      nodeParts.push(`<g>${reveal(begin)}`);
      nodeParts.push(rect(pos.x - bw / 2, pos.y - 24, bw, 48, { fill: doc.theme.bg, stroke: n.color, sw: 2, rx: 12, filter: doc.shadowId }));
      nodeParts.push(textEl(pos.x, pos.y + 5, truncate(n.label, 26), { size: 13.5, weight: 700, fill: n.color, anchor: "middle" }));
      nodeParts.push("</g>");
    } else {
      const dir = Math.cos(pos.angle) >= 0 ? 1 : -1;
      const lx = pos.x + dir * 18;
      nodeParts.push(`<g>${reveal(begin)}`);
      nodeParts.push(circle(pos.x, pos.y, leaf ? 5 : 7, { fill: n.color, stroke: doc.theme.bg, sw: 2 }));
      const color = n.depth === 1 ? n.color : leaf ? doc.theme.muted : doc.theme.fg;
      const weight = n.depth === 1 ? 700 : 400;
      const size = n.depth === 1 ? 12.5 : leaf ? 11 : 12;
      nodeParts.push(textEl(lx, pos.y + 4, truncate(n.label, 20), { size, weight, fill: color, anchor: dir > 0 ? "start" : "end" }));
      nodeParts.push("</g>");
    }
  }
  doc.add(nodeParts.join(""));
}

function treeLayout(root: FlatNode, all: FlatNode[], w: number, h: number): Map<string, { x: number; y: number }> {
  const maxDepth = Math.max(...all.map((n) => n.depth));
  const xStep = maxDepth > 0 ? Math.min(300, (w - 360) / maxDepth) : 0;
  const positions = new Map<string, { x: number; y: number }>();
  const leaves = all.filter((n) => n.children.length === 0);
  const slot = leaves.length > 1 ? (h - 280) / (leaves.length - 1) : 0;
  let leafIdx = 0;

  const assignY = (n: FlatNode): number => {
    if (n.children.length === 0) {
      const y = 150 + leafIdx * slot;
      leafIdx += 1;
      positions.set(n.id, { x: 160 + n.depth * xStep, y });
      return y;
    }
    const ys = n.children.map(assignY);
    const y = ys.reduce((a, b) => a + b, 0) / ys.length;
    positions.set(n.id, { x: 160 + n.depth * xStep, y });
    return y;
  };
  assignY(root);
  return positions;
}

function drawTree(doc: SvgDoc, root: FlatNode, all: FlatNode[], w: number, h: number): void {
  const positions = treeLayout(root, all, w, h);
  const bw = 252;
  const bh = 72;

  for (const n of all) {
    if (!n.parent) continue;
    const p = positions.get(n.parent)!;
    const c = positions.get(n.id)!;
    const midX = (p.x + bw + c.x) / 2;
    doc.add(`<g>${reveal(0.2 + n.depth * 0.05)}`);
    doc.add(
      path(`M ${p.x + bw} ${p.y} C ${midX} ${p.y}, ${midX} ${c.y}, ${c.x} ${c.y}`, { stroke: n.color, sw: 2 }),
    );
    doc.add(`<animate attributeName="stroke-opacity" values="0;${n.depth === 1 ? 0.75 : 0.45}" begin="${0.2 + n.depth * 0.05}s" dur="0.4s" fill="freeze"/>`);
    doc.add("</g>");
  }

  for (const n of all) {
    const pos = positions.get(n.id)!;
    const begin = 0.25 + n.depth * 0.06;
    const isRoot = n.depth === 0;
    doc.add(`<g>${reveal(begin)}`);
    doc.add(
      rect(pos.x, pos.y - bh / 2, bw, bh, {
        fill: doc.theme.bg,
        stroke: n.color,
        sw: isRoot ? 2.2 : 1.6,
        rx: 12,
        filter: isRoot ? doc.shadowId : undefined,
      }),
    );
    const lines = wrapLines(n.label, 26, 2);
    const hasNote = !!n.note && lines.length < 2;
    if (hasNote) {
      doc.add(textEl(pos.x + 14, pos.y - 7, truncate(lines[0], 24), { size: 12.5, weight: 700, fill: n.color }));
      doc.add(textEl(pos.x + 14, pos.y + 15, truncate(n.note!, 30), { size: 10, fill: doc.theme.muted }));
    } else {
      doc.add(textEl(pos.x + 14, pos.y + (lines.length === 2 ? -4 : 5), truncate(lines[0], 26), { size: 12.5, weight: 700, fill: n.color }));
      if (lines[1]) doc.add(textEl(pos.x + 14, pos.y + 16, truncate(lines[1], 26), { size: 10, fill: doc.theme.muted }));
    }
    doc.add("</g>");
  }
}

/** Generate a mind map SVG (radial or left-right tree) from a nested model. */
export function mindmapSvg(root: MindMapNode, opts: MindMapOpts = {}): string {
  const theme = themeOf(opts.theme);
  const { w, h } = canvasFor(opts.aspect, opts.width, opts.height);
  const layout = opts.layout ?? "radial";

  const doc = new SvgDoc({ theme, w, h });
  const nodes = flatten(root);
  header(doc, opts.title ?? root.label);
  if (layout === "tree") drawTree(doc, nodes[0], nodes, w, h);
  else drawRadial(doc, nodes[0], nodes, w, h);
  footer(doc, nodes, layout);
  return doc.toString();
}
