"use strict";

import {
  SettingsPackageError,
  loadLatestPendingPackage,
  markDeviceApplied,
  markDeviceVerified,
  receiveSettingsPackage,
  verifySettingsPackage
} from "./settings-package.mjs";
import {
  StatusPackageError,
  buildStatusPreview,
  loadLatestStatusPackage,
  receiveStatusPackage
} from "./status-package.mjs";
import { receiveDirectStatusPackage } from "./direct-status-receive.mjs";
import { transferStoredStatusPackage } from "./muninn-status-transfer.mjs";

const HUGINN_API_BASE_URL = "https://192.168.4.1";
const PING_URL = `${HUGINN_API_BASE_URL}/api/v1/ping`;
const INFO_URL = `${HUGINN_API_BASE_URL}/api/v1/info`;
const CONFIG_URL = `${HUGINN_API_BASE_URL}/api/v1/config`;
const SETTINGS_TRANSFER_VERIFY_URL =
  `${HUGINN_API_BASE_URL}/api/v1/settings-transfer/verify`;
const SETTINGS_TRANSFER_PREVIEW_URL =
  `${HUGINN_API_BASE_URL}/api/v1/settings-transfer/preview`;
const SETTINGS_TRANSFER_APPLY_URL =
  `${HUGINN_API_BASE_URL}/api/v1/settings-transfer/apply`;
const CACHE_KEYS = {
  info: "huginn.v1.info",
  config: "huginn.v1.config"
};
const INFO_FIELDS = [
  "product", "api_version", "build_id", "registration", "device_id",
  "uptime_seconds", "rtc_status", "sd_status", "can_status"
];

const pageOrigin = document.querySelector("#page-origin");
const secureContext = document.querySelector("#secure-context");
const localTime = document.querySelector("#local-time");
const resultTitle = document.querySelector("#result-title");
const resultSummary = document.querySelector("#result-summary");
const resultFields = document.querySelector("#result-fields");
const resultJson = document.querySelector("#result-json");
const resultDiagnostics = document.querySelector("#result-diagnostics");
const resultActionContext = document.querySelector("#result-action-context");
const resultActionContextBadge = document.querySelector("#result-action-context-badge");
const resultActionContextSupporting = document.querySelector("#result-action-context-supporting");
const pingButton = document.querySelector("#ping-button");
const infoButton = document.querySelector("#info-button");
const configButton = document.querySelector("#config-button");
const cachedInfoButton = document.querySelector("#cached-info-button");
const cachedConfigButton = document.querySelector("#cached-config-button");
const settingsImportButton = document.querySelector("#settings-import-button");
const settingsFileInput = document.querySelector("#settings-file-input");
const settingsVerifyButton = document.querySelector("#settings-verify-button");
const settingsPreviewButton = document.querySelector("#settings-preview-button");
const settingsApplyButton = document.querySelector("#settings-apply-button");
const settingsPreviewCancelButton = document.querySelector("#settings-preview-cancel-button");
const settingsApplyConfirmation = document.querySelector("#settings-apply-confirmation");
const settingsApplyConfirmationChanges = document.querySelector("#settings-apply-confirmation-changes");
const settingsApplyConfirmationButton = document.querySelector("#settings-apply-confirmation-button");
const statusImportButton = document.querySelector("#status-import-button");
const statusFileInput = document.querySelector("#status-file-input");
const statusReceiveButton = document.querySelector("#status-receive-button");
const statusPreviewButton = document.querySelector("#status-preview-button");
const statusTransferMuninnButton = document.querySelector("#status-transfer-muninn-button");
const clearButton = document.querySelector("#clear-button");

let pendingSettingsPreview = null;
const PENDING_MUNINN_STATUS_TEXT = "Verified — pending transfer to Muninn";

function updateBrowserContext() {
  pageOrigin.textContent = window.location.origin;
  secureContext.textContent = String(window.isSecureContext);
  localTime.textContent = new Date().toLocaleString();
}

function clearActionContext() {
  resultActionContextBadge.textContent = "";
  resultActionContextSupporting.textContent = "";
  resultActionContext.hidden = true;
}

