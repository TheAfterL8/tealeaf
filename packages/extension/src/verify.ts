/**
 * c2pa-wasm wrapper. The library uses `FileReaderSync` internally, a
 * Web-Worker-only API. The MV3 service worker qualifies.
 *
 * The library types `manifestStore()` as `any`; the `ManifestStoreShape`
 * and `ManifestShape` below mirror the actual runtime shape (Rust
 * camelCase via wasm-bindgen). c2pa-wasm does not export these types.
 *
 * The WASM is fetched from the extension's own URL via
 * `chrome.runtime.getURL`, which works because the service worker
 * always has access to its own packaged files.
 */

import init, { WasmReader } from "@contentauth/c2pa-wasm";

export interface VerifyResult {
  valid: boolean;
  signer: string | null;
  signedAt: string | null;
  activeManifest: string | null;
  issues: string[];
}

const VALID_STATUS = "valid";
let initPromise: Promise<unknown> | null = null;

async function ensureInit(): Promise<void> {
  if (initPromise === null) {
    initPromise = init(chrome.runtime.getURL("c2pa_bg.wasm"));
  }
  await initPromise;
}

export async function verify(
  bytes: ArrayBuffer,
  mime: string,
): Promise<VerifyResult> {
  await ensureInit();

  const blob = new Blob([bytes], { type: mime });
  const reader = await WasmReader.fromBlob(mime, blob);

  try {
    return inspect(reader);
  } finally {
    reader.free();
  }
}

function inspect(reader: WasmReader): VerifyResult {
  const store = reader.manifestStore() as ManifestStoreShape | null;
  if (store === null) {
    return empty(null);
  }

  const activeLabel = reader.activeLabel() ?? null;
  if (activeLabel === null) {
    return empty(null);
  }

  const active = store.manifests[activeLabel];
  if (active === undefined) {
    return { ...empty(null), activeManifest: activeLabel };
  }

  const status = active.validationStatus;
  const valid = status?.code === VALID_STATUS;
  const issues = (status?.issues ?? []).map((i) =>
    typeof i.explanation === "string" ? `${i.code}: ${i.explanation}` : i.code,
  );

  return {
    valid,
    signer: active.signatureInfo?.issuer ?? null,
    signedAt: active.signatureInfo?.time ?? null,
    activeManifest: activeLabel,
    issues,
  };
}

function empty(activeManifest: string | null): VerifyResult {
  return { valid: false, signer: null, signedAt: null, activeManifest, issues: [] };
}

interface ManifestStoreShape {
  activeManifest?: string;
  manifests: Record<string, ManifestShape>;
}

interface ManifestShape {
  signatureInfo?: { issuer?: string; time?: string };
  validationStatus?: {
    code?: string;
    issues?: { code: string; explanation?: string }[];
  };
}
