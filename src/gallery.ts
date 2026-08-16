import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Build a self-contained gallery.html that embeds every generated
 * diagram (SVG/PNG/GIF/MP4) in a directory for quick visual review.
 */
export function buildGallery(outDir: string, name = "gallery"): string {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const files = readdirSync(dir)
    .filter((f) => /\.(svg|png|gif|mp4)$/i.test(f))
    .sort();

  const items = files
    .map((f) => {
      const ext = f.split(".").pop()!.toLowerCase();
      if (ext === "mp4") {
        return `<figure><video src="${f}" muted loop autoplay controls style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px"></video><figcaption>${f}</figcaption></figure>`;
      }
      if (ext === "gif" || ext === "png" || ext === "svg") {
        return `<figure><img src="${f}" alt="${f}" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px"></figure><figcaption>${f}</figcaption>`;
      }
      return "";
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>draw-design — gallery</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
  h1 { margin: 0 0 4px; }
  p.sub { color: #64748b; margin: 0 0 24px; }
  figure { margin: 0 0 32px; }
  figcaption { font-size: 13px; color: #64748b; margin-top: 6px; font-family: monospace; }
</style>
</head>
<body>
<h1>draw-design — gallery</h1>
<p class="sub">${files.length} file(s) in ${dir}</p>
${items}
</body>
</html>`;

  const out = join(dir, `${name}.html`);
  writeFileSync(out, html, "utf8");
  return out;
}
