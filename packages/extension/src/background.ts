/**
 * Background service worker. Fetches image bytes (CORS mode), runs C2PA
 * verification, returns the result. All outcomes — fetch failure, HTTP
 * error, non-image, verification exception — come back as a "result"
 * with a `reason`.
 *
 * Most image servers don't send `Access-Control-Allow-Origin`, so the
 * `fetch` will fail. Those return `reason: "cors"` and the content script
 * silently skips the image. No badge, no error message.
 */

import { verify } from "./verify.js";
import type { VerifyRequest, VerifyResponse } from "./types.js";

const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, VerifyResponse>();

function cacheGet(key: string): VerifyResponse | undefined {
  const value = cache.get(key);
  if (value === undefined) return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key: string, value: VerifyResponse): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function skip(url: string, reason: string): VerifyResponse {
  return { type: "result", url, valid: false, signer: null, signedAt: null, reason };
}

chrome.runtime.onMessage.addListener(
  (msg: VerifyRequest, _sender, sendResponse) => {
    if (msg?.type !== "verify") return false;
    handleVerify(msg)
      .then(sendResponse)
      .catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        sendResponse(skip(msg.url, `internal: ${reason}`));
      });
    return true;
  },
);

async function handleVerify(msg: VerifyRequest): Promise<VerifyResponse> {
  const cached = cacheGet(msg.url);
  if (cached !== undefined) return cached;
  const result = await fetchAndVerify(msg.url);
  cacheSet(msg.url, result);
  return result;
}

async function fetchAndVerify(url: string): Promise<VerifyResponse> {
  let response: Response;
  try {
    response = await fetch(url, { mode: "cors", credentials: "omit" });
  } catch {
    return skip(url, "cors");
  }
  if (!response.ok) return skip(url, "http");

  const mime = response.headers.get("Content-Type")?.split(";")[0]?.trim() ?? "";
  if (!mime.startsWith("image/")) return skip(url, "not-image");

  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    return skip(url, "read-failed");
  }

  let result: Awaited<ReturnType<typeof verify>>;
  try {
    result = await verify(bytes, mime);
  } catch {
    return skip(url, "verify-failed");
  }

  return {
    type: "result",
    url,
    valid: result.valid,
    signer: result.signer,
    signedAt: result.signedAt,
  };
}
