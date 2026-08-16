import { SvgDoc, canvasFor, circle, rect, textEl, path, line, reveal, wrapLines, esc, truncate } from "./svg.js";
import { KIND_COLOR, KIND_LABEL, themeOf } from "./theme.js";
import type { ArchKind, Theme, ThemeName } from "./theme.js";

export interface ArchNode {
  id: string;
  name: string;
  kind?: ArchKind;
  desc?: string;
  tech?: string;
  color?: string;
  containers?: ArchNode[];
}

export interface ArchEdge {
  from: string;
  to: string;
  label?: string;
  tech?: string;
  color?: string;
}

export interface ArchModel {
  title?: string;
  subtitle?: string;
  theme?: ThemeName;
  level?: "context" | "container";
  systems: ArchNode[];
  edges: ArchEdge[];
}

export interface ArchOpts {
  theme?: ThemeName;
  aspect?: string;
  width?: number;
  height?: number;
  level?: "context" | "container";
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function layout(
  model: ArchModel,
  w: number,
  h: number,
): { boxes: Map<string, Box>; primary: ArchNode | undefined; persons: ArchNode[]; externals: ArchNode[] } {
  const persons: ArchNode[] = [];
  const externals: ArchNode[] = [];
  let primary: ArchNode | undefined;
  for (const s of model.systems) {
    if (s.kind === "person") persons.push(s);
    else if (s.kind === "system" || s.kind === "container") {
      if (!primary) primary = s;
      else externals.push(s);
    } else externals.push(s);
  }
  if (!primary) primary = externals.shift();

  const boxes = new Map<string, Box>();
  if (primary) {
    const isContainer = !!primary.containers?.length;
    if (isContainer) {
      const cols = 2;
      const cw = 270;
      const ch2 = 96;
      const gapX = 22;
      const gapY = 20;
      const rows = Math.ceil((primary.containers?.length ?? 0) / cols);
      const needH = 76 + rows * (ch2 + gapY) + 26;
      const pw = 648;
      const ph = Math.max(250, needH);
      const pb = { x: w / 2 - pw / 2, y: h / 2 - ph / 2, w: pw, h: ph };
      boxes.set(primary.id, pb);
      primary.containers!.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        boxes.set(c.id, {
          x: pb.x + 26 + col * (cw + gapX),
          y: pb.y + 66 + row * (ch2 + gapY),
          w: cw,
          h: ch2,
        });
      });
    } else {
      boxes.set(primary.id, { x: w / 2 - 195, y: h / 2 - 112, w: 390, h: 224 });
    }
  }

  const colW = 216;
  const colH = 118;
  const step = 142;
  persons.forEach((n, i) => {
    const y = h / 2 - ((persons.length - 1) * step) / 2 + i * step;
    boxes.set(n.id, { x: 48, y, w: colW, h: colH });
  });
  externals.forEach((n, i) => {
    const y = h / 2 - ((externals.length - 1) * step) / 2 + i * step;
    boxes.set(n.id, { x: w - 48 - colW, y, w: colW, h: colH });
  });

  return { boxes, primary, persons, externals };
}

function edgeLabel(
  doc: SvgDoc,
  mx: number,
  my: number,
  label: string | undefined,
  tech: string | undefined,
  theme: Theme,
  color: string,
): void {
  if (!label && !tech) return;
  const lw = label ? label.length : 0;
  const tw = tech ? tech.length : 0;
  const bw = Math.max(lw, tw) * 6.3 + 22;
  const bh = label && tech ? 36 : 23;
  doc.add(rect(mx - bw / 2, my - bh / 2, bw, bh, { fill: theme.halo, stroke: theme.border, rx: 8 }));
  if (label) doc.add(textEl(mx, my - (tech ? 5 : 0), label, { size: 11, weight: 700, fill: color, anchor: "middle" }));
  if (tech) doc.add(textEl(mx, my + (label ? 13 : 0), tech, { size: 9.5, fill: theme.muted, anchor: "middle", mono: true }));
}

function drawEdge(doc: SvgDoc, boxes: Map<string, Box>, e: ArchEdge, theme: Theme): void {
  const a = boxes.get(e.from);
  const b = boxes.get(e.to);
  if (!a || !b) return;
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const fromLeft = bx < ax;
  const sx = fromLeft ? a.x : a.x + a.w;
  const tx = fromLeft ? b.x + b.w : b.x;
  const sy = clamp(ay, a.y + 16, a.y + a.h - 16);
  const ty = clamp(by, b.y + 16, b.y + b.h - 16);
  const color = e.color ?? "#94a3b8";
  doc.add(path(`M ${sx} ${sy} L ${tx} ${ty}`, { stroke: color, sw: 2, marker: doc.marker(color) }));
  edgeLabel(doc, (sx + tx) / 2, (sy + ty) / 2, e.label, e.tech, theme, color);
}

