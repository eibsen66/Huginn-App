import { StatusPackageError, receiveStatusPackage } from "./status-package.mjs";

export const HUGINN_DIRECT_STATUS_EXPORT_URL =
  "https://192.168.4.1/api/v1/protected-state-export";
export const HUGINN_DIRECT_STATUS_EXPORT_MAX_BYTES = 32768;

function fail(message) {
  throw new StatusPackageError(message);
}

function jsonContentType(value) {
  return typeof value === "string" &&
    value.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

function contentLength(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value.trim())) {
    fail("HuginnEIS returned an invalid Content-Length");
  }
  const length = BigInt(value.trim());
  if (length === 0n || length > BigInt(HUGINN_DIRECT_STATUS_EXPORT_MAX_BYTES)) {
    fail("HuginnEIS status package size is not allowed");
  }
  return Number(length);
}

/*
 * This is the only network adapter for direct status receive.  The courier
 * remains responsible for verification and exact-byte local storage.
 */
export async function receiveDirectStatusPackage(
  storage,
  {
    fetchImpl = globalThis.fetch,
    receivePackage = receiveStatusPackage,
    now = new Date()
  } = {}) {

  if (typeof fetchImpl !== "function") fail("Browser fetch is unavailable");
  const response = await fetchImpl(HUGINN_DIRECT_STATUS_EXPORT_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (response === null || typeof response !== "object" || response.ok !== true) {
    fail("HuginnEIS did not return a successful status response");
  }
  if (response.headers === null || typeof response.headers?.get !== "function" ||
      !jsonContentType(response.headers.get("Content-Type"))) {
    fail("HuginnEIS returned an unexpected Content-Type");
  }
  const declaredLength = contentLength(response.headers.get("Content-Length"));
  if (typeof response.arrayBuffer !== "function") {
    fail("HuginnEIS returned an unreadable status response");
  }
  const rawBytes = new Uint8Array(await response.arrayBuffer());
  if (rawBytes.length === 0 || rawBytes.length > HUGINN_DIRECT_STATUS_EXPORT_MAX_BYTES) {
    fail("HuginnEIS status package size is not allowed");
  }
  if (declaredLength !== null && rawBytes.length !== declaredLength) {
    fail("HuginnEIS status response length does not match Content-Length");
  }
  return receivePackage(rawBytes, storage, now);
}
