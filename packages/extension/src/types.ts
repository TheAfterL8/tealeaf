/**
 * Messages exchanged between content script and background service worker.
 * Every outcome is a "result" with an optional `reason` so the content
 * script can treat valid/invalid/skipped uniformly.
 */

export interface VerifyRequest {
  type: "verify";
  url: string;
}

export type VerifyResponse = {
  type: "result";
  url: string;
  valid: boolean;
  signer: string | null;
  signedAt: string | null;
  /** Why we didn't produce a "valid" result. Absent when `valid` is true. */
  reason?: string;
};
