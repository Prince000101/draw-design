import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Item {
  file: string;
  ext: string;
  kb: number;
}

/**
 * Build a self-contained gallery.html that embeds every generated
 * diagram (SVG/PNG/GIF/MP4) in a directory with filters and a
 * light/dark toggle for quick visual review.
 */
export function buildGallery(outDir: string, name = "gallery"): string {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const files: Item[] = readdirSync(dir)
    .filter((f) => /\.(svg|png|gif|mp4)$/i.test(f) && !f.startsWith("."))
    .sort()
    .map((f) => {
      const ext = f.split(".").pop()!.toLowerCase();
      let kb = 0;
      try {
        kb = Math.round(statSync(join(dir, f)).size / 1024);
      } catch {
        /* ignore */
      }
      return { file: f, ext, kb };
    });

  const cards = files
    .map((it) => {
      const { file, ext, kb } = it;
      const badge = ext.toUpperCase();
      const group = ext === "svg" || ext === "png" ? "static" : "anim";
      const media =
        ext === "mp4"
          ? `<video src="${file}" muted loop autoplay controls></video>`
          : `<img src="${file}" alt="${file}" loading="lazy">`;
      return `<figure class="card" data-group="${group}" data-ext="${ext}">
        <div class="frame">${media}</div>
        <figcaption>
          <span class="name" title="${file}">${file}</span>
          <span class="meta"><span class="badge ${ext}">${badge}</span><span class="kb">${kb} KB</span></span>
        </figcaption>
      </figure>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>draw-design — gallery</title>
<style>
  :root { --bg:#f5f7fb; --card:#ffffff; --fg:#0f172a; --muted:#64748b; --border:#e2e8f0; --chip:#eef2f8; }
  html[data-theme="dark"] { --bg:#0c1322; --card:#101b2e; --fg:#e8eef7; --muted:#8fa2bd; --border:#263650; --chip:#1b2942; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:Inter,"SF Pro Text","Segoe UI",system-ui,sans-serif; transition:background .2s,color .2s; }
  header { padding:28px 32px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  h1 { margin:0; font-size:22px; letter-spacing:-.02em; }
  p.sub { margin:6px 0 0; color:var(--muted); font-size:13px; }
  .tools { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .filters { display:flex; gap:6px; margin-top:18px; padding:0 32px; flex-wrap:wrap; }
  .filters button, .tools button { border:1px solid var(--border); background:var(--card); color:var(--fg); border-radius:999px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
  .filters button.active { background:#6366f1; border-color:#6366f1; color:#fff; }
  .filters button:hover, .tools button:hover { border-color:#6366f1; }
  main { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:20px; padding:24px 32px 48px; }
  .card { margin:0; background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; transition:transform .15s, box-shadow .15s; }
  .card:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(15,23,42,.12); }
  .frame { background:repeating-conic-gradient(var(--chip) 0 25%, transparent 0 50%) 0 0/16px 16px; aspect-ratio:16/9; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .frame img, .frame video { width:100%; height:100%; object-fit:contain; background:var(--card); }
  figcaption { padding:10px 12px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .name { font-size:12.5px; font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace; color:var(--fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .meta { display:flex; align-items:center; gap:8px; flex:none; }
  .badge { font-size:10px; font-weight:700; padding:2px 7px; border-radius:6px; color:#fff; }
  .badge.svg { background:#0891b2; } .badge.png { background:#7c3aed; }
  .badge.gif { background:#db2777; } .badge.mp4 { background:#2563eb; }
  .kb { font-size:11px; color:var(--muted); }
  .empty { padding:60px 32px; text-align:center; color:var(--muted); grid-column:1/-1; }
  @media (max-width:640px){ header{padding:20px 16px 0;} .filters{padding:14px 16px;} main{padding:16px;} }
</style>
</head>
<body>
<header>
  <div>
    <h1>draw-design — gallery</h1>
    <p class="sub">${files.length} file(s) in ${dir}</p>
  </div>
  <div class="tools">
    <button id="themeBtn" type="button">Toggle dark</button>
  </div>
</header>
<nav class="filters">
  <button data-filter="all" class="active" type="button">All</button>
  <button data-filter="static" type="button">Diagrams</button>
  <button data-filter="anim" type="button">Animations</button>
</nav>
<main id="grid">
${cards || `<div class="empty">No SVG / PNG / GIF / MP4 files here yet. Run <code>npm run diagram -- demo</code>.</div>`}
</main>
<script>
  const grid = document.getElementById('grid');
  document.querySelectorAll('.filters button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.filters button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const f = b.dataset.filter;
      grid.querySelectorAll('.card').forEach((c) => {
        c.style.display = f === 'all' || c.dataset.group === f ? '' : 'none';
      });
    });
  });
  const themeBtn = document.getElementById('themeBtn');
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    themeBtn.textContent = next === 'dark' ? 'Toggle light' : 'Toggle dark';
  });
</script>
</body>
</html>`;

  const out = join(dir, `${name}.html`);
  writeFileSync(out, html, "utf8");
  return out;
}
