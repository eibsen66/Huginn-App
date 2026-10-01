"use strict";

export const SETTINGS_PACKAGE_SCHEMA = "huginn.settings-transfer";
export const SETTINGS_PACKAGE_VERSION = 1;
export const SETTINGS_PACKAGE_STORAGE_KEY = "huginn.v1.settings-packages";

const ROOT_KEYS = ["integrity", "provenance", "schema", "schema_version", "settings"];
const UNIT_VALUES = {
  altitude: new Set(["ft", "m"]),
  baro: new Set(["hPa", "inHg"]),
  fuel: new Set(["L", "US gal"]),
  pressure: new Set(["psi", "bar"]),
  speed: new Set(["km/h", "kt"]),
  temperature: new Set(["C", "F"])
};
const PRESET_VALUES = new Set([
  "91|5|false|91 OCT E5", "91|10|false|91 OCT E10",
  "95|5|false|95 OCT E5", "95|10|false|95 OCT E10",
  "95|15|false|95 OCT E15", "95|20|false|95 OCT E20",
  "98|5|false|98 OCT E5", "98|10|false|98 OCT E10",
  "91|0|true|AVGAS UL91", "100|0|true|AVGAS 100LL"
]);

export class SettingsPackageError extends Error {}

function fail(message) {
  throw new SettingsPackageError(message);
}

function exactObject(value, name, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    fail(`${name} keys are invalid`);
  }
  return value;
}

function stringValue(value, name) {
  if (typeof value !== "string") {
    fail(`${name} is not a string`);
  }
  return value;
}

function integerValue(value, name) {
  if (!Number.isInteger(value)) {
    fail(`${name} is not an integer`);
  }
  return value;
}

function booleanValue(value, name) {
  if (typeof value !== "boolean") {
    fail(`${name} is not a boolean`);
  }
  return value;
}

function timestampValue(value) {
  const timestamp = stringValue(value, "provenance.created_at_utc");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(timestamp) ||
      Number.isNaN(new Date(timestamp).getTime()) ||
      `${new Date(timestamp).toISOString().slice(0, 19)}Z` !== timestamp) {
    fail("provenance.created_at_utc is invalid");
  }
  return timestamp;
}

function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalValue(value[key]);
    }
    return result;
  }
  return value;
}

export function canonicalBytes(value) {
  const text = JSON.stringify(canonicalValue(value));
  if (text === undefined) {
    fail("canonical JSON failed");
  }
  return new TextEncoder().encode(text);
}

function equalBytes(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) {
    fail("local SHA-256 support is unavailable");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function parsePackage(rawBytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  } catch (error) {
    fail("package is not valid UTF-8");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail("package is not valid JSON");
  }
}

function validateSettings(settings) {
  exactObject(settings, "settings", ["display", "fuel"]);
  const display = exactObject(settings.display, "settings.display",
    ["auto_brightness", "brightness_percent", "units"]);
  const units = exactObject(display.units, "settings.display.units", Object.keys(UNIT_VALUES));
  for (const [name, allowed] of Object.entries(UNIT_VALUES)) {
    if (!allowed.has(stringValue(units[name], `settings.display.units.${name}`))) {
      fail(`unsupported ${name} unit`);
    }
  }
  const brightness = integerValue(display.brightness_percent, "settings.display.brightness_percent");
  if (brightness < 20 || brightness > 100) {
    fail("brightness is outside the supported range");
  }
  booleanValue(display.auto_brightness, "settings.display.auto_brightness");

  const fuel = exactObject(settings.fuel, "settings.fuel", ["default_preset_index", "presets"]);
  if (!Array.isArray(fuel.presets) || fuel.presets.length !== 3) {
    fail("fuel preset count is invalid");
  }
  for (const [index, preset] of fuel.presets.entries()) {
    exactObject(preset, `settings.fuel.presets[${index}]`,
      ["ethanol_percent", "is_avgas", "label", "ron"]);
    const ethanol = integerValue(preset.ethanol_percent, `settings.fuel.presets[${index}].ethanol_percent`);
    const avgas = booleanValue(preset.is_avgas, `settings.fuel.presets[${index}].is_avgas`);
    const label = stringValue(preset.label, `settings.fuel.presets[${index}].label`);
    const ron = integerValue(preset.ron, `settings.fuel.presets[${index}].ron`);
    if (!label || !PRESET_VALUES.has(`${ron}|${ethanol}|${avgas}|${label}`)) {
      fail("unsupported fuel preset");
    }
  }
  const defaultIndex = integerValue(fuel.default_preset_index, "settings.fuel.default_preset_index");
  if (defaultIndex < 0 || defaultIndex >= fuel.presets.length) {
    fail("default preset index is invalid");
  }
}

