"use strict";

/*
 * Browser-side, read-only verifier for HUGINN_PROTECTED_STATE_EXPORT_V1.
 * This is deliberately separate from settings-package.mjs: the received
 * bytes are a status courier payload and never an aircraft apply payload.
 */
export const STATUS_PACKAGE_SCHEMA = "huginn.protected-state-export";
export const STATUS_PACKAGE_VERSION = 1;
export const STATUS_PACKAGE_STORAGE_KEY = "huginn.v1.status-package";

const U32_MAX = 4294967295n;
const U64_MAX = 18446744073709551615n;
const I64_MAX = 9223372036854775807n;
const I64_MAGNITUDE = I64_MAX + 1n;
const FORBIDDEN_KEYS = new Set([
  "raw_nvs", "slot_a", "slot_b", "crc", "maintenance_intent", "hfs2", "demo"
]);
const PRESETS = new Set([
  "91|5|false|91 OCT E5", "91|10|false|91 OCT E10",
  "95|5|false|95 OCT E5", "95|10|false|95 OCT E10",
  "95|15|false|95 OCT E15", "95|20|false|95 OCT E20",
  "98|5|false|98 OCT E5", "98|10|false|98 OCT E10",
  "91|0|true|AVGAS UL91", "100|0|true|AVGAS 100LL"
]);
const PARAMETER_NAMES = [
  "VOLTS", "OIL_TEMPERATURE", "MANIFOLD_AIR_TEMPERATURE", "FUEL_PRESSURE",
  "FUEL_FLOW", "THROTTLE_POSITION", "OIL_PRESSURE", "EGT", "CHT",
  "OUTSIDE_AIR_TEMPERATURE", "ECU_AMBIENT_TEMPERATURE", "UCT",
  "FUEL_TEMPERATURE", "HEATER_TEMPERATURE", "RPM"
];

export class StatusPackageError extends Error {}

function fail(message) {
  throw new StatusPackageError(message);
}

class StrictJsonParser {
  constructor(text) {
    this.text = text;
    this.index = 0;
  }

  parse() {
    this.whitespace();
    const value = this.value();
    this.whitespace();
    if (this.index !== this.text.length) {
      fail("package is not valid JSON");
    }
    return value;
  }

  whitespace() {
    while (" \n\r\t".includes(this.text[this.index])) {
      this.index++;
    }
  }

  take(character) {
    if (this.text[this.index] === character) {
      this.index++;
      return true;
    }
    return false;
  }

  value() {
    this.whitespace();
    const character = this.text[this.index];
    if (character === "{") return this.object();
    if (character === "[") return this.array();
    if (character === "\"") return this.string();
    if (this.text.startsWith("null", this.index)) {
      this.index += 4;
      return null;
    }
    if (this.text.startsWith("true", this.index)) {
      this.index += 4;
      return true;
    }
    if (this.text.startsWith("false", this.index)) {
      this.index += 5;
      return false;
    }
    return this.integer();
  }

  object() {
    this.index++;
    this.whitespace();
    const result = Object.create(null);
    if (this.take("}")) return result;
    for (;;) {
      if (this.text[this.index] !== "\"") fail("package is not valid JSON");
      const key = this.string();
      if (Object.hasOwn(result, key)) fail("package has a duplicate key");
      this.whitespace();
      if (!this.take(":")) fail("package is not valid JSON");
      result[key] = this.value();
      this.whitespace();
      if (this.take("}")) return result;
      if (!this.take(",")) fail("package is not valid JSON");
      this.whitespace();
    }
  }

  array() {
    this.index++;
    this.whitespace();
    const result = [];
    if (this.take("]")) return result;
    for (;;) {
      result.push(this.value());
      this.whitespace();
      if (this.take("]")) return result;
      if (!this.take(",")) fail("package is not valid JSON");
      this.whitespace();
    }
  }