function showActionContext(badge, supportingText) {
  resultActionContextBadge.textContent = badge;
  resultActionContextSupporting.textContent = supportingText;
  resultActionContext.hidden = false;
}

function clearResult() {
  resultTitle.textContent = "READY";
  resultSummary.textContent = "Choose a read-only Huginn API test.";
  resultFields.replaceChildren();
  resultFields.hidden = true;
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = "";
  resultDiagnostics.hidden = true;
  clearActionContext();
  pendingSettingsPreview = null;
  settingsApplyButton.hidden = true;
  settingsApplyButton.disabled = true;
  settingsPreviewCancelButton.hidden = true;
}

function showFields(data, fields) {
  resultFields.replaceChildren();
  for (const field of fields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = field;
    description.textContent = String(data[field] ?? "UNKNOWN");
    resultFields.append(term, description);
  }
  resultFields.hidden = false;
}

function showStoredSettingsPackage(stored) {
  const settings = stored.package.settings;
  const fuel = settings.fuel;
  const fields = {
    "Source": stored.metadata.source_product,
    "Created (UTC)": stored.metadata.created_at_utc,
    "Status": stored.metadata.device_applied
      ? "Applied to HuginnEIS"
      : stored.metadata.device_verified
      ? "Verified by HuginnEIS — not applied"
      : "Verified — pending transfer to HuginnEIS",
    "Brightness": `${settings.display.brightness_percent}%`,
    "Auto brightness": settings.display.auto_brightness ? "On" : "Off",
    "Units": Object.entries(settings.display.units).map(([name, value]) => `${name}: ${value}`).join(", "),
    "Fuel presets": fuel.presets.map((preset) =>
      `${preset.label} (RON ${preset.ron}, ${preset.is_avgas ? "AVGAS" : `E${preset.ethanol_percent}`})`).join("; "),
    "Default fuel preset": fuel.presets[fuel.default_preset_index].label
  };
  resultTitle.textContent = "Huginn SETTINGS FILE VERIFIED";
  resultSummary.textContent = stored.metadata.device_applied
    ? "Stored locally; device application was confirmed."
    : "Stored locally and pending transfer to HuginnEIS.";
  showFields(fields, Object.keys(fields));
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = "";
  resultDiagnostics.hidden = true;
  pendingSettingsPreview = null;
  settingsPreviewButton.disabled = !stored.metadata.device_verified;
  settingsApplyButton.hidden = true;
  settingsApplyButton.disabled = true;
  settingsPreviewCancelButton.hidden = true;
}

function verifyDeviceResponse(response, stored) {
  if (response === null || typeof response !== "object" || response.ok !== true ||
      response.schema !== "huginn.settings-transfer" || response.schema_version !== 1 ||
      response.sha256 !== stored.package.integrity.sha256 ||
      response.canonical_bytes !== stored.package.integrity.canonical_bytes) {
    throw new SettingsPackageError("HuginnEIS verification response does not match the stored package");
  }
}

function verifyDeviceChanges(response) {
  if (!Array.isArray(response?.changes)) {
    throw new SettingsPackageError("HuginnEIS response does not contain a valid change list");
  }
  for (const change of response.changes) {
    if (change === null || typeof change !== "object" || Array.isArray(change) ||
        typeof change.field !== "string" ||
        !Object.prototype.hasOwnProperty.call(change, "current") ||
        !Object.prototype.hasOwnProperty.call(change, "proposed")) {
      throw new SettingsPackageError("HuginnEIS response contains an invalid settings change");
    }
  }
}

function deviceTransferFailureMessage(category) {
  const messages = {
    "SETTINGS_MODAL_ACTIVE": "Close the Settings dialog on HuginnEIS, then preview again.",
    "AUTHORITY_UNAVAILABLE": "HuginnEIS settings authority is unavailable.",
    "PERSIST_FAILED": "HuginnEIS could not save the settings changes.",
    "READBACK_FAILED": "HuginnEIS could not verify the saved settings changes.",
    "QUEUE_FAILED": "HuginnEIS could not queue the settings change.",
    "APPLY_TIMEOUT": "HuginnEIS apply timed out; preview again before retrying."
  };
  return messages[category] ?? "HuginnEIS did not accept the settings package.";
}

