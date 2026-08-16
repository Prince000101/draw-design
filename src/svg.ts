import type { Theme } from "./theme.js";

export const FONT =
  'Inter, "SF Pro Text", "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';
export const MONO =
  '"SF Mono", ui-monospace, "Cascadia Code", Menlo, Consolas, "Liberation Mono", monospace';

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function wrapLines(s: string, maxChars: number, maxLines = 2): string[] {
  const words = String(s).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cand.length <= maxChars) {
      cur = cand;
    } else {
      if (cur) lines.push(cur);
      if (lines.length >= maxLines) break;
      cur = w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === 0 && s !== "") lines.push(String(s));
  if (lines.length === 0) lines.push("");
  return lines;
}

export interface Canvas {
  w: number;
  h: number;
}

/** Preset aspect ratios. Every generator defaults to a consistent 16:9 canvas. */
export const ASPECTS: Record<string, [number, number]> = {
  "16:9": [1280, 720],
  "4:3": [960, 720],
  "3:2": [1080, 720],
  "16:10": [1152, 720],
  square: [720, 720],
};

export function canvasFor(aspect?: string, width?: number, height?: number): Canvas {
  if (width && height) return { w: width, h: height };
  const [bw, bh] = (aspect && ASPECTS[aspect]) || ASPECTS["16:9"];
  if (width) return { w: width, h: Math.round((width * bh) / bw) };
  if (height) return { w: Math.round((height * bw) / bh), h: height };
  return { w: bw, h: bh };
}

let seq = 0;
export function uid(prefix = "dd"): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export interface DocOpts {
  theme: Theme;
  w: number;
  h: number;
}

/**
 * A small SVG document builder: owns the canvas background, the shadow
 * filter and per-color arrow markers, and assembles the final markup so
 * generators stay declarative and collision-free.
 */
export class SvgDoc {
  readonly theme: Theme;
  readonly w: number;
  readonly h: number;
  private readonly uid: string;
  private defs: string[] = [];
  private parts: string[] = [];
  private markers = new Set<string>();

  constructor(opts: DocOpts) {
    this.theme = opts.theme;
    this.w = opts.w;
    this.h = opts.h;
    this.uid = uid("dd");
  }

  get shadowId(): string {
    return `${this.uid}-sh`;
  }

  get dotId(): string {
    return `${this.uid}-dots`;
  }

  private addShadow(): void {
    if (!this.defs.some((d) => d.includes(`id="${this.shadowId}"`))) {
      this.defs.push(
        `<filter id="${this.shadowId}" x="-40%" y="-40%" width="180%" height="180%">` +
          `<feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="${this.theme.shadow}"/></filter>`,
      );
    }
  }

  private addDots(): void {
    if (!this.defs.some((d) => d.includes(`id="${this.dotId}"`))) {
      this.defs.push(
        `<pattern id="${this.dotId}" width="24" height="24" patternUnits="userSpaceOnUse">` +
          `<circle cx="1" cy="1" r="1" fill="${this.theme.dot}"/></pattern>`,
      );
    }
  }

  /** Register (once) an arrowhead marker for the given stroke color. */
  marker(color: string): string {
    const key = color.toLowerCase();
    const id = `${this.uid}-m${key.replace(/[^a-z0-9]/g, "")}`;
    if (!this.markers.has(key)) {
      this.markers.add(key);
      this.defs.push(
        `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">` +
          `<path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`,
      );
    }
    return id;
  }

  add(s: string): this {
    this.parts.push(s);
    return this;
  }

  open(): string {
    this.addShadow();
    this.addDots();
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}">` +
      `<style>text { font-family: ${FONT}; } .m { font-family: ${MONO}; }</style>` +
      `<defs>${this.defs.join("")}</defs>` +
      `<rect x="0" y="0" width="${this.w}" height="${this.h}" fill="${this.theme.canvas}"/>` +
      `<rect x="0" y="0" width="${this.w}" height="${this.h}" fill="url(#${this.dotId})"/>`
    );
  }

  toString(): string {
    return this.open() + "\n" + this.parts.join("\n") + "\n</svg>";
  }
}