  string() {
    if (!this.take("\"")) fail("package is not valid JSON");
    let result = "";
    while (this.index < this.text.length) {
      const character = this.text[this.index++];
      if (character === "\"") return result;
      if (character < " ") fail("package is not valid JSON");
      if (character !== "\\") {
        result += character;
        continue;
      }
      const escape = this.text[this.index++];
      if (escape === "\"" || escape === "\\" || escape === "/") result += escape;
      else if (escape === "b") result += "\b";
      else if (escape === "f") result += "\f";
      else if (escape === "n") result += "\n";
      else if (escape === "r") result += "\r";
      else if (escape === "t") result += "\t";
      else if (escape === "u") result += this.unicodeEscape();
      else fail("package is not valid JSON");
    }
    fail("package is not valid JSON");
  }

  unicodeEscape() {
    const code = this.hexCode();
    if (code >= 0xd800 && code <= 0xdbff) {
      if (!this.take("\\") || !this.take("u")) fail("package is not valid JSON");
      const low = this.hexCode();
      if (low < 0xdc00 || low > 0xdfff) fail("package is not valid JSON");
      return String.fromCodePoint(0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00));
    }
    if (code >= 0xdc00 && code <= 0xdfff) fail("package is not valid JSON");
    return String.fromCodePoint(code);
  }

  hexCode() {
    const digits = this.text.slice(this.index, this.index + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail("package is not valid JSON");
    this.index += 4;
    return Number.parseInt(digits, 16);
  }

  integer() {
    const start = this.index;
    const negative = this.take("-");
    if (!/[0-9]/.test(this.text[this.index] ?? "")) fail("package is not valid JSON");
    if (this.text[this.index] === "0" && /[0-9]/.test(this.text[this.index + 1] ?? "")) {
      fail("package is not valid JSON");
    }
    while (/[0-9]/.test(this.text[this.index] ?? "")) this.index++;
    if (".eE".includes(this.text[this.index] ?? "")) fail("package integers only");
    const digits = this.text.slice(start + (negative ? 1 : 0), this.index);
    const magnitude = BigInt(digits);
    if (magnitude > U64_MAX || (negative && magnitude > I64_MAGNITUDE)) {
      fail("package integer is out of range");
    }
    return negative ? -magnitude : magnitude;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactObject(value, name, keys) {
  if (!isObject(value) || Object.keys(value).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(value, key))) {
    fail(`${name} keys are invalid`);
  }
  return value;
}

function allowedObject(value, name, keys) {
  if (!isObject(value) || Object.keys(value).some((key) => !keys.includes(key)) ||
      !keys.every((key) => Object.hasOwn(value, key))) {
    fail(`${name} keys are invalid`);
  }
  return value;
}

function stringValue(value, name) {
  if (typeof value !== "string") fail(`${name} is not a string`);
  return value;
}

function booleanValue(value, name) {
  if (typeof value !== "boolean") fail(`${name} is not a boolean`);
  return value;
}

function integerValue(value, name) {
  if (typeof value !== "bigint") fail(`${name} is not an integer`);
  return value;
}

function nonnegative(value, name) {
  const integer = integerValue(value, name);
  if (integer < 0n) fail(`${name} is negative`);
  return integer;
}

function u32(value, name) {
  const integer = nonnegative(value, name);
  if (integer > U32_MAX) fail(`${name} is out of range`);
  return integer;
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function compareCodePoints(left, right) {
  const leftPoints = [...left];
  const rightPoints = [...right];
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index++) {
    const delta = leftPoints[index].codePointAt(0) - rightPoints[index].codePointAt(0);
    if (delta !== 0) return delta;
  }
  return leftPoints.length - rightPoints.length;
}

function quote(value) {
  let output = "\"";
  for (const character of value) {
    const code = character.codePointAt(0);
    if (character === "\"") output += "\\\"";
    else if (character === "\\") output += "\\\\";
    else if (character === "\n") output += "\\n";
    else if (character === "\r") output += "\\r";
    else if (character === "\t") output += "\\t";
    else if (code < 0x20) output += `\\u00${code.toString(16).padStart(2, "0")}`;
    else output += character;
  }
  return `${output}\"`;
}

export function canonicalBytes(value) {
  function encode(current) {
    if (current === null) return "null";
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "bigint") return current.toString();
    if (typeof current === "string") return quote(current);
    if (Array.isArray(current)) return `[${current.map(encode).join(",")}]`;
    if (isObject(current)) {
      return `{${Object.keys(current).sort(compareCodePoints)
        .map((key) => `${quote(key)}:${encode(current[key])}`).join(",")}}`;
    }
    fail("package contains an unsupported JSON value");
  }
  return new TextEncoder().encode(encode(value));
}