function personGlyph(doc: SvgDoc, cx: number, cy: number, c: string): void {
  doc.add(circle(cx, cy - 9, 8, { fill: c }));
  doc.add(rect(cx - 10, cy + 2, 20, 10, { fill: c, rx: 10 }));
}

function drawNode(
  doc: SvgDoc,
  box: Box,
  node: ArchNode,
  theme: Theme,
  beginS: number,
  inner = false,
): void {
  const c = node.color ?? KIND_COLOR[node.kind ?? "system"];
  const cx = box.x + box.w / 2;
  const fill = theme.bg;
  const rounded = node.kind !== "external" && node.kind !== "database";
  const dash = node.kind === "external" ? "6 5" : undefined;
  const sw = node.kind === "external" ? 1.5 : 2;

  doc.add(`<g>${reveal(beginS)}`);
  doc.add(rect(box.x, box.y, box.w, box.h, { fill, stroke: c, sw, rx: rounded ? 14 : 8, dash, filter: doc.shadowId }));

  if (node.kind === "person") {
    const iy = box.y + box.h / 2;
    personGlyph(doc, box.x + 34, iy, c);
    doc.add(textEl(box.x + 54, iy - 6, truncate(node.name, 20), { size: 14, weight: 700, fill: c }));
    wrapLines(node.desc ?? "", 24).slice(0, 2).forEach((ln, i) => {
      doc.add(textEl(box.x + 54, iy + 12 + i * 15, truncate(ln, 22), { size: 10.5, fill: theme.muted }));
    });
  } else if (node.kind === "database") {
    const cyTop = box.y + 22;
    const cyBot = box.y + box.h - 22;
    const rx = box.w / 2 - 22;
    doc.add(rect(cx - rx, cyTop, rx * 2, cyBot - cyTop, { fill, stroke: c, sw: 1.5 }));
    doc.add(`<ellipse cx="${cx}" cy="${cyTop}" rx="${rx}" ry="12" fill="${fill}" stroke="${c}" stroke-width="1.5"/>`);
    doc.add(path(`M ${cx - rx} ${cyBot} A ${rx} 12 0 0 0 ${cx + rx} ${cyBot}`, { stroke: c, sw: 1.5 }));
    doc.add(textEl(cx, box.y + 52, truncate(node.name, 24), { size: 13, weight: 700, fill: c, anchor: "middle" }));
    wrapLines(node.desc ?? "", 24).slice(0, 2).forEach((ln, i) => {
      doc.add(textEl(cx, box.y + 70 + i * 14, ln, { size: 10, fill: theme.muted, anchor: "middle" }));
    });
  } else if (node.kind === "queue") {
    doc.add(line(box.x + 16, box.y + 18, box.x + 16, box.y + box.h - 18, c, 2.5));
    doc.add(line(box.x + 24, box.y + 18, box.x + 24, box.y + box.h - 18, c, 2.5));
    doc.add(textEl(cx, box.y + 40, truncate(node.name, 24), { size: 13, weight: 700, fill: c, anchor: "middle" }));
    wrapLines(node.desc ?? "", 26).slice(0, 2).forEach((ln, i) => {
      doc.add(textEl(cx, box.y + 60 + i * 14, ln, { size: 10, fill: theme.muted, anchor: "middle" }));
    });
  } else {
    const titleSize = inner ? 13 : 15;
    doc.add(textEl(cx, box.y + 34, truncate(node.name, 28), { size: titleSize, weight: 700, fill: c, anchor: "middle" }));
    wrapLines(node.desc ?? "", 34).slice(0, 2).forEach((ln, i) => {
      doc.add(textEl(cx, box.y + 56 + i * 15, truncate(ln, 32), { size: 11, fill: theme.muted, anchor: "middle" }));
    });
    if (node.tech) {
      doc.add(textEl(cx, box.y + box.h - 20, truncate(node.tech, 22), { size: 9.5, fill: theme.muted, anchor: "middle", mono: true }));
    }
  }
  doc.add("</g>");
}

function miniShape(doc: SvgDoc, x: number, y: number, kind: ArchKind, c: string): void {
  if (kind === "person") {
    personGlyph(doc, x + 11, y + 9, c);
    return;
  }
  if (kind === "database") {
    doc.add(rect(x, y + 6, 22, 8, { fill: doc.theme.bg, stroke: c, sw: 1.2 }));
    doc.add(`<ellipse cx="${x + 11}" cy="${y + 6}" rx="11" ry="5" fill="${doc.theme.bg}" stroke="${c}" stroke-width="1.2"/>`);
    return;
  }
  if (kind === "queue") {
    doc.add(rect(x, y, 22, 18, { fill: doc.theme.bg, stroke: c, sw: 1.2, rx: 5 }));
    doc.add(line(x + 6, y + 4, x + 6, y + 14, c, 2));
    doc.add(line(x + 11, y + 4, x + 11, y + 14, c, 2));
    return;
  }
  doc.add(rect(x, y, 22, 18, { fill: doc.theme.bg, stroke: c, sw: 1.4, rx: 6, dash: kind === "external" ? "4 3" : undefined }));
}

