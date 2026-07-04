/**
 * The shape of a verification result, designed to be small and stable
 * enough to surface directly to UI consumers (the browser extension, the
 * CLI, future server-side tools).
 */
export interface VerificationResult {
  /** True only if the SDK could find a manifest, verify the signature
   *  against configured trust anchors, and confirm the hard-binding hash. */
  valid: boolean;

  /** The signer name from the manifest's signature info, if any. */
  signer: string | null;

  /** ISO 8601 timestamp of when the manifest was signed, if known. */
  signedAt: string | null;

  /** The label of the active manifest in the store, if any. */
  activeManifest: string | null;

  /** Human-readable validation issue codes (e.g. "signingCredential.untrusted"). */
  issues: string[];
}

/**
 * Common interface implemented by both `WasmVerifier` (browser, uses
 * `c2pa-wasm`) and `NodeVerifier` (Node, uses `c2pa-node`). Consumers
 * import the one that matches their runtime; the SDK itself stays
 * runtime-agnostic.
 */
export interface Verifier {
  verify(source: BufferSource, mime: string): Promise<VerificationResult>;
}
