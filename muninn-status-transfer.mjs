import {
  StatusPackageError,
  loadLatestStatusPackage,
  markStatusPackageTransferred,
  verifyStatusPackage
} from "./status-package.mjs";

export const MUNINN_STATUS_RECEIVER_URL =
  "http://127.0.0.1:8766/api/v1/protected-state-export";
export const MUNINN_STATUS_TRANSFER_TIMEOUT_MS = 8000;

function fail(message) {
  throw new StatusPackageError(message);
}

export function verifyMuninnAcknowledgement(response, packageValue) {
  const integrity = packageValue.integrity;
  if (response === null || typeof response !== "object" || Array.isArray(response) ||
      response.ok !== true || response.schema !== "huginn.protected-state-export" ||
      response.schema_version !== 1 || response.sha256 !== integrity.sha256 ||
      response.canonical_bytes !== Number(integrity.canonical_bytes)) {
    fail("Muninn acknowledgement does not match the verified status package");
  }
}

export async function transferStoredStatusPackage(
  storage,
  {
    fetchImpl = globalThis.fetch,
    loadPackage = loadLatestStatusPackage,
    verifyPackage = verifyStatusPackage,
    markTransferred = markStatusPackageTransferred,
    now = new Date(),
    timeoutMs = MUNINN_STATUS_TRANSFER_TIMEOUT_MS
  } = {}) {
  if (typeof fetchImpl !== "function") fail("Browser fetch is unavailable");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    fail("Muninn transfer timeout is invalid");
  }
  const stored = await loadPackage(storage);
  if (stored === null) fail("No verified Huginn status file is stored locally");
  const verified = await verifyPackage(stored.originalBytes);
  if (verified.package.integrity.sha256 !== stored.package.integrity.sha256 ||
      Number(verified.package.integrity.canonical_bytes) !==
        Number(stored.package.integrity.canonical_bytes)) {
    fail("Stored status package identity changed during local verification");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(MUNINN_STATUS_RECEIVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stored.originalBytes,
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) fail("Muninn status transfer timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  let acknowledgement;
  try {
    acknowledgement = await response.json();
  } catch {
    fail("Muninn returned an invalid status acknowledgement");
  }
  if (response === null || typeof response !== "object" || response.ok !== true) {
    fail("Muninn did not accept the status package");
  }
  verifyMuninnAcknowledgement(acknowledgement, verified.package);
  return markTransferred(storage, stored.local_id, verified.package.integrity.sha256, now);
}
