"use strict";

const HUGINN_API_BASE_URL = "http://192.168.4.1";
const PING_URL = `${HUGINN_API_BASE_URL}/api/v1/ping`;
const INFO_URL = `${HUGINN_API_BASE_URL}/api/v1/info`;

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

async function requestHuginn(targetUrl, infoResponse) {
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

    resultTitle.textContent = infoResponse ? "CONNECTED TO HUGINN" : "CONNECTED";
    resultSummary.textContent = `HTTP ${response.status} · ${elapsedMilliseconds} ms`;
    if (infoResponse) {
      showFields(data, [
        "product", "api_version", "build_id", "registration", "device_id",
        "uptime_seconds", "rtc_status", "sd_status", "can_status"
      ]);
    }
    resultJson.textContent = JSON.stringify(data, null, 2);
    resultJson.hidden = false;
  } catch (error) {
    showFailure(error, targetUrl);
  }
}

pingButton.addEventListener("click", () => requestHuginn(PING_URL, false));
infoButton.addEventListener("click", () => requestHuginn(INFO_URL, true));
clearButton.addEventListener("click", clearResult);

updateBrowserContext();
window.setInterval(updateBrowserContext, 1000);
