// Build the extension with esbuild.
// Outputs:
//   dist/manifest.json     — copied from public/
//   dist/background.js     — service worker
//   dist/content.js        — content script
//   dist/content.css       — content script styles
//   dist/c2pa_bg.wasm      — C2PA WASM core
//   dist/icons/*.png       — copied from public/

import { build, context } from "esbuild";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(here, "dist");
const isWatch = process.argv.includes("--watch");

async function copyDir(src, dst) {
  await mkdir(dst, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const from = resolve(src, entry.name);
    const to = resolve(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else {
      await copyFile(from, to);
    }
  }
}

async function copyStatic() {
  await copyFile(resolve(here, "public/manifest.json"), resolve(outdir, "manifest.json"));
  await copyFile(resolve(here, "public/content.css"), resolve(outdir, "content.css"));
  await copyDir(resolve(here, "public/icons"), resolve(outdir, "icons"));
  // c2pa-wasm ships the .wasm under pkg/. esbuild's `loader: { '.wasm': 'file' }`
  // emits it next to the JS bundle; we move it into dist/ root for web_accessible_resources.
  const wasmSrc = resolve(
    here,
    "../../node_modules/@contentauth/c2pa-wasm/pkg/c2pa_bg.wasm",
  );
  await copyFile(wasmSrc, resolve(outdir, "c2pa_bg.wasm"));
}

const sharedOptions = {
  bundle: true,
  format: "esm",
  target: "chrome120",
  logLevel: "info",
  loader: { ".wasm": "file" },
};

const entries = {
  background: resolve(here, "src/background.ts"),
  content: resolve(here, "src/content.ts"),
};

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

if (isWatch) {
  const ctx = await context({
    ...sharedOptions,
    entryPoints: entries,
    outdir,
  });
  await ctx.watch();
  await copyStatic();
  console.log("watching…");
} else {
  await build({
    ...sharedOptions,
    entryPoints: entries,
    outdir,
  });
  await copyStatic();
  console.log("built to", outdir);
}
