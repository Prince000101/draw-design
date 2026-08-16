import type { ArchModel } from "./architecture.js";
import type { MindMapNode } from "./mindmap.js";
import type { AlgSpec } from "./algorithm.js";

/** The pocketwire-style system context used across the examples. */
export function sampleArchitecture(): ArchModel {
  return {
    title: "pocketwire — system context",
    subtitle: "Prompt a coding agent from your phone",
    theme: "light",
    systems: [
      { id: "user", name: "Mobile user", kind: "person", desc: "sends prompts and approves actions from the phone app" },
      { id: "pocketwire", name: "pocketwire", kind: "system", desc: "relay server, approval queue and device app", tech: "PWA" },
      { id: "adapter", name: "opencode adapter", kind: "external", desc: "MCP bridge managing N agent sessions", tech: "MCP" },
      { id: "agent", name: "opencode", kind: "external", desc: "coding agent runtime with approval gates", tech: "SSE" },
    ],
    edges: [
      { from: "user", to: "pocketwire", label: "prompts & approvals", tech: "HTTPS" },
      { from: "pocketwire", to: "adapter", label: "instructions", tech: "MCP" },
      { from: "adapter", to: "agent", label: "prompt_async", tech: "stdio" },
      { from: "agent", to: "adapter", label: "events", tech: "SSE" },
      { from: "pocketwire", to: "agent", label: "session log", tech: "WS" },
    ],
  };
}

export function sampleContainerArchitecture(): ArchModel {
  return {
    title: "pocketwire — containers",
    subtitle: "Container view · Level 2",
    theme: "light",
    level: "container",
    systems: [
      { id: "user", name: "Mobile user", kind: "person", desc: "phone PWA or APK" },
      {
        id: "pocketwire",
        name: "pocketwire",
        kind: "system",
        desc: "single-tenant relay + device app",
        tech: "Docker",
        containers: [
          { id: "relay", name: "Relay server", kind: "container", desc: "HTTP + SSE core", tech: "Node.js" },
          { id: "queue", name: "Queue", kind: "queue", desc: "instruction backlog", tech: "Redis" },
          { id: "app", name: "Device app", kind: "container", desc: "chat UI + approvals", tech: "React PWA" },
          { id: "core", name: "Core", kind: "container", desc: "approval engine", tech: "TypeScript" },
        ],
      },
      { id: "adapter", name: "opencode adapter", kind: "external", desc: "MCP bridge ×N", tech: "MCP" },
      { id: "agent", name: "opencode", kind: "external", desc: "agent runtime", tech: "SSE" },
    ],
    edges: [
      { from: "user", to: "pocketwire", label: "prompts & approvals", tech: "HTTPS" },
      { from: "pocketwire", to: "adapter", label: "dequeue → instruction", tech: "MCP" },
      { from: "adapter", to: "agent", label: "prompt_async", tech: "stdio" },
      { from: "agent", to: "adapter", label: "events", tech: "SSE" },
      { from: "app", to: "relay", label: "API + SSE", tech: "HTTPS" },
      { from: "relay", to: "queue", label: "enqueue/dequeue", tech: "Redis" },
      { from: "relay", to: "core", label: "approval checks", tech: "IPC" },
    ],
  };
}

/** A radial-friendly nested model for the demo mind map. */
export function sampleMindmap(): MindMapNode {
  return {
    label: "pocketwire",
    children: [
      {
        label: "Mobile app",
        note: "PWA + APK",
        children: [
          { label: "Chat UI", note: "streaming replies" },
          { label: "Approvals", note: "allow / deny" },
          { label: "Push", note: "background events" },
        ],
      },
      {
        label: "Relay server",
        note: "single tenant",
        children: [
          { label: "Queue", note: "Redis backlog" },
          { label: "SSE fan-out", note: "to device" },
        ],
      },
      {
        label: "MCP adapter",
        note: "bridge",
        children: [
          { label: "Sessions", note: "N agents" },
          { label: "Tools", note: "permission hooks" },
        ],
      },
      {
        label: "Agent runtime",
        note: "opencode",
        children: [
          { label: "Prompt loop" },
          { label: "Approval gates" },
        ],
      },
    ],
  };
}

export function sampleSortSpec(): AlgSpec {
  return {
    kind: "bars",
    values: [7, 2, 9, 1, 5, 3, 8, 4, 6],
    title: "Bubble sort",
    subtitle: "bars · compare / swap / sorted",
  };
}

export function sampleSearchSpec(): AlgSpec {
  return {
    kind: "cells",
    values: [1, 3, 5, 7, 9, 11, 13, 15],
    target: 9,
    title: "Binary search",
    subtitle: "cells · lo / mid / hi",
  };
}

export function listTemplates(): Record<string, unknown> {
  return {
    aspects: ["16:9", "4:3", "3:2", "16:10", "square"],
    themes: ["light", "dark"],
    generators: ["generate_architecture", "generate_mindmap", "animate_algorithm"],
    architecture: {
      levels: ["context", "container"],
      kinds: ["person", "system", "container", "database", "queue", "external"],
      examples: ["sampleArchitecture", "sampleContainerArchitecture"],
    },
    mindmap: {
      layouts: ["radial", "tree"],
      examples: ["sampleMindmap"],
    },
    algorithm: {
      kinds: ["bars", "cells"],
      presets: ["bubbleSortSteps", "binarySearchSteps"],
      stepFields: ["state", "compare", "swap", "done", "focus", "pointers", "order", "label"],
      examples: ["sampleSortSpec", "sampleSearchSpec"],
    },
  };
}
