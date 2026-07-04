# tealeaf

An open-source, C2PA-based content provenance tool. Independent creators and
developers cryptographically sign digital assets at the moment of creation
using the open C2PA standard — shifting the internet away from unreliable,
reactive AI detection toward proactive, unforgeable verification of human
authenticity.

## Status — Day 1 (tracer bullet)

Right now `tealeaf` is a TypeScript CLI wrapping the official
[`@contentauth/c2pa-node`](https://www.npmjs.com/package/@contentauth/c2pa-node)
SDK. It exposes one subcommand:

```bash
tealeaf verify <file> [--no-ocsp] [--anchors <pem>]
```

This is the consumer-side of the value prop: read a C2PA manifest from any
asset, validate the signing credential, and print a human-readable report.
The browser extension will call the same verification surface.

Coming next: `tealeaf sign`, then `did:web` identity resolution, then the
browser extension.

## Install (developer)

```bash
npm install
```

The `c2pa-node` package ships a prebuilt native binary; on macOS arm64 this
should "just work". If install fails with a binary issue, see
[@contentauth/c2pa-node on npm](https://www.npmjs.com/package/@contentauth/c2pa-node).

## Develop

```bash
# run the CLI from source
npm run dev -- verify path/to/signed.jpg

# type-check without emitting
npm run typecheck

# build a runnable bundle in dist/
npm run build
node dist/cli.js verify path/to/signed.jpg
```

## Try it

You need a C2PA-signed asset. Public samples live in the
[c2pa-rs test fixtures](https://github.com/contentauth/c2pa-rs/tree/main/sdk/tests/fixtures)
— grab one (e.g. `CA.jpg`) and run:

```bash
npm run dev -- verify ./test-fixtures/CA.jpg
```

Expected output (abridged):

```
▸ Asset:    ./test-fixtures/CA.jpg
▸ Embedded: true

Manifest: urn:uuid:…  (active)
  title:    …
  signer:   … (alg=Es256)
  assertions (3):
    - c2pa.actions
    - stds.schema-org.CreativeWork
    - c2pa.hash.data

Validation (1 entry):
  [✔ trusted] signingCredential.trusted
✔ Validation OK (warnings only)
```

## Architecture (planned)

Three deep modules, each ignorant of the others:

- **Identity** — DID resolution, trust lists.
- **Provenance** — signing, manifest construction, verification (this CLI).
- **Distribution** — how creators publish keys, how verifiers fetch anchors.

## License

Apache-2.0.
