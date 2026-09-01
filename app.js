"use strict";

const HUGINN_API_BASE_URL = "https://192.168.4.1";
const PING_URL = `${HUGINN_API_BASE_URL}/api/v1/ping`;
const INFO_URL = `${HUGINN_API_BASE_URL}/api/v1/info`;
const CONFIG_URL = `${HUGINN_API_BASE_URL}/api/v1/config`;
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
const pingButton = document.querySelector("#ping-button");
const infoButton = document.querySelector("#info-button");
const configButton = document.querySelector("#config-button");
const cachedInfoButton = document.querySelector("#cached-info-button");
const cachedConfigButton = document.querySelector("#cached-config-button");
const clearButton = document.querySelector("#clear-button");

function updateBrowserContext() {
  pageOrigin.textContent = window.location.origin;
  secureContext.textContent = String(window.isSecureContext);
  localTime.textContent = new Date().toLocaleString();
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
  resultTitle.textContent = "CONNECTION FAILED";
  resultSummary.textContent =
    "The browser blocked or failed the HTTPS page -> local HTTP Huginn request. " +
    "The exact browser error shown below is the important PoC result.";
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
clearButton.addEventListener("click", clearResult);

updateBrowserContext();
window.setInterval(updateBrowserContext, 1000);
