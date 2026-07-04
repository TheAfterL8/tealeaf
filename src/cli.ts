#!/usr/bin/env node
/**
 * tealeaf — C2PA content provenance, from the terminal.
 *
 * Usage:
 *   tealeaf verify <path-to-asset> [--no-ocsp] [--anchors <pem>]
 */

import { resolve } from "node:path";
import {
  Reader,
  createVerifySettings,
  createTrustSettings,
  mergeSettings,
  type Manifest,
  type Settings,
  type ValidationStatus,
} from "@contentauth/c2pa-node";

/**
 * The exit codes the CLI can return.
 */
const ExitCode = {
  Success: 0,
  Error: 1, // CLI / IO / unexpected runtime failure
  NoManifest: 2,
  ValidationFailed: 3,
} as const;

type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * An expected user-facing error with an associated exit code.
 */
class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode = ExitCode.Error,
  ) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * Subset of the JSON returned by `Reader.json()` that this CLI consumes.
 */
interface ManifestStore {
  active_manifest?: string;
  manifests: Record<string, Manifest>;
  validation_status: ValidationStatus[];
}

interface VerifyArgs {
  file: string;
  ocsp: boolean;
  anchors?: string;
}

/**
 * Parse arguments for the `verify` command.
 *
 * @param argv - The raw command-line arguments, without the `node` and
 *   script-name prefix.
 * @returns The parsed, validated arguments.
 * @throws {CliError} If the input is invalid or required arguments are missing.
 */
function parseVerify(argv: readonly string[]): VerifyArgs {
  const args: VerifyArgs = { file: "", ocsp: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue; // narrows for noUncheckedIndexedAccess

    if (!a.startsWith("-")) {
      if (args.file) throw new CliError(`unknown argument: ${a}`);
      args.file = a;
      continue;
    }

    switch (a) {
      case "--no-ocsp":
        args.ocsp = false;
        break;
      case "--anchors": {
        const next = argv[++i];
        if (next === undefined) throw new CliError("--anchors requires a path");
        args.anchors = next;
        break;
      }
      default:
        throw new CliError(`unknown argument: ${a}`);
    }
  }
  if (!args.file) throw new CliError("missing required argument: <file>");
  return args;
}

function printHelp(): void {
  console.log(`tealeaf verify — read & verify a C2PA manifest

Usage:
  tealeaf verify <file> [--no-ocsp] [--anchors <pem>]

Options:
  --no-ocsp       skip OCSP revocation checks (faster, fully offline)
  --anchors <p>   path to a PEM file with extra trust anchors
  -h, --help      show this help
`);
}

function buildSettings(args: VerifyArgs): Settings {
  const verify = createVerifySettings({
    verifyAfterReading: true,
    verifyTrust: true,
    verifyTimestampTrust: true,
    ocspFetch: args.ocsp,
    remoteManifestFetch: true,
    strictV1Validation: false,
  });
  const trust = createTrustSettings({
    verifyTrustList: true,
    ...(args.anchors !== undefined ? { userAnchors: args.anchors } : {}),
  });
  return mergeSettings(trust, verify);
}

const color = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
} as const;

/**
 * Validation status codes that should cause the command to fail.
 */
const FATAL_CODES = new Set([
  "signingCredential.untrusted",
  "signingCredential.invalid",
  "assertion.hardBindingMissing",
  "hash.mismatch",
  "signature.mismatch",
  "general.invalid",
] as const);

function printManifest(label: string, m: Manifest, isActive: boolean): void {
  const accent = isActive ? color.green : color.yellow;
  console.log(`${accent}Manifest: ${label}${isActive ? "  (active)" : ""}${color.reset}`);
  if (m.title) console.log(`  title:    ${m.title}`);
  if (m.format) console.log(`  format:   ${m.format}`);
  if (m.claim_generator) console.log(`  generator:${m.claim_generator}`);
  if (m.signature_info) {
    const s = m.signature_info;
    console.log(`  signer:   ${s.issuer ?? "?"} (alg=${s.alg ?? "?"})`);
    if (s.time) console.log(`  signed:   ${s.time}`);
  }
  if (m.assertions && m.assertions.length > 0) {
    console.log(`  assertions (${m.assertions.length}):`);
    for (const a of m.assertions) {
      console.log(`    - ${a.label}`);
    }
  }
}

function printStatus(s: ValidationStatus): "fatal" | "ok" {
  const code = s.code ?? "";
  const isFatal = FATAL_CODES.has(code);
  const tag = isFatal
    ? `${color.red}✖ ${code}${color.reset}`
    : code === "signingCredential.trusted"
      ? `${color.green}✔ trusted${color.reset}`
      : `${color.yellow}⚠ ${code}${color.reset}`;
  console.log(`  [${tag}] ${s.label ?? ""}`);
  if (s.explanation) console.log(`      ${s.explanation}`);
  return isFatal ? "fatal" : "ok";
}

/**
 * Run the `verify` subcommand end-to-end and return the exit code.
 *
 * All `CliError` and unexpected errors are caught and converted to an
 * exit code; this function never throws. The single `process.exit()`
 * at the bottom of the file consumes the returned code.
 *
 * @returns The exit code the process should terminate with.
 */
async function main(): Promise<ExitCode> {
  const argv = process.argv.slice(2);

  try {
    // Keep help out of parseVerify so it stays strict.
    if (argv.includes("--help") || argv.includes("-h")) {
      printHelp();
      return ExitCode.Success;
    }

    const args = parseVerify(argv);
    const path = resolve(args.file);

    const reader = await Reader.fromAsset(path, buildSettings(args));

    if (!reader.isEmbedded() && !reader.remoteUrl()) {
      console.error(`${color.yellow}No C2PA manifest found in ${path}${color.reset}`);
      return ExitCode.NoManifest;
    }

    const remoteUrl = reader.remoteUrl();
    console.log(`${color.cyan}▸ Asset:    ${path}${color.reset}`);
    console.log(`${color.cyan}▸ Embedded: ${reader.isEmbedded()}${color.reset}`);
    if (remoteUrl) {
      console.log(`${color.cyan}▸ Remote:   ${remoteUrl}${color.reset}`);
    }

    const store = reader.json() as ManifestStore;
    for (const [label, m] of Object.entries(store.manifests)) {
      printManifest(label, m, label === store.active_manifest);
    }

    const statuses = store.validation_status;
    console.log(
      `\nValidation (${statuses.length} entr${statuses.length === 1 ? "y" : "ies"}):`,
    );
    let hadFatal = false;
    for (const s of statuses) {
      if (printStatus(s) === "fatal") hadFatal = true;
    }

    if (statuses.length === 0) {
      console.log(`${color.green}✔ Validation: passed (no issues reported)${color.reset}`);
      return ExitCode.Success;
    }
    if (hadFatal) {
      console.log(`\n${color.red}✖ Validation FAILED${color.reset}`);
      return ExitCode.ValidationFailed;
    }
    console.log(`\n${color.green}✔ Validation OK (warnings only)${color.reset}`);
    return ExitCode.Success;
  } catch (err) {
    if (err instanceof CliError) {
      console.error(`${color.red}error:${color.reset} ${err.message}`);
      return err.exitCode;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${color.red}error:${color.reset} ${message}`);
    return ExitCode.Error;
  }
}

process.exit(await main());