async function loadDeviceVerifiedSettingsPackage() {
  const stored = await loadLatestPendingPackage(window.localStorage);
  if (stored === null || !stored.metadata.device_verified ||
      stored.metadata.device_verified_sha256 !== stored.package.integrity.sha256) {
    throw new SettingsPackageError("Verify this Huginn settings file with HuginnEIS before previewing changes");
  }
  const verified = await verifySettingsPackage(stored.originalBytes);
  return { ...stored, originalBytes: stored.originalBytes, package: verified.package };
}

async function postStoredSettingsPackage(url, stored, action) {
  const verified = await verifySettingsPackage(stored.originalBytes);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stored.originalBytes,
    cache: "no-store"
  });
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new SettingsPackageError(`HuginnEIS returned an invalid ${action} response`);
  }
  if (!response.ok || payload?.ok !== true) {
    const category = payload?.error ?? payload?.reason ?? "unknown";
    throw new SettingsPackageError(
      `HuginnEIS ${action} was not accepted (${category}): ${deviceTransferFailureMessage(category)}`);
  }
  verifyDeviceResponse(payload, { ...stored, package: verified.package });
  verifyDeviceChanges(payload);
  return payload;
}

function friendlySettingsField(field) {
  const names = {
    "display.brightness_percent": "Brightness",
    "display.auto_brightness": "Auto brightness",
    "display.units.altitude": "Altitude unit",
    "display.units.baro": "Barometer unit",
    "display.units.fuel": "Fuel unit",
    "display.units.pressure": "Pressure unit",
    "display.units.speed": "Speed unit",
    "display.units.temperature": "Temperature unit",
    "fuel.default_preset_index": "Default fuel preset"
  };
  if (names[field]) {
    return names[field];
  }
  const preset = /^fuel\.presets\[(\d+)\]\.(ethanol_percent|is_avgas|label|ron)$/.exec(field);
  if (preset) {
    return `Fuel preset ${Number(preset[1]) + 1} ${preset[2].replaceAll("_", " ")}`;
  }
  return field;
}

function friendlySettingsValue(value) {
  return typeof value === "boolean" ? (value ? "On" : "Off") : String(value);
}

function settingsChangesFields(changes) {
  const fields = {};
  for (const change of changes) {
    fields[friendlySettingsField(change.field)] =
      `${friendlySettingsValue(change.current)} → ${friendlySettingsValue(change.proposed)}`;
  }
  return fields;
}

function showSettingsPreview(stored, response) {
  pendingSettingsPreview = {
    localId: stored.local_id,
    sha256: stored.package.integrity.sha256,
    changes: response.changes
  };
  resultFields.replaceChildren();
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = "";
  resultDiagnostics.hidden = true;
  showActionContext(
    "PREVIEWED WITH HuginnEIS",
    "Settings changes received from HuginnEIS");
  if (response.changes.length === 0) {
    resultTitle.textContent = "NO SETTINGS CHANGES REQUIRED";
    resultSummary.textContent = "HuginnEIS already matches this settings file.";
    resultFields.hidden = true;
    settingsApplyButton.hidden = true;
    settingsApplyButton.disabled = true;
    settingsPreviewCancelButton.hidden = true;
    return;
  }

  resultTitle.textContent = "SETTINGS CHANGES";
  resultSummary.textContent = "Device-computed changes. Review before applying.";
  const fields = settingsChangesFields(response.changes);
  showFields(fields, Object.keys(fields));
  settingsApplyButton.hidden = false;
  settingsApplyButton.disabled = false;
  settingsPreviewCancelButton.hidden = false;
}

function showSettingsTransferFailure(title, summary, error) {
  clearActionContext();
  pendingSettingsPreview = null;
  settingsApplyButton.hidden = true;
  settingsApplyButton.disabled = true;
  settingsPreviewCancelButton.hidden = true;
  resultTitle.textContent = title;
  resultSummary.textContent = summary;
  resultFields.replaceChildren();
  resultFields.hidden = true;
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = error instanceof SettingsPackageError
    ? error.message : String(error);
  resultDiagnostics.hidden = false;
}

