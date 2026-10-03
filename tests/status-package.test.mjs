import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STATUS_PACKAGE_STORAGE_KEY,
  StatusPackageError,
  buildStatusPreview,
  canonicalBytes,
  loadLatestStatusPackage,
  markStatusPackageTransferred,
  receiveStatusPackage,
  verifyStatusPackage
} from "../status-package.mjs";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.writeCount = 0;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writeCount++;
    this.values.set(key, value);
  }
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function named(code, names) {
  return { code: BigInt(code), name: names[code] };
}

function basePackage() {
  const parameterNames = [
    "VOLTS", "OIL_TEMPERATURE", "MANIFOLD_AIR_TEMPERATURE", "FUEL_PRESSURE",
    "FUEL_FLOW", "THROTTLE_POSITION", "OIL_PRESSURE", "EGT", "CHT",
    "OUTSIDE_AIR_TEMPERATURE", "ECU_AMBIENT_TEMPERATURE", "UCT",
    "FUEL_TEMPERATURE", "HEATER_TEMPERATURE", "RPM"
  ];
  const units = ["V", "C", "psi", "L/h", "%", "rpm"];
  const parameters = parameterNames.map((name, index) => ({
    applicable: true,
    id: named(index, parameterNames),
    informational_only: false,
    informational_reference_milliunits: null,
    presentation_max_milliunits: 100000n,
    presentation_min_milliunits: 0n,
    unit: named(index === 0 ? 0 : index === 14 ? 5 : 1, units),
    zones: [{
      classification: named(2, ["RED", "YELLOW", "GREEN"]),
      lower_inclusive: true,
      lower_milliunits: 0n,
      upper_inclusive: true,
      upper_milliunits: 100000n
    }]
  }));
  return {
    air_state: {
      airframe_time: { seconds: 7200n, unit: "s" },
      engine_time: { seconds: 3600n, unit: "s" },
      fuel: { preset_index: 0n, quantity_ml: 123450n, unit: "ml" },
      metadata: {
        airframe_time_valid: true,
        engine_generation: 1n,
        engine_time_valid: true,
        last_checkpoint_reason: named(3, ["", "BOOTSTRAP", "PERIODIC", "FUEL", "SHUTDOWN", "MAINT"]),
        sequence: 9n
      }
    },
    created_at_utc: "2026-10-03T12:00:00Z",
    faults: {
      max_records: 32n,
      records: [{
        acknowledged: false,
        code: 1400n,
        condition_active: false,
        detail: "Historical status only",
        first_seen_utc: 1700000000n,
        last_seen_utc: 1700000100n,
        limit: "1e-20",
        occurrence_count: 1n,
        severity: named(2, ["INFO", "CAUTION", "WARNING", "CRITICAL"]),
        source: named(5, ["BOARD", "ULPOWER", "POWER", "STORAGE", "NETWORK", "SYSTEM"]),
        title: "Synthetic event",
        unit: null,
        value: "1.5"
      }],
      store_schema: 1n,
      store_sequence: 4n
    },
    schema: "huginn.protected-state-export",
    schema_version: 1n,
    settings: {
      aircraft: { engine: { cylinders: 4n, name: "Synthetic Four", turbo: false }, registration: "TF-HUG" },
      auxiliary: [{ label: "CHT FIVE", priority: 0n, source: named(1, ["", "CHT5", "CHT6", "EGT5", "EGT6"]) }],
      config_revision: 17n,
      display: {
        auto_brightness: true,
        brightness_percent: 80n,
        units: { altitude: "ft", baro: "hPa", fuel: "L", pressure: "psi", speed: "kt", temperature: "C" }
      },
      engine_configuration: {
        aspiration_name: "NATURALLY ASPIRATED",
        cylinder_count: 4n,
        model: "Synthetic Four",
        parameters,
        source: named(1, ["UNSUPPORTED", "BUILT_IN_DEFAULTS", "USER_CUSTOM"]),
        turbocharged: false
      },
      fuel: {
        capacity_l: "200.0",
        default_preset_index: 0n,
        presets: [
          { ethanol_percent: 10n, is_avgas: false, label: "95 OCT E10", ron: 95n },
          { ethanol_percent: 5n, is_avgas: false, label: "98 OCT E5", ron: 98n },
          { ethanol_percent: 0n, is_avgas: true, label: "AVGAS 100LL", ron: 100n }
        ],
        usable_l: "180.0"
      },
      operating_parameters: {
        cht_max_diff_c: { unit: "C", value: 20n },
        cruise_fuel_burn_tenths_lph: { unit: "0.1 L/h", value: 180n }
      },
      ports: [
        { physical: named(0, ["CHT5", "CHT6", "EGT5", "EGT6"]), requested_order: null, semantic: named(0, ["UNASSIGNED", "UCT", "FUEL_TEMPERATURE", "HEATER_TEMPERATURE"]), target: named(1, ["MAIN", "AUX_ONLY"]) },
        { physical: named(1, ["CHT5", "CHT6", "EGT5", "EGT6"]), requested_order: 0n, semantic: named(1, ["UNASSIGNED", "UCT", "FUEL_TEMPERATURE", "HEATER_TEMPERATURE"]), target: named(0, ["MAIN", "AUX_ONLY"]) },
        { physical: named(2, ["CHT5", "CHT6", "EGT5", "EGT6"]), requested_order: 1n, semantic: named(3, ["UNASSIGNED", "UCT", "FUEL_TEMPERATURE", "HEATER_TEMPERATURE"]), target: named(0, ["MAIN", "AUX_ONLY"]) },
        { physical: named(3, ["CHT5", "CHT6", "EGT5", "EGT6"]), requested_order: 2n, semantic: named(2, ["UNASSIGNED", "UCT", "FUEL_TEMPERATURE", "HEATER_TEMPERATURE"]), target: named(0, ["MAIN", "AUX_ONLY"]) }
      ]
    },
    source: { device_id: null, firmware_build_id: "status-courier-test", privacy_profile: "owner_full", product: "Huginn" }
  };
}

