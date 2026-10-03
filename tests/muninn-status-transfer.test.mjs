import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MUNINN_STATUS_RECEIVER_URL,
  MUNINN_STATUS_TRANSFER_TIMEOUT_MS,
  transferStoredStatusPackage
} from "../muninn-status-transfer.mjs";
import { StatusPackageError } from "../status-package.mjs";

const raw = new Uint8Array([123, 34, 125]);
const integrity = { sha256: "a".repeat(64), canonical_bytes: 1234n };
const stored = {
  local_id: "status-v1:test",
  originalBytes: raw,
  package: { integrity }
};

function acknowledgement(overrides = {}) {
  return {
    ok: true,
    schema: "huginn.protected-state-export",
    schema_version: 1,
    sha256: integrity.sha256,
    canonical_bytes: Number(integrity.canonical_bytes),
    ...overrides
  };
}

function dependencies(overrides = {}) {
  const calls = { load: 0, verify: 0, mark: 0 };
  return {
    calls,
    loadPackage: async () => {
      calls.load++;
      return stored;
    },
    verifyPackage: async (bytes) => {
      calls.verify++;
      assert.deepEqual(bytes, raw);
      return { package: stored.package, originalBytes: bytes };
    },
    markTransferred: async (_storage, localId, sha256, now) => {
      calls.mark++;
      assert.equal(localId, stored.local_id);
      assert.equal(sha256, integrity.sha256);
      assert.equal(now.toISOString(), "2026-10-03T19:00:00.000Z");
      return { ...stored, metadata: { pending_muninn_transfer: false, muninn_transferred: true } };
    },
    now: new Date("2026-10-03T19:00:00Z"),
    ...overrides
  };
}

test("transfer re-verifies and posts exact original bytes only to the fixed Muninn endpoint", async () => {
  const seen = [];
  const options = dependencies({
    fetchImpl: async (url, request) => {
      seen.push({ url, request });
      return { ok: true, json: async () => acknowledgement() };
    }
  });
  const transferred = await transferStoredStatusPackage({}, options);
  assert.equal(options.calls.verify, 1);
  assert.equal(options.calls.mark, 1);
  assert.equal(transferred.metadata.muninn_transferred, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, MUNINN_STATUS_RECEIVER_URL);
  assert.deepEqual(seen[0].request, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
    cache: "no-store",
    signal: seen[0].request.signal
  });
  assert.equal(MUNINN_STATUS_TRANSFER_TIMEOUT_MS, 8000);
});

test("invalid local bytes never reach Muninn", async () => {
  let posted = false;
  const options = dependencies({
    verifyPackage: async () => { throw new StatusPackageError("local integrity failed"); },
    fetchImpl: async () => { posted = true; throw new Error("must not fetch"); }
  });
  await assert.rejects(() => transferStoredStatusPackage({}, options), StatusPackageError);
  assert.equal(posted, false);
  assert.equal(options.calls.mark, 0);
});

test("every invalid acknowledgement fails closed without transfer metadata", async () => {
  const invalid = [
    acknowledgement({ ok: false }),
    acknowledgement({ schema: "wrong" }),
    acknowledgement({ schema_version: 2 }),
    acknowledgement({ sha256: "b".repeat(64) }),
    acknowledgement({ canonical_bytes: 99 }),
    {},
    null
  ];
  for (const body of invalid) {
    const options = dependencies({
      fetchImpl: async () => ({ ok: true, json: async () => body })
    });
    await assert.rejects(() => transferStoredStatusPackage({}, options), StatusPackageError);
    assert.equal(options.calls.mark, 0);
  }
});

test("HTTP, connection, malformed acknowledgement, and timeout failures preserve pending state", async () => {
  const cases = [
    async () => ({ ok: false, json: async () => ({ ok: false }) }),
    async () => { throw new TypeError("connection refused"); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } })
  ];
  for (const fetchImpl of cases) {
    const options = dependencies({ fetchImpl });
    await assert.rejects(() => transferStoredStatusPackage({}, options));
    assert.equal(options.calls.mark, 0);
  }
  const timeout = dependencies({
    timeoutMs: 1,
    fetchImpl: async (_url, request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(new Error("aborted")));
    })
  });
  await assert.rejects(() => transferStoredStatusPackage({}, timeout), StatusPackageError);
  assert.equal(timeout.calls.mark, 0);
});

test("transfer UI is local-only, uses approved context, and preserves existing workflows", async () => {
  const [app, html, transfer, status] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../muninn-status-transfer.mjs", import.meta.url), "utf8"),
    readFile(new URL("../status-package.mjs", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="status-transfer-muninn-button"[^>]*>Transfer status to Muninn/);
  assert.match(app, /TRANSFERRED TO Muninn/);
  assert.match(app, /Status package accepted and verified by Muninn/);
  assert.match(app, /statusTransferMuninnButton\.addEventListener/);
  assert.match(html, /Receive status from HuginnEIS/);
  assert.match(html, /Import Huginn status file/);
  assert.match(transfer, /127\.0\.0\.1:8766\/api\/v1\/protected-state-export/);
  assert.doesNotMatch(transfer, /192\.168\.4\.1|settings-transfer|JSON\.stringify|JSON\.parse/);
  assert.match(status, /muninn_transferred_sha256/);
  assert.match(status, /pending_muninn_transfer: true/);
  const rendered = [app, html, transfer, status]
    .flatMap((source) => Array.from(source.matchAll(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g), (match) => match[0]))
    .join("\n");
  assert.doesNotMatch(rendered, /\b(?:HUGINNEIS|HUGINNAPP|MUNINN)\b/);
});