async function previewPendingSettingsPackageWithHuginnEis() {
  clearResult();
  resultTitle.textContent = "PREVIEWING SETTINGS CHANGES";
  try {
    const stored = await loadDeviceVerifiedSettingsPackage();
    const response = await postStoredSettingsPackage(
      SETTINGS_TRANSFER_PREVIEW_URL, stored, "preview");
    showSettingsPreview(stored, response);
  } catch (error) {
    showSettingsTransferFailure(
      "SETTINGS PREVIEW NOT CONFIRMED",
      "The stored settings file was not applied.",
      error);
  }
}

function previewMatchesApply(previewChanges, applyChanges) {
  if (previewChanges.length !== applyChanges.length) {
    return false;
  }
  const applied = new Map(applyChanges.map((change) => [
    `${change.field}\u0000${JSON.stringify(change.proposed)}`, true
  ]));
  return previewChanges.every((change) => applied.has(
    `${change.field}\u0000${JSON.stringify(change.proposed)}`));
}

function openSettingsApplyConfirmation() {
  if (pendingSettingsPreview === null || pendingSettingsPreview.changes.length === 0) {
    return;
  }
  settingsApplyConfirmationChanges.replaceChildren();
  const fields = settingsChangesFields(pendingSettingsPreview.changes);
  for (const [field, value] of Object.entries(fields)) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = field;
    description.textContent = value;
    settingsApplyConfirmationChanges.append(term, description);
  }
  settingsApplyConfirmation.showModal();
}

async function applyPreviewedSettingsPackageToHuginnEis() {
  const preview = pendingSettingsPreview;
  if (preview === null || preview.changes.length === 0) {
    return;
  }
  settingsApplyConfirmation.close();
  settingsApplyButton.hidden = true;
  settingsApplyButton.disabled = true;
  settingsPreviewCancelButton.hidden = true;
  clearResult();
  resultTitle.textContent = "Applying settings to HuginnEIS";
  try {
    const stored = await loadDeviceVerifiedSettingsPackage();
    if (stored.local_id !== preview.localId ||
        stored.package.integrity.sha256 !== preview.sha256) {
      throw new SettingsPackageError("Stored package changed; preview again before applying");
    }
    const response = await postStoredSettingsPackage(
      SETTINGS_TRANSFER_APPLY_URL, stored, "apply");
    if (response.applied !== true) {
      throw new SettingsPackageError("HuginnEIS did not confirm that the settings changes were applied");
    }
    if (!previewMatchesApply(preview.changes, response.changes)) {
      throw new SettingsPackageError("HuginnEIS apply result changed; preview again before applying");
    }
    const applied = await markDeviceApplied(
      window.localStorage, stored.local_id, stored.package.integrity.sha256);
    showStoredSettingsPackage(applied);
    showActionContext(
      "APPLIED TO HuginnEIS",
      "Settings applied successfully to HuginnEIS");
    resultTitle.textContent = "Applied to HuginnEIS";
    resultSummary.textContent = `${response.changes.length} device-confirmed settings change(s) applied.`;
  } catch (error) {
    showSettingsTransferFailure(
      "SETTINGS APPLY NOT CONFIRMED",
      "The stored settings file remains available and was not marked applied.",
      error);
  }
}

async function verifyPendingSettingsPackageWithHuginnEis() {
  clearResult();
  resultTitle.textContent = "Verifying with HuginnEIS";
  try {
    const stored = await loadLatestPendingPackage(window.localStorage);
    if (stored === null) {
      throw new SettingsPackageError("No verified pending Huginn settings file is stored locally");
    }
    const response = await fetch(SETTINGS_TRANSFER_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stored.originalBytes,
      cache: "no-store"
    });
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new SettingsPackageError("HuginnEIS returned an invalid verification response");
    }
    if (!response.ok) {
      throw new SettingsPackageError(`HuginnEIS rejected the package: ${payload?.error ?? "unknown"}`);
    }
    verifyDeviceResponse(payload, stored);
    showStoredSettingsPackage(await markDeviceVerified(
      window.localStorage, stored.local_id, stored.package.integrity.sha256));
    showActionContext(
      "VERIFIED WITH HuginnEIS",
      "Settings file verified by HuginnEIS");
  } catch (error) {
    clearActionContext();
    resultTitle.textContent = "HuginnEIS verification not confirmed";
    resultSummary.textContent = "The verified package remains pending and was not applied.";
    resultFields.replaceChildren();
    resultFields.hidden = true;
    resultJson.textContent = "";
    resultJson.hidden = true;
    resultDiagnostics.textContent = error instanceof SettingsPackageError ? error.message : String(error);
    resultDiagnostics.hidden = false;
  }
}