export async function verifySettingsPackage(rawBytes) {
  const originalBytes = new Uint8Array(rawBytes);
  const root = exactObject(parsePackage(originalBytes), "package", ROOT_KEYS);
  if (stringValue(root.schema, "schema") !== SETTINGS_PACKAGE_SCHEMA) {
    fail("schema is invalid");
  }
  if (integerValue(root.schema_version, "schema_version") !== SETTINGS_PACKAGE_VERSION) {
    fail("schema version is invalid");
  }
  const provenance = exactObject(root.provenance, "provenance", ["created_at_utc", "product"]);
  const createdAt = timestampValue(provenance.created_at_utc);
  if (stringValue(provenance.product, "provenance.product") !== "Muninn") {
    fail("provenance product is invalid");
  }
  validateSettings(root.settings);
  const integrity = exactObject(root.integrity, "integrity", ["algorithm", "canonical_bytes", "sha256"]);
  if (stringValue(integrity.algorithm, "integrity.algorithm") !== "SHA-256") {
    fail("integrity algorithm is invalid");
  }
  const digest = stringValue(integrity.sha256, "integrity.sha256");
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    fail("integrity digest is invalid");
  }
  const covered = { ...root };
  delete covered.integrity;
  const coveredBytes = canonicalBytes(covered);
  if (integerValue(integrity.canonical_bytes, "integrity.canonical_bytes") !== coveredBytes.length ||
      await sha256Hex(coveredBytes) !== digest) {
    fail("integrity verification failed");
  }
  if (!equalBytes(canonicalBytes(root), originalBytes)) {
    fail("package is not canonical");
  }
  return { package: root, createdAt, originalBytes };
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readRecords(storage) {
  let serialized;
  try {
    serialized = storage.getItem(SETTINGS_PACKAGE_STORAGE_KEY);
  } catch (error) {
    fail("local package storage is unavailable");
  }
  if (serialized === null) {
    return [];
  }
  try {
    const records = JSON.parse(serialized);
    if (!Array.isArray(records)) {
      fail("stored package metadata is invalid");
    }
    return records;
  } catch (error) {
    if (error instanceof SettingsPackageError) {
      throw error;
    }
    fail("stored package metadata is invalid");
  }
}

export async function receiveSettingsPackage(rawBytes, storage, now = new Date()) {
  const verified = await verifySettingsPackage(rawBytes);
  const receivedAt = now.toISOString();
  const record = {
    local_id: `settings-v1:${verified.package.integrity.sha256}:${receivedAt}`,
    metadata: {
      received_at: receivedAt,
      status: "pending",
      schema: verified.package.schema,
      schema_version: verified.package.schema_version,
      source_product: verified.package.provenance.product,
      created_at_utc: verified.createdAt,
      covered_sha256: verified.package.integrity.sha256
    },
    package_bytes_base64: bytesToBase64(verified.originalBytes)
  };
  const records = readRecords(storage);
  try {
    storage.setItem(SETTINGS_PACKAGE_STORAGE_KEY, JSON.stringify([...records, record]));
  } catch (error) {
    fail("could not store verified package locally");
  }
  return { ...record, originalBytes: verified.originalBytes, package: verified.package };
}

export async function loadLatestPendingPackage(storage) {
  const records = readRecords(storage);
  if (records.length === 0) {
    return null;
  }
  const record = records.at(-1);
  if (record === null || typeof record !== "object" || typeof record.package_bytes_base64 !== "string" ||
      record.metadata?.status !== "pending") {
    fail("stored package record is invalid");
  }
  let originalBytes;
  try {
    originalBytes = base64ToBytes(record.package_bytes_base64);
  } catch (error) {
    fail("stored package bytes are invalid");
  }
  const verified = await verifySettingsPackage(originalBytes);
  return { ...record, originalBytes, package: verified.package };
}

export async function markDeviceVerified(storage, localId, sha256, now = new Date()) {
  const records = readRecords(storage);
  const index = records.findIndex((record) => record?.local_id === localId);
  if (index === -1) {
    fail("stored package record is unavailable");
  }
  const current = records[index];
  let originalBytes;
  try {
    originalBytes = base64ToBytes(current.package_bytes_base64);
  } catch (error) {
    fail("stored package bytes are invalid");
  }
  const verified = await verifySettingsPackage(originalBytes);
  if (verified.package.integrity.sha256 !== sha256) {
    fail("device verification identity does not match the stored package");
  }
  const updated = {
    ...current,
    metadata: {
      ...current.metadata,
      device_verified: true,
      device_verified_at: now.toISOString(),
      device_verified_sha256: sha256
    }
  };
  const next = [...records];
  next[index] = updated;
  try {
    storage.setItem(SETTINGS_PACKAGE_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    fail("could not store device verification metadata locally");
  }
  return { ...updated, originalBytes, package: verified.package };
}
