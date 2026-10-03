import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function sources() {
  const [app, html, css] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8")
  ]);
  return { app, html, css };
}

function actionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`) >= 0
    ? source.indexOf(`function ${name}`)
    : source.indexOf(`async function ${name}`);
  const end = source.indexOf(nextName, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} must end before ${nextName}`);
  return source.slice(start, end);
}

test("action context markup uses a solid, visible amber banner selector", async () => {
  const { html, css } = await sources();
  assert.match(html, /id="result-action-context" class="result-action-context" hidden/);
  assert.match(html, /id="result-action-context-badge"/);
  assert.match(html, /id="result-action-context-supporting"/);
  const banner = css.match(/\.result-action-context \{([^}]*)\}/)?.[1] ?? "";
  assert.match(banner, /background: #ffe8a3/);
  assert.doesNotMatch(banner, /rgba\(|transparent/);
  assert.match(banner, /border: 1px solid #b7791f/);
  assert.match(banner, /border-radius: 0\.55rem/);
  assert.match(banner, /color: #3f2a00/);
  assert.match(css, /\.result-action-context-badge \{[\s\S]*color: #5b3a00/);
});

test("each successful result action identifies its source without changing its preview", async () => {
  const { app } = await sources();
  const cases = [
    ["importStatusFile", "showStoredStatusPackagePreview", "IMPORTED FROM FILE", "Huginn status file imported and verified"],
    ["showStoredStatusPackagePreview", "receiveStatusFromHuginnEis", "STORED STATUS", "Showing latest verified Huginn status"],
    ["receiveStatusFromHuginnEis", "validateInfo", "RECEIVED FROM HuginnEIS", "Huginn status received and verified"],
    ["importSettingsFile", "showStoredPendingSettingsPackage", "IMPORTED FROM FILE", "Huginn settings file imported and verified"],
    ["verifyPendingSettingsPackageWithHuginnEis", "showSettingsImportFailure", "VERIFIED WITH HuginnEIS", "Settings file verified by HuginnEIS"],
    ["showSettingsPreview", "showSettingsTransferFailure", "PREVIEWED WITH HuginnEIS", "Settings changes received from HuginnEIS"],
    ["applyPreviewedSettingsPackageToHuginnEis", "verifyPendingSettingsPackageWithHuginnEis", "APPLIED TO HuginnEIS", "Settings applied successfully to HuginnEIS"]
  ];
  for (const [name, next, badge, supporting] of cases) {
    const block = actionBlock(app, name, next);
    assert.match(block, new RegExp(`showActionContext\\([\\s\\S]*${badge}`));
    assert.match(block, new RegExp(supporting));
  }
});

test("failure and clear paths remove successful action context", async () => {
  const { app } = await sources();
  for (const [name, next] of [
    ["clearResult", "function showFields"],
    ["showSettingsTransferFailure", "async function previewPendingSettingsPackageWithHuginnEis"],
    ["showSettingsImportFailure", "async function importSettingsFile"],
    ["showStatusImportFailure", "async function importStatusFile"]
  ]) {
    assert.match(actionBlock(app, name, next), /clearActionContext\(\)/);
  }
  const verify = actionBlock(app, "verifyPendingSettingsPackageWithHuginnEis", "function showSettingsImportFailure");
  assert.match(verify, /catch \(error\) \{[\s\S]*clearActionContext\(\)/);
});

test("action context stays presentation-only", async () => {
  const { app } = await sources();
  const context = actionBlock(app, "showActionContext", "function clearResult");
  assert.doesNotMatch(context, /fetch|localStorage|receiveStatusPackage|receiveSettingsPackage|markDevice|POST|GET/i);
  assert.match(app, /function showStoredStatusPackage\(stored\)/);
  assert.match(app, /function showStoredSettingsPackage\(stored\)/);
});

test("rendered product names retain their authoritative casing", async () => {
  const { app, html } = await sources();
  const [direct, status, settings] = await Promise.all([
    readFile(new URL("../direct-status-receive.mjs", import.meta.url), "utf8"),
    readFile(new URL("../status-package.mjs", import.meta.url), "utf8"),
    readFile(new URL("../settings-package.mjs", import.meta.url), "utf8")
  ]);
  const renderedText = [app, html, direct, status, settings]
    .flatMap((source) => Array.from(
      source.matchAll(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g),
      (match) => match[0]));
  assert.doesNotMatch(renderedText.join("\n"), /\b(?:HUGINNEIS|HUGINNAPP|MUNINN)\b/);
  assert.match(html, /HUGINN CONNECTIVITY TEST/);
});