function showSettingsImportFailure(error) {
  clearActionContext();
  resultTitle.textContent = "Huginn SETTINGS FILE NOT ACCEPTED";
  resultSummary.textContent = "The file was not stored and is not pending transfer.";
  resultFields.replaceChildren();
  resultFields.hidden = true;
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = error instanceof SettingsPackageError ? error.message : String(error);
  resultDiagnostics.hidden = false;
}

async function importSettingsFile(file) {
  clearResult();
  resultTitle.textContent = "VERIFYING Huginn SETTINGS FILE";
  resultSummary.textContent = file.name;
  try {
    const stored = await receiveSettingsPackage(new Uint8Array(await file.arrayBuffer()), window.localStorage);
    showStoredSettingsPackage(stored);
    showActionContext(
      "IMPORTED FROM FILE",
      "Huginn settings file imported and verified");
  } catch (error) {
    showSettingsImportFailure(error);
  }
}

async function showStoredPendingSettingsPackage() {
  try {
    const stored = await loadLatestPendingPackage(window.localStorage);
    if (stored !== null) {
      showStoredSettingsPackage(stored);
      clearActionContext();
    }
  } catch (error) {
    showSettingsImportFailure(error);
  }
}

function statusTransferredToMuninn(stored) {
  const metadata = stored.metadata;
  return metadata.muninn_transferred === true &&
    metadata.pending_muninn_transfer === false &&
    metadata.muninn_transferred_sha256 === stored.package.integrity.sha256 &&
    metadata.muninn_transferred_canonical_bytes ===
      Number(stored.package.integrity.canonical_bytes);
}

async function refreshStatusTransferAvailability() {
  try {
    statusTransferMuninnButton.disabled = (await loadLatestStatusPackage(window.localStorage)) === null;
  } catch {
    statusTransferMuninnButton.disabled = true;
  }
}

function showStoredStatusPackage(stored) {
  const transferred = statusTransferredToMuninn(stored);
  const fields = buildStatusPreview(stored.package);
  fields.Status = transferred
    ? "Verified \u2014 transferred to Muninn"
    : PENDING_MUNINN_STATUS_TEXT;
  resultTitle.textContent = "Huginn STATUS FILE VERIFIED";
  resultSummary.textContent = fields.Status;
  resultSummary.textContent = fields.Status;
  showFields(fields, Object.keys(fields));
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = "";
  resultDiagnostics.hidden = true;
  statusTransferMuninnButton.disabled = false;
}

function showStatusImportFailure(error) {
  clearActionContext();
  resultTitle.textContent = "Huginn STATUS FILE NOT ACCEPTED";
  resultSummary.textContent = "The file was not stored and is not pending transfer to Muninn.";
  resultFields.replaceChildren();
  resultFields.hidden = true;
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = error instanceof StatusPackageError ? error.message : String(error);
  resultDiagnostics.hidden = false;
}

async function importStatusFile(file) {
  clearResult();
  resultTitle.textContent = "VERIFYING Huginn STATUS FILE";
  resultSummary.textContent = file.name;
  try {
    const stored = await receiveStatusPackage(
      new Uint8Array(await file.arrayBuffer()), window.localStorage);
    showStoredStatusPackage(stored);
    showActionContext(
      "IMPORTED FROM FILE",
      "Huginn status file imported and verified");
  } catch (error) {
    showStatusImportFailure(error);
  }
}

