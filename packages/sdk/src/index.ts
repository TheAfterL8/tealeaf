/**
 * tealeaf-sdk — TypeScript SDK for C2PA content verification.
 *
 * Wraps `@contentauth/c2pa-node` (the native NAPI binding to c2pa-rs)
 * for use in Node contexts — the tealeaf CLI, and any future server tools.
 *
 * The `Verifier` interface is the public contract; if a second consumer
 * appears (e.g. a future browser-side verifier), it implements the same
 * interface so application code stays portable.
 *
 * Usage:
 *
 *   import { NodeVerifier, type Verifier } from "tealeaf-sdk";
 *
 *   const verifier: Verifier = new NodeVerifier();
 *   const result = await verifier.verify(imageBytes, "image/jpeg");
 *   if (result.valid) { /* show "Verified" badge *\/ }
 */

export { NodeVerifier } from "./node-verifier.js";
export type { Verifier, VerificationResult } from "./types.js";
