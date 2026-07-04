/**
 * Content script. Scans <img> tags, asks the background worker to verify
 * each, and injects a small badge for verified images. The badge is
 * anchored to a wrapper placed around the image so it stays aligned
 * through layout changes.
 */

import type { VerifyResponse } from "./types.js";

const MIN_SIZE = 64;
const FLUSH_DELAY_MS = 250;
const seen = new WeakSet<HTMLImageElement>();

function isCandidate(img: HTMLImageElement): boolean {
  if (seen.has(img)) return false;
  if (!img.src || img.src.startsWith("data:")) return false;
  if (img.naturalWidth < MIN_SIZE || img.naturalHeight < MIN_SIZE) return false;
  return true;
}

function attachBadge(img: HTMLImageElement, signer: string | null, signedAt: string | null): void {
  const parent = img.parentElement;
  if (parent?.classList.contains("tealeaf-wrap") && parent.querySelector(".tealeaf-badge") !== null) {
    return;
  }

  const wrap = document.createElement("span");
  wrap.className = "tealeaf-wrap";

  const badge = document.createElement("span");
  badge.className = "tealeaf-badge";
  badge.textContent = "✓";
  badge.title = [
    "Verified by C2PA",
    signer ? `Signer: ${signer}` : null,
    signedAt ? `Signed: ${signedAt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  wrap.append(badge);
  img.insertAdjacentElement("afterend", wrap);
  wrap.insertBefore(img, badge);
}

async function verifyOne(img: HTMLImageElement): Promise<void> {
  const res = (await chrome.runtime.sendMessage({
    type: "verify",
    url: img.src,
  })) as VerifyResponse | undefined;
  if (res?.type === "result" && res.valid) {
    attachBadge(img, res.signer, res.signedAt);
  }
}

function processImage(img: HTMLImageElement): void {
  if (seen.has(img)) return;

  const tryVerify = (): void => {
    if (isCandidate(img)) void verifyOne(img);
  };

  if (img.complete && img.naturalWidth > 0) {
    tryVerify();
  } else {
    img.addEventListener("load", tryVerify, { once: true });
  }
}

function collectImages(root: Node, into: Set<HTMLImageElement>): void {
  if (root instanceof HTMLImageElement) {
    into.add(root);
    return;
  }
  if (root instanceof Element) {
    for (const img of root.querySelectorAll("img")) {
      into.add(img);
    }
  }
}

const pending = new Set<HTMLImageElement>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const imgs = Array.from(pending);
    pending.clear();
    for (const img of imgs) processImage(img);
  }, FLUSH_DELAY_MS);
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      collectImages(node, pending);
    }
  }
  if (pending.size > 0) scheduleFlush();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

for (const img of document.images) collectImages(img, pending);
if (pending.size > 0) scheduleFlush();
