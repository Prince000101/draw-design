/**
 * Minimal browser-side types for page.evaluate() callbacks that run inside
 * Chromium. Kept tiny on purpose so the Node project does not pull in lib.dom.
 */

declare const document: {
  querySelector(selectors: string): SVGSVGElement | null;
};

declare interface SVGSVGElement {
  setCurrentTime(seconds: number): void;
  getAttribute(name: string): string | null;
  viewBox: {
    baseVal: { width: number; height: number };
  };
}
