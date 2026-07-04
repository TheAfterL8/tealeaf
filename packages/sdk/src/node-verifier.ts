import { Reader, type SourceBufferAsset } from "@contentauth/c2pa-node";
import type { Manifest, ManifestStore } from "@contentauth/c2pa-types";
import { Buffer } from "node:buffer";

import type { Verifier, VerificationResult } from "./types.js";

/**
 * Node verifier. Wraps `@contentauth/c2pa-node`, the native NAPI binding
 * to c2pa-rs. Works in any Node context (no Web Worker required) and
 * uses the full c2pa-rs feature set including remote-manifest fetching.
 *
 * @example
 *
 *   import { NodeVerifier } from "tealeaf-sdk/node";
 *
 *   const verifier = new NodeVerifier();
 *   const result = await verifier.verify(bytes, "image/jpeg");
 */
export class NodeVerifier implements Verifier {
  async verify(
    source: BufferSource,
    mime: string,
  ): Promise<VerificationResult> {
    const buffer = toBuffer(source);
    const asset: SourceBufferAsset = { buffer, mimeType: mime };
    const reader = await Reader.fromAsset(asset);
    if (reader === null) {
      return empty("could not read asset");
    }
    return inspectStore(reader.json());
  }
}

function inspectStore(store: ManifestStore): VerificationResult {
  const activeLabel = store.active_manifest ?? null;
  if (activeLabel === null) {
    return empty("no active manifest");
  }

  const active: Manifest | undefined = store.manifests?.[activeLabel];
  if (active === undefined) {
    return { ...empty("active manifest not found in store"), activeManifest: activeLabel };
  }

  const statuses = store.validation_status ?? [];
  const activeStatuses = statuses.filter(
    (s) => s.url === undefined || s.url === active.url,
  );

  const valid = activeStatuses.every((s) => s.success !== false);

  const issues = activeStatuses
    .filter((s) => s.explanation !== undefined && s.explanation !== null)
    .map((s) => `${s.code}${s.explanation ? `: ${s.explanation}` : ""}`);

  return {
    valid,
    signer: active.signature_info?.issuer ?? null,
    signedAt: active.signature_info?.time ?? null,
    activeManifest: activeLabel,
    issues,
  };
}

function toBuffer(source: BufferSource): Buffer {
  if (source instanceof ArrayBuffer) {
    return Buffer.from(source);
  }
  // Any ArrayBufferView — share the underlying memory, no copy.
  return Buffer.from(source.buffer, source.byteOffset, source.byteLength);
}

function empty(reason: string): VerificationResult {
  return {
    valid: false,
    signer: null,
    signedAt: null,
    activeManifest: null,
    issues: [reason],
  };
}