async function sealedPackage(mutate = (value) => value) {
  const covered = mutate(basePackage());
  const coveredBytes = canonicalBytes(covered);
  const packageValue = {
    ...covered,
    integrity: {
      algorithm: "SHA-256",
      canonical_bytes: BigInt(coveredBytes.length),
      sha256: await sha256Hex(coveredBytes)
    }
  };
  return canonicalBytes(packageValue);
}

async function rejects(mutator) {
  await assert.rejects(() => sealedPackage(mutator).then(verifyStatusPackage), StatusPackageError);
}

test("valid Protected State Export V1 verifies and preserves exact bytes", async () => {
  const raw = await sealedPackage();
  const verified = await verifyStatusPackage(raw);
  assert.deepEqual(verified.originalBytes, raw);
  assert.equal(verified.package.schema, "huginn.protected-state-export");
});

test("SHA-256 and canonical covered-byte count are both checked", async () => {
  const raw = await sealedPackage();
  const tampered = raw.slice();
  tampered[tampered.length - 2] = tampered[tampered.length - 2] === 48 ? 49 : 48;
  await assert.rejects(() => verifyStatusPackage(tampered), StatusPackageError);
  const coveredMismatch = await sealedPackage((value) => ({ ...value, extensions: { permitted: true } }));
  const text = new TextDecoder().decode(coveredMismatch).replace(/"canonical_bytes":\d+/, "\"canonical_bytes\":0");
  await assert.rejects(() => verifyStatusPackage(new TextEncoder().encode(text)), StatusPackageError);
});

test("wrong schema, version, and forbidden structure reject", async () => {
  await rejects((value) => ({ ...value, schema: "wrong" }));
  await rejects((value) => ({ ...value, schema_version: 2n }));
  await rejects((value) => ({ ...value, extensions: { raw_nvs: "forbidden" } }));
  await rejects((value) => ({ ...value, unexpected_required_section: {} }));
});