function equalBytes(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) fail("local SHA-256 support is unavailable");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function parsePackage(rawBytes) {
  const originalBytes = new Uint8Array(rawBytes);
  if (originalBytes.length >= 3 && originalBytes[0] === 0xef &&
      originalBytes[1] === 0xbb && originalBytes[2] === 0xbf) {
    fail("package must not contain a UTF-8 byte-order mark");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(originalBytes);
  } catch {
    fail("package is not valid UTF-8");
  }
  return new StrictJsonParser(text).parse();
}

function timestamp(value) {
  const text = stringValue(value, "created_at_utc");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(text) ||
      text.slice(0, 4) < "2020" || Number.isNaN(Date.parse(text)) ||
      new Date(text).toISOString().slice(0, 19) + "Z" !== text) {
    fail("created_at_utc is invalid");
  }
  return text;
}

function enumValue(value, name, names) {
  const entry = exactObject(value, name, ["code", "name"]);
  const code = nonnegative(entry.code, `${name}.code`);
  if (code >= BigInt(names.length) || stringValue(entry.name, `${name}.name`) !== names[Number(code)]) {
    fail(`${name} is invalid`);
  }
  return Number(code);
}

function faultEnum(value, name, names) {
  const entry = exactObject(value, name, ["code", "name"]);
  const code = nonnegative(entry.code, `${name}.code`);
  if (code > 255n || stringValue(entry.name, `${name}.name`) !==
      (code < BigInt(names.length) ? names[Number(code)] : "UNKNOWN")) {
    fail(`${name} is invalid`);
  }
}

function canonicalFloat32(text) {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const input = Number(text);
  if (!Number.isFinite(input)) return null;
  const value = Math.fround(input);
  if (!Number.isFinite(value)) return null;
  if (Object.is(value, -0)) return "-0";
  for (let precision = 1; precision <= 9; precision++) {
    let candidate = value.toPrecision(precision).replace(/(\.\d*?[1-9])0+(?=e|$)/, "$1")
      .replace(/\.0+(?=e|$)/, "");
    candidate = candidate.replace(/e([+-])0+(\d+)/, "e$1$2");
    const candidates = [candidate];
    const match = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(candidate);
    if (match !== null) {
      const digits = `${match[2]}${match[3] ?? ""}`;
      const exponent = Number(match[4]);
      let fixed;
      if (exponent >= digits.length - 1) {
        fixed = `${match[1]}${digits}${"0".repeat(exponent - digits.length + 1)}`;
      } else if (exponent >= 0) {
        fixed = `${match[1]}${digits.slice(0, exponent + 1)}.${digits.slice(exponent + 1)}`;
      } else {
        fixed = `${match[1]}0.${"0".repeat(-exponent - 1)}${digits}`;
      }
      fixed = fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
      candidates.push(fixed);
    }
    const roundTrips = candidates.filter((valueText) => Math.fround(Number(valueText)) === value);
    if (roundTrips.length > 0) {
      return roundTrips.sort((left, right) => left.length - right.length ||
        left.localeCompare(right))[0];
    }
  }
  return null;
}