async function showStoredStatusPackagePreview() {
  try {
    const stored = await loadLatestStatusPackage(window.localStorage);
    if (stored === null) {
      throw new StatusPackageError("No verified Huginn status file is stored locally");
    }
    showStoredStatusPackage(stored);
    showActionContext(
      "STORED STATUS",
      "Showing latest verified Huginn status");
  } catch (error) {
    showStatusImportFailure(error);
  }
}

async function transferStatusToMuninn() {
  clearResult();
  resultTitle.textContent = "TRANSFERRING STATUS TO Muninn";
  resultSummary.textContent = "Sending the locally verified status package to Muninn.";
  try {
    const stored = await transferStoredStatusPackage(window.localStorage);
    showStoredStatusPackage(stored);
    showActionContext(
      "TRANSFERRED TO Muninn",
      "Status package accepted and verified by Muninn");
    resultTitle.textContent = "Transferred to Muninn";
    resultSummary.textContent = "Status package accepted and verified by Muninn.";
  } catch (error) {
    clearActionContext();
    try {
      const stored = await loadLatestStatusPackage(window.localStorage);
      if (stored !== null) showStoredStatusPackage(stored);
    } catch {
      statusTransferMuninnButton.disabled = true;
    }
    resultTitle.textContent = "Muninn transfer not confirmed";
    resultSummary.textContent = "The verified status package remains available and was not falsely marked transferred.";
    resultDiagnostics.textContent = error instanceof StatusPackageError ? error.message : String(error);
    resultDiagnostics.hidden = false;
  }
}

async function receiveStatusFromHuginnEis() {
  clearResult();
  resultTitle.textContent = "RECEIVING Huginn STATUS";
  resultSummary.textContent = "Receiving a read-only status package from HuginnEIS.";
  try {
    const stored = await receiveDirectStatusPackage(window.localStorage, {
      fetchImpl: window.fetch.bind(window)
    });
    showStoredStatusPackage(stored);
    showActionContext(
      "RECEIVED FROM HuginnEIS",
      "Huginn status received and verified");
  } catch (error) {
    showStatusImportFailure(error);
  }
}

function validateInfo(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Malformed info response: expected an object");
  }
  for (const field of ["product", "build_id", "registration", "device_id",
    "rtc_status", "sd_status", "can_status"]) {
    requireInfoField(data, field, "string");
  }
  for (const field of ["api_version", "uptime_seconds"]) {
    requireInfoField(data, field, "number");
  }
}

function showInfoFields(data) {
  showFields(data, INFO_FIELDS);
}

function requireInfoField(data, field, expectedType) {
  if (data[field] === undefined || typeof data[field] !== expectedType) {
    throw new Error(`Malformed info response: ${field} is missing or invalid`);
  }
}

function requireConfigField(data, field, expectedType) {
  if (data[field] === undefined || typeof data[field] !== expectedType) {
    throw new Error(`Malformed config response: ${field} is missing or invalid`);
  }
}

function validateConfig(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Malformed config response: expected an object");
  }

  for (const field of ["registration", "engine_name", "pressure_unit",
    "temperature_unit", "speed_unit", "barometric_pressure_unit",
    "altitude_unit", "fuel_unit"]) {
    requireConfigField(data, field, "string");
  }
  for (const field of ["cylinders", "fuel_total_l", "fuel_usable_l",
    "cruise_fuel_burn_tenths_lph", "cht_max_diff_c", "default_fuel_slot",
    "brightness_percent"]) {
    requireConfigField(data, field, "number");
  }
  for (const field of ["turbo", "auto_brightness"]) {
    requireConfigField(data, field, "boolean");
  }
  if (!Array.isArray(data.fuel_presets) || data.fuel_presets.length !== 3) {
    throw new Error("Malformed config response: fuel_presets must contain three entries");
  }
  for (let index = 0; index < data.fuel_presets.length; index += 1) {
    const preset = data.fuel_presets[index];
    if (preset === null || typeof preset !== "object" || Array.isArray(preset)) {
      throw new Error(`Malformed config response: fuel_presets[${index}] is invalid`);
    }
    for (const field of ["ron", "ethanol_percent"]) {
      requireConfigField(preset, field, "number");
    }
    for (const field of ["is_avgas"]) {
      requireConfigField(preset, field, "boolean");
    }
    requireConfigField(preset, "display_name", "string");
  }
}