test("noncanonical bytes and duplicate keys reject", async () => {
  const raw = await sealedPackage();
  await assert.rejects(() => verifyStatusPackage(new Uint8Array([...raw, 32])), StatusPackageError);
  await assert.rejects(() => verifyStatusPackage(new TextEncoder().encode(
    "{\"schema\":\"huginn.protected-state-export\",\"schema\":\"huginn.protected-state-export\"}")), StatusPackageError);
});

test("verified exact bytes survive local storage and browser reload", async () => {
  const storage = new MemoryStorage();
  const raw = await sealedPackage();
  const stored = await receiveStatusPackage(raw, storage, new Date("2026-10-03T13:00:00Z"));
  assert.equal(stored.metadata.pending_muninn_transfer, true);
  assert.deepEqual(stored.originalBytes, raw);
  const restored = await loadLatestStatusPackage(storage);
  assert.deepEqual(restored.originalBytes, raw);
  assert.equal(restored.metadata.verified, true);
});

test("confirmed Muninn transfer is metadata-only and a new package resets it to pending", async () => {
  const storage = new MemoryStorage();
  const firstBytes = await sealedPackage();
  const received = await receiveStatusPackage(firstBytes, storage, new Date("2026-10-03T13:00:00Z"));
  const transferred = await markStatusPackageTransferred(
    storage, received.local_id, received.package.integrity.sha256, new Date("2026-10-03T14:00:00Z"));
  assert.deepEqual(transferred.originalBytes, firstBytes);
  assert.equal(transferred.metadata.pending_muninn_transfer, false);
  assert.equal(transferred.metadata.muninn_transferred, true);
  assert.equal(transferred.metadata.muninn_transferred_sha256, received.package.integrity.sha256);
  assert.equal(transferred.metadata.muninn_transferred_canonical_bytes,
    Number(received.package.integrity.canonical_bytes));
  assert.equal((await loadLatestStatusPackage(storage)).metadata.muninn_transferred, true);

  const replacementBytes = await sealedPackage((value) => ({
    ...value, created_at_utc: "2026-10-03T14:30:00Z"
  }));
  const replacement = await receiveStatusPackage(replacementBytes, storage, new Date("2026-10-03T14:30:00Z"));
  assert.deepEqual(replacement.originalBytes, replacementBytes);
  assert.equal(replacement.metadata.pending_muninn_transfer, true);
  assert.equal(replacement.metadata.muninn_transferred, false);
  assert.equal(Object.hasOwn(replacement.metadata, "muninn_transferred_at"), false);
});

test("invalid receipt is never stored or marked pending", async () => {
  const storage = new MemoryStorage();
  await assert.rejects(() => receiveStatusPackage(new TextEncoder().encode("{}"), storage), StatusPackageError);
  assert.equal(storage.getItem(STATUS_PACKAGE_STORAGE_KEY), null);
  assert.equal(storage.writeCount, 0);
});

test("preview renders independent authoritative hours and read-only status data", async () => {
  const raw = await sealedPackage((value) => {
    value.air_state.airframe_time.seconds = 9999n;
    value.air_state.metadata.airframe_time_valid = false;
    return value;
  });
  const verified = await verifyStatusPackage(raw);
  const preview = buildStatusPreview(verified.package);
  assert.equal(preview["Engine Hours"], "1:00");
  assert.equal(preview["Airframe Hours"], "Unavailable");
  assert.match(preview.Fuel, /^123450 ml/);
  assert.match(preview["Faults / Events"], /#1400/);
});

test("status receipt path remains offline and has no aircraft mutation vocabulary", async () => {
  const [moduleSource, appSource, htmlSource] = await Promise.all([
    readFile(new URL("../status-package.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(moduleSource, /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/i);
  const importStart = appSource.indexOf("async function importStatusFile");
  const importEnd = appSource.indexOf("async function showStoredStatusPackagePreview", importStart);
  assert.doesNotMatch(appSource.slice(importStart, importEnd), /fetch|apply|acknowledge|delete/i);
  assert.match(htmlSource, /id="status-import-button"[^>]*>Import Huginn status file/);
  assert.match(htmlSource, /id="status-preview-button"/);
  assert.match(appSource, /Verified — pending transfer to Muninn/);
});