function validateFuel(value) {
  const fuel = exactObject(value, "settings.fuel", ["capacity_l", "default_preset_index", "presets", "usable_l"]);
  stringValue(fuel.capacity_l, "settings.fuel.capacity_l");
  stringValue(fuel.usable_l, "settings.fuel.usable_l");
  if (nonnegative(fuel.default_preset_index, "settings.fuel.default_preset_index") >= 3n ||
      !Array.isArray(fuel.presets) || fuel.presets.length !== 3) fail("settings.fuel is invalid");
  for (const [index, preset] of fuel.presets.entries()) {
    const entry = exactObject(preset, `settings.fuel.presets[${index}]`,
      ["ethanol_percent", "is_avgas", "label", "ron"]);
    const key = `${nonnegative(entry.ron, "fuel preset ron")}|${nonnegative(entry.ethanol_percent, "fuel preset ethanol")}|${booleanValue(entry.is_avgas, "fuel preset avgas")}|${stringValue(entry.label, "fuel preset label")}`;
    if (!PRESETS.has(key)) fail("unsupported fuel preset");
  }
}

function validateAircraftAndDisplay(settings) {
  const aircraft = exactObject(settings.aircraft, "settings.aircraft", ["engine", "registration"]);
  const registration = stringValue(aircraft.registration, "settings.aircraft.registration");
  if (!registration || byteLength(registration) > 15) fail("aircraft registration is invalid");
  const engine = exactObject(aircraft.engine, "settings.aircraft.engine", ["cylinders", "name", "turbo"]);
  const cylinders = nonnegative(engine.cylinders, "settings.aircraft.engine.cylinders");
  const name = stringValue(engine.name, "settings.aircraft.engine.name");
  if ((cylinders !== 4n && cylinders !== 6n) || !name || byteLength(name) > 31) fail("aircraft engine is invalid");
  booleanValue(engine.turbo, "settings.aircraft.engine.turbo");
  const display = exactObject(settings.display, "settings.display", ["auto_brightness", "brightness_percent", "units"]);
  booleanValue(display.auto_brightness, "settings.display.auto_brightness");
  const brightness = nonnegative(display.brightness_percent, "settings.display.brightness_percent");
  if (brightness < 20n || brightness > 100n) fail("display brightness is invalid");
  const units = exactObject(display.units, "settings.display.units",
    ["altitude", "baro", "fuel", "pressure", "speed", "temperature"]);
  const allowed = { altitude: ["ft", "m"], baro: ["hPa", "inHg"], fuel: ["L", "US gal"],
    pressure: ["psi", "bar"], speed: ["km/h", "kt"], temperature: ["C", "F"] };
  for (const [key, choices] of Object.entries(allowed)) {
    if (!choices.includes(stringValue(units[key], `settings.display.units.${key}`))) fail("display unit is invalid");
  }
}

function validateEngine(value, aircraftCylinders) {
  const engine = exactObject(value, "settings.engine_configuration",
    ["aspiration_name", "cylinder_count", "model", "parameters", "source", "turbocharged"]);
  const aspiration = stringValue(engine.aspiration_name, "engine aspiration");
  const model = stringValue(engine.model, "engine model");
  const cylinders = nonnegative(engine.cylinder_count, "engine cylinders");
  if (!aspiration || byteLength(aspiration) > 23 || !model || byteLength(model) > 31 ||
      (cylinders !== 4n && cylinders !== 6n) || cylinders !== aircraftCylinders ||
      !Array.isArray(engine.parameters) || engine.parameters.length !== 15) {
    fail("engine configuration is invalid");
  }
  booleanValue(engine.turbocharged, "engine turbocharged");
  enumValue(engine.source, "engine source", ["UNSUPPORTED", "BUILT_IN_DEFAULTS", "USER_CUSTOM"]);
  const unitNames = ["V", "C", "psi", "L/h", "%", "rpm"];
  const zoneNames = ["RED", "YELLOW", "GREEN"];
  for (const [index, parameter] of engine.parameters.entries()) {
    const entry = exactObject(parameter, `engine parameter ${index}`,
      ["applicable", "id", "informational_only", "informational_reference_milliunits",
        "presentation_max_milliunits", "presentation_min_milliunits", "unit", "zones"]);
    booleanValue(entry.applicable, "engine parameter applicable");
    if (enumValue(entry.id, "engine parameter id", PARAMETER_NAMES) !== index) fail("engine parameter order is invalid");
    booleanValue(entry.informational_only, "engine parameter informational_only");
    if (entry.informational_reference_milliunits !== null) integerValue(entry.informational_reference_milliunits, "engine parameter reference");
    integerValue(entry.presentation_max_milliunits, "engine parameter maximum");
    integerValue(entry.presentation_min_milliunits, "engine parameter minimum");
    enumValue(entry.unit, "engine parameter unit", unitNames);
    if (!Array.isArray(entry.zones) || entry.zones.length > 5) fail("engine parameter zones are invalid");
    for (const zone of entry.zones) {
      const z = exactObject(zone, "engine zone",
        ["classification", "lower_inclusive", "lower_milliunits", "upper_inclusive", "upper_milliunits"]);
      enumValue(z.classification, "engine zone classification", zoneNames);
      booleanValue(z.lower_inclusive, "engine zone lower inclusive");
      booleanValue(z.upper_inclusive, "engine zone upper inclusive");
      if (z.lower_milliunits !== null) integerValue(z.lower_milliunits, "engine zone lower");
      if (z.upper_milliunits !== null) integerValue(z.upper_milliunits, "engine zone upper");
      if (z.lower_milliunits === null && z.upper_milliunits === null) fail("engine zone is unbounded");
    }
  }
}

