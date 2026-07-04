# tealeaf extension

Chrome MV3 extension that surfaces C2PA content provenance on every image.

## What it does

On every page, scans `<img>` elements, asks the background service
worker to verify each one's C2PA manifest, and injects a small `✓`
badge next to images that come back as valid. Hover the badge to see
the signer and signing time.

## CORS — the hard constraint

To verify a manifest, we need the **raw image bytes**. In MV3, the
service worker can `fetch()` an image, but only with CORS — and most
image servers don't send `Access-Control-Allow-Origin`. For those, we
silently skip verification. The badge only appears on CORS-friendly
images.

## Develop

```bash
npm install
npm run build
```

This produces `dist/` with everything Chrome needs:

```
dist/
├── manifest.json
├── background.js       # service worker (C2PA verification)
├── content.js          # DOM observation + badge injection
├── content.css
└── c2pa_bg.wasm        # 8 MB, the C2PA core
```

`npm run dev` rebuilds on file changes.

## Install in Chrome (unpacked)

1. `npm run build`
2. Open `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select `packages/extension/dist/`
5. Open any page with CORS-friendly C2PA-signed images; verified images
   will get a `✓` badge in the corner

## Test fixture

The repo ships `test-fixtures/CA.jpg` — a known C2PA-signed JPEG from
the c2pa-rs project. To test locally, run a static server from the
repo root (the image is CORS-friendly when served from `localhost`):

```bash
cd test-fixtures && python3 -m http.server 8000
```

Then visit `http://localhost:8000/CA.jpg` directly. The badge should
appear on the image (or after a few seconds, since the script runs at
`document_idle`).

## Permissions

- `host_permissions: ["<all_urls>"]` — required to fetch cross-origin
  image bytes for verification.

No other permissions in v1.

## Known limitations (v1)

- **CORS-only**: images whose servers don't send CORS headers are
  silently skipped. Most of the public web falls into this bucket.
- **No icons yet** — Chrome will show a default placeholder.
- **Chrome only** — see
  [#1](https://github.com/TheAfterL8/tealeaf/issues/1) for the
  multi-browser tracking issue.
