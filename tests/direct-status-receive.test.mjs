import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HUGINN_DIRECT_STATUS_EXPORT_MAX_BYTES,
  HUGINN_DIRECT_STATUS_EXPORT_URL,
  receiveDirectStatusPackage
} from "../direct-status-receive.mjs";
import { StatusPackageError } from "../status-package.mjs";

class MemoryStorage {
  constructor() {
    this.value = "previous verified package";
    this.writeCount = 0;
  }

  getItem() {
    return this.value;
  }

  setItem(_key, value) {
    this.writeCount++;
    this.value = value;
  }
}

function response({ ok = true, type = "application/json", length = null, body = new Uint8Array([1, 2, 3]) } = {}) {
  return {
    ok,
    headers: {
      get(name) {
        if (name === "Content-Type") return type;
        if (name === "Content-Length") return length;
        return null;
      }
    },
    async arrayBuffer() {
      return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    }
  };
}

function receiving(storage, expected) {
  return async (rawBytes, destination, now) => {
    assert.equal(destination, storage);
    assert.equal(storage.writeCount, 0, "verification must precede storage");
    assert.deepEqual(rawBytes, expected);
    assert.equal(now.toISOString(), "2026-10-03T17:20:08.000Z");
    storage.setItem("huginn.v1.status-package", "new verified package");
    return { originalBytes: rawBytes, package: { source: { product: "Huginn" } } };
  };
}

async function rejectsPreservingPrevious(options, message) {
  const storage = new MemoryStorage();
  const previous = storage.getItem();
  await assert.rejects(
    () => receiveDirectStatusPackage(storage, options),
    message ?? StatusPackageError
  );
  assert.equal(storage.getItem(), previous);
  assert.equal(storage.writeCount, 0);
}

test("direct receive uses one GET and passes exact raw bytes to verifier then storage", async () => {
  const raw = new Uint8Array([123, 34, 125]);
  const storage = new MemoryStorage();
  const calls = [];
  const stored = await receiveDirectStatusPackage(storage, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ length: String(raw.length), body: raw });
    },
    receivePackage: receiving(storage, raw),
    now: new Date("2026-10-03T17:20:08Z")
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, HUGINN_DIRECT_STATUS_EXPORT_URL);
  assert.deepEqual(calls[0].options, {
    method: "GET", headers: { Accept: "application/json" }, cache: "no-store"
  });
  assert.equal(storage.writeCount, 1);
  assert.deepEqual(stored.originalBytes, raw);
});

test("valid response accepts a compatible JSON media type without Content-Length", async () => {
  const raw = new Uint8Array([7, 8]);
  const storage = new MemoryStorage();
  await receiveDirectStatusPackage(storage, {
    fetchImpl: async () => response({ type: "Application/JSON; charset=utf-8", body: raw }),
    receivePackage: receiving(storage, raw),
    now: new Date("2026-10-03T17:20:08Z")
  });
  assert.equal(storage.writeCount, 1);
});

test("zero and oversized received bodies preserve the previous package", async () => {
  await rejectsPreservingPrevious({ fetchImpl: async () => response({ body: new Uint8Array() }) });
  await rejectsPreservingPrevious({ fetchImpl: async () => response({
    body: new Uint8Array(HUGINN_DIRECT_STATUS_EXPORT_MAX_BYTES + 1)
  }) });
});

test("invalid, zero, and oversized Content-Length reject before trusted storage", async () => {
  for (const length of ["invalid", "0", "32769"]) {
    await rejectsPreservingPrevious({ fetchImpl: async () => response({ length }) });
  }
});

test("Content-Length mismatch, wrong Content-Type, and HTTP failure preserve previous status", async () => {
  await rejectsPreservingPrevious({ fetchImpl: async () => response({ length: "2", body: new Uint8Array([1]) }) });
  await rejectsPreservingPrevious({ fetchImpl: async () => response({ type: "text/plain" }) });
  await rejectsPreservingPrevious({ fetchImpl: async () => response({ ok: false }) });
});

test("network, SHA, canonical, and other verifier failures preserve previous status", async () => {
  await rejectsPreservingPrevious({ fetchImpl: async () => { throw new TypeError("network failed"); } }, TypeError);
  for (const message of ["integrity verification failed", "package is not canonical", "package is invalid"]) {
    await rejectsPreservingPrevious({
      fetchImpl: async () => response(),
      receivePackage: async () => { throw new StatusPackageError(message); }
    });
  }
});

test("direct adapter remains raw-byte-only, read-only, and independent of SD or settings routes", async () => {
  const [source, appSource, htmlSource] = await Promise.all([
    readFile(new URL("../direct-status-receive.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);
  assert.match(source, /response\.arrayBuffer\(\)/);
  assert.doesNotMatch(source, /response\.(?:json|text)\(/);
  assert.doesNotMatch(source, /\/api\/v1\/dev\/export-v1|\bPOST\b|sdcard|\/sd\b|settings-transfer|acknowledge|delete|fuel|hours|reboot/i);
  assert.match(appSource, /receiveDirectStatusPackage\(/);
  assert.match(htmlSource, /id="status-receive-button"[^>]*>Receive status from HuginnEIS/);
  assert.match(htmlSource, /id="status-import-button"[^>]*>Import Huginn status file/);
  assert.match(htmlSource, /id="status-preview-button"[^>]*>Show latest Huginn status/);
});