function validatePorts(value) {
  if (!Array.isArray(value) || value.length !== 4) fail("ports are invalid");
  const physical = ["CHT5", "CHT6", "EGT5", "EGT6"];
  const semantic = ["UNASSIGNED", "UCT", "FUEL_TEMPERATURE", "HEATER_TEMPERATURE"];
  const target = ["MAIN", "AUX_ONLY"];
  const seen = new Set();
  const orders = new Set();
  for (const [index, item] of value.entries()) {
    const entry = exactObject(item, `ports[${index}]`, ["physical", "requested_order", "semantic", "target"]);
    if (enumValue(entry.physical, "port physical", physical) !== index) fail("port physical order is invalid");
    const kind = enumValue(entry.semantic, "port semantic", semantic);
    const destination = enumValue(entry.target, "port target", target);
    if (kind === 0) {
      if (destination !== 1 || entry.requested_order !== null) fail("unassigned port is invalid");
      continue;
    }
    if (seen.has(kind) || (kind === 1 && index !== 1) || (kind === 2 && index !== 3) ||
        (kind === 3 && index !== 2)) fail("port assignment is invalid");
    seen.add(kind);
    if (destination === 1) {
      if (entry.requested_order !== null) fail("aux-only port order is invalid");
    } else {
      const order = nonnegative(entry.requested_order, "port requested order");
      if (order > 2n || orders.has(order)) fail("port requested order is invalid");
      orders.add(order);
    }
  }
}

function validateAuxiliary(value) {
  if (!Array.isArray(value) || value.length > 4) fail("auxiliary is invalid");
  const sources = ["", "CHT5", "CHT6", "EGT5", "EGT6"];
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    const entry = exactObject(item, `auxiliary[${index}]`, ["label", "priority", "source"]);
    const label = stringValue(entry.label, "auxiliary label");
    if (!label || byteLength(label) > 10 || /[^\x20-\x7e]/.test(label) ||
        nonnegative(entry.priority, "auxiliary priority") !== BigInt(index)) fail("auxiliary entry is invalid");
    const source = enumValue(entry.source, "auxiliary source", sources);
    if (source === 0 || seen.has(source)) fail("auxiliary source is invalid");
    seen.add(source);
  }
}

