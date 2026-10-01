import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SETTINGS_PACKAGE_STORAGE_KEY,
  canonicalBytes,
  loadLatestPendingPackage,
  markDeviceVerified,
  receiveSettingsPackage,
  verifySettingsPackage
} from "../settings-package.mjs";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.writeCount = 0;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writeCount += 1;
    this.values.set(key, value);
  }
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function coveredPackage() {
  return {
    provenance: { created_at_utc: "2026-10-01T12:34:56Z", product: "Muninn" },
    schema: "huginn.settings-transfer",
    schema_version: 1,
    settings: {
      display: {
        auto_brightness: true,
        brightness_percent: 80,
        units: { altitude: "ft", baro: "hPa", fuel: "L", pressure: "psi", speed: "kt", temperature: "C" }
      },
      fuel: {
        default_preset_index: 0,
        presets: [
          { ethanol_percent: 10, is_avgas: false, label: "95 OCT E10", ron: 95 },
          { ethanol_percent: 5, is_avgas: false, label: "98 OCT E5", ron: 98 },
          { ethanol_percent: 0, is_avgas: true, label: "AVGAS 100LL", ron: 100 }
        ]
      }
    }
  };
}

async function validPackage(mutate = (value) => value) {
  const covered = mutate(coveredPackage());
  const coveredBytes = canonicalBytes(covered);
  const packageValue = {
    ...covered,
    integrity: { algorithm: "SHA-256", canonical_bytes: coveredBytes.length, sha256: await sha256Hex(coveredBytes) }
  };
  return canonicalBytes(packageValue);
}

async function rejects(mutator) {
  await assert.rejects(() => validPackage(mutator).then(verifySettingsPackage));
}

async function source(name) {
  return readFile(new URL(`../${name}`, import.meta.url), "utf8");
}

function functionBody(sourceText, name) {
  const start = sourceText.indexOf(`function ${name}`);
  const end = sourceText.indexOf("\n}\n", start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} must end`);
  return sourceText.slice(start, end + 2);
}

test("valid Settings Package V1 verifies", async () => {
  const raw = await validPackage();
  await assert.doesNotReject(() => verifySettingsPackage(raw));
});

test("stored package preserves the exact original bytes", async () => {
  const storage = new MemoryStorage();
  const raw = await validPackage();
  const stored = await receiveSettingsPackage(raw, storage, new Date("2026-10-01T13:00:00Z"));
  assert.deepEqual(stored.originalBytes, raw);
  assert.deepEqual((await loadLatestPendingPackage(storage)).originalBytes, raw);
});

test("stored bytes and digest match the imported package", async () => {
  const storage = new MemoryStorage();
  const raw = await validPackage();
  const stored = await receiveSettingsPackage(raw, storage, new Date("2026-10-01T13:00:00Z"));
  assert.deepEqual(stored.originalBytes, raw);
  assert.equal(stored.metadata.covered_sha256, stored.package.integrity.sha256);
});

test("tampered integrity is rejected", async () => {
  const raw = await validPackage();
  raw[raw.length - 2] = raw[raw.length - 2] === 48 ? 49 : 48;
  await assert.rejects(() => verifySettingsPackage(raw));
});

test("wrong schema is rejected", () => rejects((value) => ({ ...value, schema: "wrong" })));
test("wrong schema version is rejected", () => rejects((value) => ({ ...value, schema_version: 2 })));
test("invalid display unit is rejected", () => rejects((value) => {
  value.settings.display.units.altitude = "km";
  return value;
}));
test("invalid brightness is rejected", () => rejects((value) => {
  value.settings.display.brightness_percent = 101;
  return value;
}));
test("invalid fuel preset is rejected", () => rejects((value) => {
  value.settings.fuel.presets[0].label = "UNSUPPORTED";
  return value;
}));
test("invalid default preset index is rejected", () => rejects((value) => {
  value.settings.fuel.default_preset_index = 3;
  return value;
}));
test("protected-state key is rejected", () => rejects((value) => ({ ...value, faults: [] })));

test("invalid package is not marked pending", async () => {
  const storage = new MemoryStorage();
  await assert.rejects(async () => receiveSettingsPackage(
    await validPackage((value) => ({ ...value, air_state: {} })), storage));
  assert.equal(storage.getItem(SETTINGS_PACKAGE_STORAGE_KEY), null);
  assert.equal(storage.writeCount, 0);
});

test("verified package is marked pending", async () => {
  const stored = await receiveSettingsPackage(await validPackage(), new MemoryStorage());
  assert.equal(stored.metadata.status, "pending");
});

test("restart reloads the verified pending package", async () => {
  const storage = new MemoryStorage();
  const raw = await validPackage();
  await receiveSettingsPackage(raw, storage);
  const reloaded = await loadLatestPendingPackage(storage);
  assert.equal(reloaded.metadata.status, "pending");
  assert.deepEqual(reloaded.originalBytes, raw);
});

test("receipt and reload do not invoke network access", async () => {
  const storage = new MemoryStorage();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("network access is prohibited"); };
  try {
    await receiveSettingsPackage(await validPackage(), storage);
    await loadLatestPendingPackage(storage);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live configuration failure leaves the package import control available", async () => {
  const appSource = await source("app.js");
  const failureView = functionBody(appSource, "showFailure");
  assert.match(appSource, /settingsImportButton\.addEventListener/);
  assert.match(failureView, /HUGINNEIS NOT CONNECTED/);
  assert.doesNotMatch(failureView, /settingsImportButton|settingsFileInput/);
});

test("live connection unavailable still permits valid package receipt", async () => {
  const storage = new MemoryStorage();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("simulated live config failure"); };
  try {
    const stored = await receiveSettingsPackage(await validPackage(), storage);
    assert.equal(stored.metadata.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reload remains local while live connection is unavailable", async () => {
  const storage = new MemoryStorage();
  await receiveSettingsPackage(await validPackage(), storage);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("simulated live config failure"); };
  try {
    assert.equal((await loadLatestPendingPackage(storage)).metadata.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("courier module contains no relay, apply, device, or network action", async () => {
  const courierSource = await source("settings-package.mjs");
  assert.doesNotMatch(courierSource,
    /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|relay|apply|NVS|HFS2|CAN)\b/i);
});

test("device hash mismatch does not mark local metadata verified", async () => {
  const storage = new MemoryStorage();
  const stored = await receiveSettingsPackage(await validPackage(), storage);
  await assert.rejects(() => markDeviceVerified(storage, stored.local_id, "0".repeat(64)));
  assert.equal((await loadLatestPendingPackage(storage)).metadata.device_verified, undefined);
});

test("matching device verification marks local metadata only", async () => {
  const storage = new MemoryStorage();
  const stored = await receiveSettingsPackage(await validPackage(), storage);
  const verified = await markDeviceVerified(storage, stored.local_id,
    stored.package.integrity.sha256, new Date("2026-10-01T13:00:00Z"));
  assert.equal(verified.metadata.device_verified, true);
  assert.equal(verified.metadata.device_verified_sha256, stored.package.integrity.sha256);
  assert.deepEqual(verified.originalBytes, stored.originalBytes);
});

test("app relay posts the exact stored bytes and never applies settings", async () => {
  const appSource = await source("app.js");
  const relay = functionBody(appSource, "verifyPendingSettingsPackageWithHuginnEis");
  assert.match(relay, /body: stored\.originalBytes/);
  assert.match(relay, /loadLatestPendingPackage/);
  assert.doesNotMatch(relay, /apply|nvs|CAN|HFS2|AIR_STATE/i);
});
