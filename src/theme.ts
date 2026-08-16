export type ThemeName = "light" | "dark";

export interface Theme {
  name: ThemeName;
  canvas: string;
  bg: string;
  fg: string;
  muted: string;
  border: string;
  dot: string;
  shadow: string;
  halo: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    name: "light",
    canvas: "#f5f7fb",
    bg: "#ffffff",
    fg: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    dot: "#d8e1ee",
    shadow: "rgba(15,23,42,0.16)",
    halo: "rgba(255,255,255,0.94)",
  },
  dark: {
    name: "dark",
    canvas: "#0c1322",
    bg: "#101b2e",
    fg: "#e8eef7",
    muted: "#8fa2bd",
    border: "#263650",
    dot: "#1a2840",
    shadow: "rgba(0,0,0,0.55)",
    halo: "rgba(13,21,34,0.92)",
  },
};

export function themeOf(name?: ThemeName): Theme {
  return (name && THEMES[name]) || THEMES.light;
}

/** Multi-series accent palette, works on both light and dark themes. */
export const ACCENT = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#0ea5e9",
  "#84cc16",
  "#ec4899",
];

export type ArchKind = "person" | "system" | "container" | "database" | "queue" | "external";

export const KIND_COLOR: Record<ArchKind, string> = {
  person: "#6366f1",
  system: "#2563eb",
  container: "#0891b2",
  database: "#7c3aed",
  queue: "#db2777",
  external: "#64748b",
};

export const KIND_LABEL: Record<ArchKind, string> = {
  person: "Person",
  system: "Software system",
  container: "Container",
  database: "Database",
  queue: "Message queue",
  external: "External system",
};