function validateOperating(value) {
  const operating = exactObject(value, "settings.operating_parameters",
    ["cht_max_diff_c", "cruise_fuel_burn_tenths_lph"]);
  const cht = exactObject(operating.cht_max_diff_c, "settings operating cht", ["unit", "value"]);
  const burn = exactObject(operating.cruise_fuel_burn_tenths_lph, "settings operating burn", ["unit", "value"]);
  if (stringValue(cht.unit, "cht unit") !== "C" || stringValue(burn.unit, "burn unit") !== "0.1 L/h") fail("operating unit is invalid");
  const chtValue = nonnegative(cht.value, "cht value");
  const burnValue = nonnegative(burn.value, "burn value");
  if (chtValue < 5n || chtValue > 60n || burnValue < 50n || burnValue > 500n) fail("operating value is invalid");
}

function validateAirState(value) {
  const airState = exactObject(value, "air_state", ["airframe_time", "engine_time", "fuel", "metadata"]);
  for (const name of ["airframe_time", "engine_time"]) {
    const time = exactObject(airState[name], `air_state.${name}`, ["seconds", "unit"]);
    nonnegative(time.seconds, `air_state.${name}.seconds`);
    if (stringValue(time.unit, `air_state.${name}.unit`) !== "s") fail("air state time unit is invalid");
  }
  const fuel = exactObject(airState.fuel, "air_state.fuel", ["preset_index", "quantity_ml", "unit"]);
  if (u32(fuel.preset_index, "air state preset") > 2n || stringValue(fuel.unit, "air state fuel unit") !== "ml") fail("air state fuel is invalid");
  u32(fuel.quantity_ml, "air state fuel quantity");
  const metadata = exactObject(airState.metadata, "air_state.metadata",
    ["airframe_time_valid", "engine_generation", "engine_time_valid", "last_checkpoint_reason", "sequence"]);
  booleanValue(metadata.airframe_time_valid, "airframe time validity");
  booleanValue(metadata.engine_time_valid, "engine time validity");
  u32(metadata.engine_generation, "engine generation");
  u32(metadata.sequence, "air state sequence");
  const reason = enumValue(metadata.last_checkpoint_reason, "checkpoint reason",
    ["", "BOOTSTRAP", "PERIODIC", "FUEL", "SHUTDOWN", "MAINT"]);
  if (reason === 0) fail("checkpoint reason is invalid");
}

function validateFault(value) {
  const fault = exactObject(value, "fault", ["acknowledged", "code", "condition_active", "detail", "first_seen_utc", "last_seen_utc", "limit", "occurrence_count", "severity", "source", "title", "unit", "value"]);
  booleanValue(fault.acknowledged, "fault acknowledged");
  booleanValue(fault.condition_active, "fault condition_active");
  u32(fault.code, "fault code");
  u32(fault.occurrence_count, "fault occurrence_count");
  const title = stringValue(fault.title, "fault title");
  const detail = stringValue(fault.detail, "fault detail");
  if (byteLength(title) > 31 || byteLength(detail) > 63 || fault.unit !== null) fail("fault text is invalid");
  faultEnum(fault.source, "fault source", ["BOARD", "ULPOWER", "POWER", "STORAGE", "NETWORK", "SYSTEM"]);
  faultEnum(fault.severity, "fault severity", ["INFO", "CAUTION", "WARNING", "CRITICAL"]);
  for (const key of ["first_seen_utc", "last_seen_utc"]) {
    if (fault[key] !== null && (nonnegative(fault[key], `fault ${key}`) > I64_MAX || fault[key] === 0n)) fail("fault timestamp is invalid");
  }
  for (const key of ["value", "limit"]) {
    if (fault[key] !== null && canonicalFloat32(stringValue(fault[key], `fault ${key}`)) !== fault[key]) {
      fail("fault decimal is not canonical binary32");
    }
  }
}

function containsForbidden(value) {
  if (Array.isArray(value)) return value.some(containsForbidden);
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.has(key) || containsForbidden(child));
}

