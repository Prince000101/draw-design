export type Engine = "graphviz" | "d2";
export type ImageFormat = "svg" | "png";
export type VideoFormat = "gif" | "mp4";

export interface EngineInfo {
  engine: string;
  available: boolean;
  binary?: string;
  version?: string;
  note?: string;
}

export interface FlowNode {
  id: string;
  label: string;
  sub?: string;
  color?: string;
}

export interface FlowStep {
  from: string;
  to: string;
  label: string;
  color?: string;
  dur?: number;
  lane?: number;
}

export interface AnimateOpts {
  width?: number;
  height?: number;
  title?: string;
  margin?: number;
  fps?: number;
}

export interface RecordOpts {
  fps?: number;
  seconds?: number;
  format?: VideoFormat;
  loop?: boolean;
}

export interface RenderResult {
  ok: boolean;
  path: string;
  format: ImageFormat;
  engine: Engine;
}

export interface AnimateResult {
  ok: boolean;
  svgPath: string;
  gifPath?: string;
  videoPath?: string;
  nodes: number;
  steps: number;
}

export interface RecordResult {
  ok: boolean;
  path: string;
  frames: number;
  fps: number;
  seconds: number;
  format: VideoFormat;
}