function showConfigFields(data) {
  const fields = [
    "registration", "engine_name", "cylinders", "turbo",
    "fuel_total_l", "fuel_usable_l", "cruise_fuel_burn_tenths_lph",
    "cht_max_diff_c", "default_fuel_slot", "pressure_unit",
    "temperature_unit", "speed_unit", "barometric_pressure_unit",
    "altitude_unit", "fuel_unit", "brightness_percent", "auto_brightness"
  ];
  const presentation = { ...data };
  for (let index = 0; index < data.fuel_presets.length; index += 1) {
    const preset = data.fuel_presets[index];
    presentation[`fuel_presets[${index}].ron`] = preset.ron;
    presentation[`fuel_presets[${index}].ethanol_percent`] = preset.ethanol_percent;
    presentation[`fuel_presets[${index}].is_avgas`] = preset.is_avgas;
    presentation[`fuel_presets[${index}].display_name`] = preset.display_name;
    fields.push(
      `fuel_presets[${index}].ron`,
      `fuel_presets[${index}].ethanol_percent`,
      `fuel_presets[${index}].is_avgas`,
      `fuel_presets[${index}].display_name`
    );
  }
  showFields(presentation, fields);
}

function saveCachedResponse(cacheType, data, validator) {
  try {
    validator(data);
    const serialized = JSON.stringify({
      received_at: new Date().toISOString(),
      data
    });
    localStorage.setItem(CACHE_KEYS[cacheType], serialized);
  } catch (error) {
    /* Live display remains authoritative even if browser cache is unavailable. */
  }
}