function validatePackage(root, requireIntegrity) {
  if (!isObject(root) || Object.keys(root).some((key) => ![
    "air_state", "created_at_utc", "faults", "integrity", "schema", "schema_version", "settings", "source", "extensions"
  ].includes(key))) {
    fail("package keys are invalid");
  }
  const required = ["air_state", "created_at_utc", "faults", "schema", "schema_version", "settings", "source"];
  if (!required.every((key) => Object.hasOwn(root, key)) || Object.hasOwn(root, "integrity") !== requireIntegrity || containsForbidden(root)) {
    fail("package structure is invalid");
  }
  if (stringValue(root.schema, "schema") !== STATUS_PACKAGE_SCHEMA ||
      integerValue(root.schema_version, "schema_version") !== 1n) fail("schema is invalid");
  timestamp(root.created_at_utc);
  const source = exactObject(root.source, "source", ["device_id", "firmware_build_id", "privacy_profile", "product"]);
  if (source.device_id !== null || stringValue(source.product, "source product") !== "Huginn" ||
      stringValue(source.privacy_profile, "source privacy profile") !== "owner_full" ||
      !stringValue(source.firmware_build_id, "source build id") || byteLength(source.firmware_build_id) > 47) {
    fail("source is invalid");
  }
  const settings = exactObject(root.settings, "settings",
    ["aircraft", "auxiliary", "config_revision", "display", "engine_configuration", "fuel", "operating_parameters", "ports"]);
  u32(settings.config_revision, "settings config revision");
  validateAircraftAndDisplay(settings);
  validateFuel(settings.fuel);
  validateEngine(settings.engine_configuration, settings.aircraft.engine.cylinders);
  validatePorts(settings.ports);
  validateAuxiliary(settings.auxiliary);
  validateOperating(settings.operating_parameters);
  validateAirState(root.air_state);
  const faults = exactObject(root.faults, "faults", ["max_records", "records", "store_schema", "store_sequence"]);
  if (nonnegative(faults.max_records, "fault max records") !== 32n ||
      nonnegative(faults.store_schema, "fault store schema") !== 1n ||
      !Array.isArray(faults.records) || faults.records.length > 32) fail("fault store is invalid");
  nonnegative(faults.store_sequence, "fault store sequence");
  for (const fault of faults.records) validateFault(fault);
}

function withoutIntegrity(root) {
  const covered = Object.create(null);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "integrity") covered[key] = value;
  }
  return covered;
}