export interface ShapeOpts {
  fill?: string;
  stroke?: string;
  sw?: number;
  rx?: number;
  dash?: string;
  filter?: string;
  opacity?: number;
}

export function rect(x: number, y: number, w: number, h: number, o: ShapeOpts = {}): string {
  const a = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${w}"`,
    `height="${h}"`,
    o.rx ? `rx="${o.rx}"` : "",
    o.fill ? `fill="${o.fill}"` : 'fill="none"',
    o.stroke ? `stroke="${o.stroke}"` : "",
    o.sw ? `stroke-width="${o.sw}"` : "",
    o.dash ? `stroke-dasharray="${o.dash}"` : "",
    o.filter ? `filter="url(#${o.filter})"` : "",
    o.opacity !== undefined ? `opacity="${o.opacity}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<rect ${a}/>`;
}

export function circle(
  cx: number,
  cy: number,
  r: number,
  o: { fill?: string; stroke?: string; sw?: number } = {},
): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}"${o.fill ? ` fill="${o.fill}"` : ""}${
    o.stroke ? ` stroke="${o.stroke}"` : ""
  }${o.sw ? ` stroke-width="${o.sw}"` : ""}/>`;
}

export interface TextOpts {
  size?: number;
  weight?: number | string;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  mono?: boolean;
  opacity?: number;
  letterSpacing?: number;
  italic?: boolean;
  dy?: number;
}

export function textEl(x: number, y: number, s: string, o: TextOpts = {}): string {
  const a = [
    `x="${x}"`,
    `y="${y}"`,
    o.anchor ? `text-anchor="${o.anchor}"` : "",
    o.size ? `font-size="${o.size}"` : "",
    o.weight ? `font-weight="${o.weight}"` : "",
    o.fill ? `fill="${o.fill}"` : "",
    o.mono ? 'class="m"' : "",
    o.opacity !== undefined ? `opacity="${o.opacity}"` : "",
    o.letterSpacing !== undefined ? `letter-spacing="${o.letterSpacing}"` : "",
    o.italic ? 'font-style="italic"' : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<text ${a}>${esc(s)}</text>`;
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  sw = 2,
  dash?: string,
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${
    dash ? ` stroke-dasharray="${dash}"` : ""
  }/>`;
}

export function path(d: string, o: { stroke: string; sw?: number; fill?: string; dash?: string; marker?: string }): string {
  return `<path d="${d}" fill="${o.fill ?? "none"}" stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"${
    o.dash ? ` stroke-dasharray="${o.dash}"` : ""
  }${o.marker ? ` marker-end="url(#${o.marker})"` : ""}/>`;
}

/** Deterministic SMIL fade-in (drives both recording and static PNG capture). */
export function reveal(beginS: number, dur = 0.55): string {
  return `<animate attributeName="opacity" from="0" to="1" begin="${beginS.toFixed(2)}s" dur="${dur}s" fill="freeze"/>`;
}

/** SMIL discrete attribute animation across timeline values (steps). */
export function discrete(
  attribute: string,
  values: string[],
  dur: number,
  begin = 0,
): string {
  return `<animate attributeName="${attribute}" values="${values.join(";")}" dur="${dur}s" begin="${begin}s" calcMode="discrete" repeatCount="indefinite"/>`;
}

/** SMIL linear attribute animation across timeline values (steps). */
export function tween(
  attribute: string,
  values: string[],
  dur: number,
  begin = 0,
): string {
  return `<animate attributeName="${attribute}" values="${values.join(";")}" dur="${dur}s" begin="${begin}s" calcMode="linear" repeatCount="indefinite"/>`;
}

/** Step-window fade for captions/pointers: visible mid-step, looping. */
export function stepFade(stepDur: number, beginS: number): string {
  return `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.14;0.86;1" dur="${stepDur}s" begin="${beginS.toFixed(2)}s" repeatCount="indefinite"/>`;
}