function legend(doc: SvgDoc, model: ArchModel, theme: Theme): void {
  const kinds = Array.from(
    new Set<ArchKind>(
      model.systems.flatMap((s) => {
        const inner = s.containers?.length ? (["container"] as ArchKind[]) : [];
        return s.kind ? [s.kind, ...inner] : inner.length ? inner : ["system"];
      }),
    ),
  ).slice(0, 6);
  if (kinds.length === 0) return;
  const widths = kinds.map((k) => 30 + KIND_LABEL[k].length * 6.3 + 26);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = (doc.w - total) / 2;
  const y = doc.h - 40;
  doc.add(rect((doc.w - total) / 2 - 14, y - 12, total + 28, 30, { fill: theme.halo, stroke: theme.border, rx: 9 }));
  kinds.forEach((k, i) => {
    const c = KIND_COLOR[k];
    miniShape(doc, x, y, k, c);
    doc.add(textEl(x + 30, y + 13, KIND_LABEL[k], { size: 11, fill: theme.muted }));
    x += widths[i];
  });
}

function header(doc: SvgDoc, model: ArchModel, theme: Theme, level: "context" | "container"): void {
  const title = model.title ?? "System architecture";
  const subtitle = model.subtitle ?? (level === "container" ? "Container view · Level 2" : "System context · Level 1");
  doc.add(textEl(40, 46, title, { size: 24, weight: 700, fill: theme.fg }));
  doc.add(textEl(40, 70, subtitle, { size: 13, fill: theme.muted }));
  doc.add(
    rect(doc.w - 40 - 92, 36, 92, 26, { fill: theme.bg, stroke: theme.border, rx: 13 }),
  );
  doc.add(textEl(doc.w - 40 - 46, 53, level === "container" ? "C4 · L2" : "C4 · L1", { size: 11, weight: 700, fill: theme.muted, anchor: "middle", mono: true }));
}

/** Generate a C4-style architecture diagram (context or container level). */
export function archSvg(model: ArchModel, opts: ArchOpts = {}): string {
  const theme = themeOf(opts.theme ?? model.theme);
  const { w, h } = canvasFor(opts.aspect, opts.width, opts.height);
  const level = opts.level ?? model.level ?? "context";

  const doc = new SvgDoc({ theme, w, h });
  const { boxes, primary } = layout(model, w, h);

  header(doc, model, theme, level);

  for (const e of model.edges) drawEdge(doc, boxes, e, theme);

  const primaryId = primary?.id;
  for (const s of model.systems) {
    const box = boxes.get(s.id);
    if (box && s.id !== primaryId) drawNode(doc, box, s, theme, 0.15 + ((s.kind === "person" ? 0 : 1) * 0.06));
  }
  if (primaryId) {
    const pb = boxes.get(primaryId)!;
    const p = model.systems.find((s) => s.id === primaryId)!;
    if (p.containers?.length) {
      doc.add(`<g>${reveal(0.2)}`);
      doc.add(rect(pb.x, pb.y, pb.w, pb.h, { fill: "none", stroke: KIND_COLOR.system, sw: 2, rx: 18, dash: "8 6" }));
      doc.add(textEl(pb.x + 22, pb.y + 34, esc(p.name), { size: 15, weight: 700, fill: KIND_COLOR.system }));
      doc.add(textEl(pb.x + 22, pb.y + 52, truncate(p.desc ?? "container boundary", 60), { size: 11, fill: theme.muted }));
      doc.add("</g>");
      p.containers.forEach((c, i) => {
        const cb = boxes.get(c.id)!;
        drawNode(doc, cb, c, theme, 0.3 + i * 0.06, true);
      });
    } else {
      drawNode(doc, pb, p, theme, 0.15);
    }
  }

  legend(doc, model, theme);
  return doc.toString();
}

/** Resolve an architecture model from a plain JSON value (tolerant parsing). */
export function normalizeArchModel(model: unknown): ArchModel {
  const m = (model ?? {}) as Record<string, unknown>;
  return {
    title: typeof m.title === "string" ? m.title : undefined,
    subtitle: typeof m.subtitle === "string" ? m.subtitle : undefined,
    theme: m.theme === "dark" ? "dark" : m.theme === "light" ? "light" : undefined,
    level: m.level === "container" ? "container" : "context",
    systems: (Array.isArray(m.systems) ? m.systems : []) as ArchNode[],
    edges: (Array.isArray(m.edges) ? m.edges : []) as ArchEdge[],
  };
}