export async function verifyStatusPackage(rawBytes) {
  const originalBytes = new Uint8Array(rawBytes);
  const packageValue = parsePackage(originalBytes);
  validatePackage(packageValue, true);
  if (!equalBytes(canonicalBytes(packageValue), originalBytes)) fail("package is not canonical");
  const integrity = exactObject(packageValue.integrity, "integrity", ["algorithm", "canonical_bytes", "sha256"]);
  if (stringValue(integrity.algorithm, "integrity algorithm") !== "SHA-256" ||
      !/^[0-9a-f]{64}$/.test(stringValue(integrity.sha256, "integrity sha256"))) fail("integrity format is invalid");
  const covered = canonicalBytes(withoutIntegrity(packageValue));
  if (nonnegative(integrity.canonical_bytes, "integrity canonical_bytes") !== BigInt(covered.length) ||
      await sha256Hex(covered) !== integrity.sha256) fail("integrity verification failed");
  return { package: packageValue, originalBytes };
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function receiveStatusPackage(rawBytes, storage, now = new Date()) {
  const verified = await verifyStatusPackage(rawBytes);
  const receivedAt = now.toISOString();
  const record = {
    local_id: `status-v1:${verified.package.integrity.sha256}:${receivedAt}`,
    metadata: {
      received_at: receivedAt,
      verified: true,
      schema: verified.package.schema,
      schema_version: Number(verified.package.schema_version),
      source_product: verified.package.source.product,
      created_at_utc: verified.package.created_at_utc,
      package_sha256: verified.package.integrity.sha256,
      canonical_bytes: Number(verified.package.integrity.canonical_bytes),
      pending_muninn_transfer: true,
      muninn_transferred: false
    },
    package_bytes_base64: bytesToBase64(verified.originalBytes)
  };
  try {
    storage.setItem(STATUS_PACKAGE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    fail("could not store verified status package locally");
  }
  return { ...record, originalBytes: verified.originalBytes, package: verified.package };
}

export async function loadLatestStatusPackage(storage) {
  let serialized;
  try {
    serialized = storage.getItem(STATUS_PACKAGE_STORAGE_KEY);
  } catch {
    fail("local status package storage is unavailable");
  }
  if (serialized === null) return null;
  let record;
  try {
    record = JSON.parse(serialized);
  } catch {
    fail("stored status package metadata is invalid");
  }
  if (!isObject(record) || !isObject(record.metadata) || record.metadata.verified !== true ||
      typeof record.package_bytes_base64 !== "string") {
    fail("stored status package record is invalid");
  }
  let originalBytes;
  try {
    originalBytes = base64ToBytes(record.package_bytes_base64);
  } catch {
    fail("stored status package bytes are invalid");
  }
  const verified = await verifyStatusPackage(originalBytes);
  const metadata = record.metadata;
  const packageSha256 = verified.package.integrity.sha256;
  const canonicalBytes = Number(verified.package.integrity.canonical_bytes);
  const transferred = metadata.muninn_transferred === true;
  const pending = metadata.pending_muninn_transfer === true;
  if ((transferred && pending) || (!transferred && !pending) ||
      (transferred && (typeof metadata.muninn_transferred_at !== "string" ||
        metadata.muninn_transferred_sha256 !== packageSha256 ||
        metadata.muninn_transferred_canonical_bytes !== canonicalBytes))) {
    fail("stored status package transfer metadata is invalid");
  }
  return { ...record, originalBytes, package: verified.package };
}

export async function markStatusPackageTransferred(storage, localId, sha256, now = new Date()) {
  const stored = await loadLatestStatusPackage(storage);
  if (stored === null || stored.local_id !== localId ||
      stored.package.integrity.sha256 !== sha256) {
    fail("stored status package changed before Muninn transfer could be recorded");
  }
  const updated = {
    ...stored,
    metadata: {
      ...stored.metadata,
      pending_muninn_transfer: false,
      muninn_transferred: true,
      muninn_transferred_at: now.toISOString(),
      muninn_transferred_sha256: stored.package.integrity.sha256,
      muninn_transferred_canonical_bytes: Number(stored.package.integrity.canonical_bytes)
    }
  };
  delete updated.originalBytes;
  delete updated.package;
  try {
    storage.setItem(STATUS_PACKAGE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    fail("could not record confirmed Muninn transfer locally");
  }
  return { ...updated, originalBytes: stored.originalBytes, package: stored.package };
}

function hours(seconds, available) {
  if (!available) return "Unavailable";
  const minutes = seconds / 60n;
  return `${minutes / 60n}:${(minutes % 60n).toString().padStart(2, "0")}`;
}

export function buildStatusPreview(packageValue, { transferredToMuninn = false } = {}) {
  const airState = packageValue.air_state;
  const display = packageValue.settings.display;
  const faults = packageValue.faults.records;
  const fields = {
    Source: packageValue.source.product,
    Created: packageValue.created_at_utc,
    Status: "Verified — pending transfer to Muninn",
    "Engine Hours": hours(airState.engine_time.seconds, airState.metadata.engine_time_valid),
    "Airframe Hours": hours(airState.airframe_time.seconds, airState.metadata.airframe_time_valid),
    Fuel: `${airState.fuel.quantity_ml.toString()} ${airState.fuel.unit} (preset ${airState.fuel.preset_index.toString()})`,
    Checkpoint: airState.metadata.last_checkpoint_reason.name,
    "Display Units": Object.values(display.units).join(", "),
    Brightness: `${display.brightness_percent.toString()}%${display.auto_brightness ? " (auto)" : ""}`,
    "Fuel Presets": packageValue.settings.fuel.presets.map((preset) => preset.label).join(", "),
    "Faults / Events": faults.length === 0 ? "None" : `${faults.length} — ${faults.slice(0, 3).map((fault) => `#${fault.code.toString()} ${fault.title}`).join("; ")}`
  };
  return fields;
}