function readCachedResponse(cacheType, validator) {
  let serialized;
  let receivedAt;
  try {
    serialized = localStorage.getItem(CACHE_KEYS[cacheType]);
  } catch (error) {
    throw new Error(`Cache storage unavailable: ${error.message}`);
  }
  if (serialized === null) {
    return null;
  }

  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Cached JSON is invalid: ${error.message}`);
  }
  if (envelope === null || typeof envelope !== "object" ||
    Array.isArray(envelope) ||
    !Object.prototype.hasOwnProperty.call(envelope, "data")) {
    throw new Error("Cached response envelope is invalid");
  }
  validator(envelope.data);
  receivedAt = envelope.received_at;
  return { data: envelope.data, receivedAt };
}

function cachedTimestamp(receivedAt) {
  if (typeof receivedAt !== "string" || receivedAt === "") {
    return "UNKNOWN";
  }
  const timestamp = new Date(receivedAt);
  return Number.isNaN(timestamp.getTime()) ? "UNKNOWN" : timestamp.toLocaleString();
}

function showCachedFailure(cacheLabel, error) {
  resultTitle.textContent = `INVALID CACHED HUGINN ${cacheLabel}`;
  resultSummary.textContent = "OFFLINE / CACHED data could not be used.";
  resultFields.replaceChildren();
  resultFields.hidden = true;
  resultJson.textContent = "";
  resultJson.hidden = true;
  resultDiagnostics.textContent = String(error);
  resultDiagnostics.hidden = false;
}

function showCachedResponse(cacheType, cacheLabel, validator, showPresentation) {
  clearResult();
  let cached;
  try {
    cached = readCachedResponse(cacheType, validator);
  } catch (error) {
    showCachedFailure(cacheLabel, error);
    return;
  }
  if (cached === null) {
    resultTitle.textContent = `NO CACHED HUGINN ${cacheLabel}`;
    resultSummary.textContent = "OFFLINE / CACHED: no saved response is available.";
    return;
  }

  resultTitle.textContent = `CACHED HUGINN ${cacheLabel}`;
  resultSummary.textContent =
    `OFFLINE / CACHED\nLast synchronized: ${cachedTimestamp(cached.receivedAt)}`;
  showPresentation(cached.data);
  resultJson.textContent = JSON.stringify(cached.data, null, 2);
  resultJson.hidden = false;
}

function showFailure(error, targetUrl) {
  resultTitle.textContent = "HuginnEIS not connected";
  resultSummary.textContent =
    "Live HuginnEIS access is unavailable. Importing a Huginn settings file remains available. " +
    "The technical connection diagnostic is shown below.";
  resultFields.replaceChildren();
  resultFields.hidden = true;
  resultJson.hidden = true;
  resultDiagnostics.textContent = [
    `error.name: ${error?.name ?? "UNKNOWN"}`,
    `error.message: ${error?.message ?? "UNKNOWN"}`,
    `error.toString(): ${String(error)}`,
    `page protocol: ${window.location.protocol}`,
    `page origin: ${window.location.origin}`,
    `window.isSecureContext: ${String(window.isSecureContext)}`,
    `target URL: ${targetUrl}`
  ].join("\n");
  resultDiagnostics.hidden = false;
}

async function requestHuginn(targetUrl, infoResponse, configResponse = false) {
  clearResult();
  resultTitle.textContent = "CONNECTING…";
  resultSummary.textContent = targetUrl;
  const startedAt = performance.now();

  try {
    const response = await fetch(targetUrl, { method: "GET", cache: "no-store" });
    const elapsedMilliseconds = Math.round(performance.now() - startedAt);
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch (error) {
      throw new Error(`HTTP ${response.status}; response was not valid JSON: ${body}`);
    }

    if (!response.ok) {
      throw new Error(`Huginn returned HTTP ${response.status}`);
    }

    if (infoResponse) {
      validateInfo(data);
    }
    if (configResponse) {
      validateConfig(data);
    }

    resultTitle.textContent = (infoResponse || configResponse)
      ? "CONNECTED TO HUGINN" : "CONNECTED";
    resultSummary.textContent = `HTTP ${response.status} · ${elapsedMilliseconds} ms`;
    if (infoResponse) {
      showInfoFields(data);
      saveCachedResponse("info", data, validateInfo);
    }
    if (configResponse) {
      showConfigFields(data);
      saveCachedResponse("config", data, validateConfig);
    }
    resultJson.textContent = JSON.stringify(data, null, 2);
    resultJson.hidden = false;
  } catch (error) {
    showFailure(error, targetUrl);
  }
}

pingButton.addEventListener("click", () => requestHuginn(PING_URL, false));
infoButton.addEventListener("click", () => requestHuginn(INFO_URL, true));
configButton.addEventListener("click", () => requestHuginn(CONFIG_URL, false, true));
cachedInfoButton.addEventListener("click", () =>
  showCachedResponse("info", "INFO", validateInfo, showInfoFields));
cachedConfigButton.addEventListener("click", () =>
  showCachedResponse("config", "CONFIG", validateConfig, showConfigFields));
settingsImportButton.addEventListener("click", () => settingsFileInput.click());
settingsFileInput.addEventListener("change", async () => {
  const [file] = settingsFileInput.files;
  settingsFileInput.value = "";
  if (file) {
    await importSettingsFile(file);
  }
});
settingsVerifyButton.addEventListener("click", () => void verifyPendingSettingsPackageWithHuginnEis());
settingsPreviewButton.addEventListener("click", () => void previewPendingSettingsPackageWithHuginnEis());
settingsApplyButton.addEventListener("click", openSettingsApplyConfirmation);
settingsPreviewCancelButton.addEventListener("click", () => void showStoredPendingSettingsPackage());
settingsApplyConfirmationButton.addEventListener("click", () => void applyPreviewedSettingsPackageToHuginnEis());
statusImportButton.addEventListener("click", () => statusFileInput.click());
statusFileInput.addEventListener("change", async () => {
  const [file] = statusFileInput.files;
  statusFileInput.value = "";
  if (file) {
    await importStatusFile(file);
  }
});
statusReceiveButton.addEventListener("click", () => void receiveStatusFromHuginnEis());
statusPreviewButton.addEventListener("click", () => void showStoredStatusPackagePreview());
statusTransferMuninnButton.addEventListener("click", () => void transferStatusToMuninn());
clearButton.addEventListener("click", clearResult);

updateBrowserContext();
window.setInterval(updateBrowserContext, 1000);
void showStoredPendingSettingsPackage();
void refreshStatusTransferAvailability();
