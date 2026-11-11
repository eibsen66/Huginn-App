/* Included after the local settings editors: same model, validators and save owner.
 * No protected-aircraft-state, fault, logger or current-fuel setters exist here.
 * All large work objects and JSON allocations live in PSRAM, not task stacks.
 */
#if defined(HUGINN_DEV_HTTPS_AVAILABLE)
#include "cJSON.h"
#include "freertos/FreeRTOS.h"
#define HS2_BODY_MAX 32768U
#define HS2_RESPONSE_MAX 131072U
typedef struct {
    HuginnSettings settings;
    HuginnAircraftEngineConfiguration engine;
    HuginnPortsConfiguration ports;
    HuginnAuxConfiguration aux;
    uint32_t revision;
} Hs2Config;
typedef enum {
    HS2_INT,
    HS2_U8,
    HS2_BOOL,
    HS2_TEXT,
    HS2_BOUNDARY,
    HS2_TOPOLOGY,
    HS2_REFERENCE
} Hs2Type;
typedef struct {
    char id[80], label[120];
    const char *section, *unit, *options;
    Hs2Type type;
    void *value, *other;
    int64_t min, max;
    unsigned capacity, scale;
    bool is_set;
} Hs2Field;
typedef bool (*Hs2Visit)(Hs2Field *, void *);
static void *hs2_alloc(size_t bytes) {
    return heap_caps_calloc(1, bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
}
static void *hs2_json_alloc(size_t bytes) {
    return heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
}
static bool hs2_unique(const cJSON *j) {
    if (cJSON_IsObject(j)) {
        for (const cJSON *a = j->child; a; a = a->next) {
            if (!a->string) {
                return false;
            }
            for (const cJSON *b = a->next; b; b = b->next) {
                if (!strcmp(a->string, b->string)) {
                    return false;
                }
            }
        }
    }
    for (const cJSON *a = j->child; a; a = a->next) {
        if (!hs2_unique(a)) {
            return false;
        }
    }
    return true;
}
static bool hs2_request_bytes(const char *bytes, size_t n) {
    unsigned depth = 0;
    bool quoted = false, escaped = false;
    for (size_t i = 0; i < n; i++) {
        unsigned char c = (unsigned char)bytes[i];
        if (!c) {
            return false;
        }
        if (quoted) {
            if (escaped) {
                if (c == 'u' && i + 4U < n && !memcmp(bytes + i + 1, "0000", 4)) {
                    return false;
                }
                escaped = false;
            } else if (c == '\\') {
                escaped = true;
            } else if (c == '"') {
                quoted = false;
            }
            continue;
        }
        if (c == '"') {
            quoted = true;
        } else if (c == '{' || c == '[') {
            if (++depth > 8U) {
                return false;
            }
        } else if (c == '}' || c == ']') {
            if (!depth) {
                return false;
            }
            depth--;
        }
    }
    return !quoted && !escaped && depth == 0;
}
static bool hs2_keys(const cJSON *j, const char *names, unsigned count) {
    if (!cJSON_IsObject(j) || cJSON_GetArraySize(j) != (int)count) {
        return false;
    }
    for (const cJSON *a = j->child; a; a = a->next) {
        char key[100];
        if (!a->string || strlen(a->string) > 90) {
            return false;
        }
        snprintf(key, sizeof(key), "|%s|", a->string);
        if (!strstr(names, key)) {
            return false;
        }
    }
    return true;
}
static cJSON *hs2_get(const cJSON *j, const char *key) {
    return cJSON_GetObjectItemCaseSensitive(j, key);
}
static bool hs2_string(const cJSON *j, const char *text) {
    return cJSON_IsString(j) && !strcmp(j->valuestring, text);
}
static const char *hs2_topology(const HuginnEngineParameterProfile *p) {
    static const char *names[] = {"", "GYR", "RYGYR", "RGYR", "RYGR", "YGYR", "RGR"};
    char actual[6] = {0};
    for (unsigned i = 0; i < p->zone_count && i < 5; i++) {
        actual[i] = "RYG"[p->zones[i].classification];
    }
    for (unsigned i = 0; i < 7; i++) {
        if (!strcmp(actual, names[i])) {
            return names[i];
        }
    }
    return "existing";
}
static bool hs2_set_topology(HuginnEngineParameterProfile *p, const char *s) {
    /* This is detached RAM. Final profile validation precedes atomic owner save;
     * the local UI's disable-before-edit interaction does not mutate live state. */
    if (p->informational_only) {
        return false;
    }
    const char *allowed[] = {"", "GYR", "RYGYR", "RGYR", "RYGR", "YGYR", "RGR"};
    bool found = false;
    for (unsigned i = 0; i < 7; i++) {
        if (!strcmp(s, allowed[i])) {
            found = true;
        }
    }
    if (!found || (p->id == HUGINN_ENGINE_PARAMETER_RPM && strcmp(s, "GYR") && s[0])) {
        return false;
    }
    memset(p->zones, 0, sizeof(p->zones));
    p->zone_count = (uint8_t)strlen(s);
    for (unsigned i = 0; i < p->zone_count; i++) {
        HuginnEngineOperatingZone *z = &p->zones[i];
        z->classification = s[i] == 'R'   ? HUGINN_ENGINE_ZONE_RED
                            : s[i] == 'Y' ? HUGINN_ENGINE_ZONE_YELLOW
                                          : HUGINN_ENGINE_ZONE_GREEN;
        if (i) {
            z->has_lower_bound = true;
            z->lower_bound_milliunits = p->presentation_min_milliunits;
            z->lower_bound_inclusive = i < p->zone_count - 1U;
        }
        if (i + 1U < p->zone_count) {
            z->has_upper_bound = true;
            z->upper_bound_milliunits = p->presentation_min_milliunits;
            z->upper_bound_inclusive = i == p->zone_count - 2U;
        }
    }
    return true;
}
static bool hs2_fields(Hs2Config *c, Hs2Visit visit, void *ctx) {
    Hs2Field f = {0};
#define FIELD(id_, label_, section_, type_, ptr_, lo_, hi_, unit_, scale_, options_, cap_)         \
    do {                                                                                           \
        memset(&f, 0, sizeof(f));                                                                  \
        snprintf(f.id, sizeof(f.id), "%s", id_);                                                   \
        snprintf(f.label, sizeof(f.label), "%s", label_);                                          \
        f.section = section_;                                                                      \
        f.type = type_;                                                                            \
        f.value = ptr_;                                                                            \
        f.min = lo_;                                                                               \
        f.max = hi_;                                                                               \
        f.unit = unit_;                                                                            \
        f.scale = scale_;                                                                          \
        f.options = options_;                                                                      \
        f.capacity = cap_;                                                                         \
        if (!visit(&f, ctx))                                                                       \
            return false;                                                                          \
    } while (0)
#define NUM(id, label, sec, ptr, lo, hi, unit, scale, opts)                                        \
    FIELD(id, label, sec, HS2_INT, ptr, lo, hi, unit, scale, opts, 0)
#define BOOL(id, label, sec, ptr) FIELD(id, label, sec, HS2_BOOL, ptr, 0, 1, "", 1, NULL, 0)
#define BYTE(id, label, sec, ptr, lo, hi, opts)                                                    \
    FIELD(id, label, sec, HS2_U8, ptr, lo, hi, "", 1, opts, 0)
#define TEXT(id, label, sec, ptr, cap) FIELD(id, label, sec, HS2_TEXT, ptr, 0, 0, "", 1, NULL, cap)
    NUM("display.brightness_percent", "Brightness", "Display", &c->settings.brightness_percent, 20,
        100, "%", 1, NULL);
    BOOL("display.auto_brightness", "Auto brightness", "Display", &c->settings.auto_brightness);
    NUM("units.altitude", "Altitude", "Units", &c->settings.altitude_unit, 0, 1, "", 1, "ft|m");
    NUM("units.baro", "Barometer", "Units", &c->settings.baro_unit, 0, 1, "", 1, "hPa|inHg");
    NUM("units.fuel", "Fuel", "Units", &c->settings.fuel_unit, 0, 1, "", 1, "L|US gal");
    NUM("units.pressure", "Pressure", "Units", &c->settings.pressure_unit, 0, 1, "", 1, "psi|bar");
    NUM("units.speed", "Speed", "Units", &c->settings.speed_unit, 0, 1, "", 1, "km/h|kt");
    NUM("units.temperature", "Temperature", "Units", &c->settings.temperature_unit, 0, 1, "", 1,
        "C|F");
    TEXT("aircraft.registration", "Registration", "Aircraft", c->settings.registration,
         sizeof(c->settings.registration));
    TEXT("engine.name", "Engine / motor type (catalogue or Other Engine)", "Engine",
         c->settings.engine_name, sizeof(c->settings.engine_name));
    NUM("engine.cylinders", "Cylinders", "Engine", &c->settings.cylinders, 4, 6, "", 1, "4|6");
    BOOL("engine.turbo", "Turbo", "Engine", &c->settings.turbo);
    /* The existing CHT-spread setting is exposed; its fault algorithm is unchanged. */
    NUM("engine.cht_max_diff_c", "CHT maximum spread", "Engine", &c->settings.cht_max_diff_c, 5, 60,
        "C difference", 1, NULL);
    NUM("fuel.total_l", "Tank capacity", "Fuel", &c->settings.fuel_total_l, 1, 250, "L", 1, NULL);
    NUM("fuel.usable_l", "Usable capacity", "Fuel", &c->settings.fuel_usable_l, 0, 250, "L", 1,
        NULL);
    NUM("fuel.cruise_burn", "Cruise fuel burn", "Fuel", &c->settings.cruise_fuel_burn_tenths_lph,
        50, 500, "L/h", 10, NULL);
    NUM("fuel.default_preset_index", "Default fuel preset", "Fuel", &c->settings.default_fuel_slot,
        0, 2, "", 1, "1|2|3");
    for (unsigned i = 0; i < 3; i++) {
        char id[50], label[50];
        snprintf(id, sizeof(id), "fuel.preset.%u", i);
        snprintf(label, sizeof(label), "Fuel preset %u", i + 1);
        /* Presets are immutable canonical catalogue strings, never current fuel quantity. */
        FIELD(
            id, label, "Fuel", HS2_TEXT, (void *)c->settings.fuel_presets[i].display_name, 0, 0, "",
            1,
            "91 OCT E5|91 OCT E10|95 OCT E5|95 OCT E10|95 OCT E15|95 OCT E20|98 OCT E5|98 OCT E10|AVGAS UL91|AVGAS 100LL",
            0);
    }
    /* Legacy PORTS mappings are persisted for compatibility, but the current local
     * editor edits V6 AUX slots, not these legacy records. Preserve them unchanged. */
    if (c->settings.cylinders == 4) {
        BYTE("aux.count", "Enabled AUX slots", "AUX", &c->aux.enabled_count, 0, 4, "0|1|2|3|4");
        for (unsigned i = 0; i < HUGINN_AUX_MAX_SLOTS; i++) {
            char id[50], label[90];
            HuginnAuxSlot *s = &c->aux.slots[i];
            snprintf(id, sizeof(id), "aux.%u.source", i);
            snprintf(label, sizeof(label), "AUX slot %u source", i + 1);
            BYTE(id, label, "AUX", &s->source, 0, 4, "None|CHT5|CHT6|EGT5|EGT6");
            snprintf(id, sizeof(id), "aux.%u.label", i);
            snprintf(label, sizeof(label), "AUX slot %u label (1-10 ASCII bytes)", i + 1);
            FIELD(id, label, "AUX", HS2_TEXT, s->label, 0, 0, "", 1, NULL,
                  HUGINN_AUX_LABEL_MAX_BYTES + 1U);
        }
    }
    for (unsigned i = 0; i < HUGINN_ENGINE_PARAMETER_COUNT; i++) {
        HuginnEngineParameterProfile *p = &c->engine.profile.parameters[i];
        char id[80], label[120];
        const char *section =
            i >= HUGINN_ENGINE_PARAMETER_UCT && i <= HUGINN_ENGINE_PARAMETER_HEATER_TEMPERATURE
                ? "AUX"
                : "Engine";
#define PARAM(name, description, type, ptr, lo, hi, scale)                                         \
    do {                                                                                           \
        snprintf(id, sizeof(id), "parameters.%u.%s", i, name);                                     \
        snprintf(label, sizeof(label), "%s - %s", p->display_name, description);                   \
        FIELD(id, label, section, type, ptr, lo, hi, huginn_engine_unit_name(p->unit), scale,      \
              NULL, 0);                                                                            \
    } while (0)
        PARAM("enabled", "Enabled", HS2_BOOL, &p->applicable, 0, 1, 1);
        PARAM("min", "Display minimum", HS2_INT, &p->presentation_min_milliunits, INT32_MIN,
              INT32_MAX, 1000);
        PARAM("max", "Display maximum", HS2_INT, &p->presentation_max_milliunits, INT32_MIN,
              INT32_MAX, 1000);
        if (p->id == HUGINN_ENGINE_PARAMETER_FUEL_FLOW) {
            memset(&f, 0, sizeof(f));
            snprintf(f.id, sizeof(f.id), "parameters.%u.reference", i);
            snprintf(f.label, sizeof(f.label), "%s - Cruise reference", p->display_name);
            f.section = section;
            f.type = HS2_REFERENCE;
            f.value = &p->informational_reference_milliunits;
            f.is_set = p->has_informational_reference;
            f.min = INT32_MIN;
            f.max = INT32_MAX;
            f.scale = 1000;
            f.unit = huginn_engine_unit_name(p->unit);
            if (!visit(&f, ctx)) {
                return false;
            }
        } else if (!p->informational_only) {
            snprintf(id, sizeof(id), "parameters.%u.topology", i);
            snprintf(label, sizeof(label), "%s - USER/CUSTOM topology (disable first)",
                     p->display_name);
            FIELD(id, label, section, HS2_TOPOLOGY, p, 0, 0, "", 1,
                  p->id == HUGINN_ENGINE_PARAMETER_RPM ? "|GYR" : "|GYR|RYGYR|RGYR|RYGR|YGYR|RGR",
                  0);
            HuginnEngineBoundaryDescriptor boundaries[HUGINN_ENGINE_EDIT_MAX_BOUNDARIES];
            const unsigned n = settings_engine_parameter_boundary_descriptors(p, boundaries);
            for (unsigned b = 0; b < n; b++) {
                snprintf(id, sizeof(id), "parameters.%u.boundary.%u", i, b);
                snprintf(label, sizeof(label), "%s - %s to %s boundary", p->display_name,
                         settings_engine_boundary_side_name(p, b, true),
                         settings_engine_boundary_side_name(p, b, false));
                memset(&f, 0, sizeof(f));
                snprintf(f.id, sizeof(f.id), "%s", id);
                snprintf(f.label, sizeof(f.label), "%s", label);
                f.section = section;
                f.type = HS2_BOUNDARY;
                f.min = INT32_MIN;
                f.max = INT32_MAX;
                f.scale = 1000;
                f.unit = huginn_engine_unit_name(p->unit);
                if (boundaries[b].zone_below >= 0) {
                    f.value = &p->zones[boundaries[b].zone_below].upper_bound_milliunits;
                }
                if (boundaries[b].zone_above >= 0) {
                    if (f.value) {
                        f.other = &p->zones[boundaries[b].zone_above].lower_bound_milliunits;
                    } else {
                        f.value = &p->zones[boundaries[b].zone_above].lower_bound_milliunits;
                    }
                }
                if (!visit(&f, ctx)) {
                    return false;
                }
            }
        }
#undef PARAM
    }
#undef FIELD
#undef NUM
#undef BOOL
#undef BYTE
#undef TEXT
    return true;
}
static cJSON *hs2_value(Hs2Field *f) {
    switch (f->type) {
    case HS2_REFERENCE:
        return f->is_set ? cJSON_CreateNumber(*(int *)f->value) : cJSON_CreateNull();
    case HS2_BOOL:
        return cJSON_CreateBool(*(bool *)f->value);
    case HS2_U8:
        return cJSON_CreateNumber(*(uint8_t *)f->value);
    case HS2_TEXT:
        if (!strncmp(f->id, "aux.", 4)) {
            char s[11] = {0};
            memcpy(s, f->value, 10);
            return cJSON_CreateString(s);
        }
        return cJSON_CreateString(f->value);
    case HS2_TOPOLOGY:
        return cJSON_CreateString(hs2_topology(f->value));
    default:
        return cJSON_CreateNumber(*(int *)f->value);
    }
}
static bool hs2_emit(Hs2Field *f, void *ctx) {
    cJSON *j = cJSON_CreateObject();
    if (!j) {
        return false;
    }
    cJSON_AddItemToArray(ctx, j);
    cJSON_AddStringToObject(j, "id", f->id);
    cJSON_AddStringToObject(j, "label", f->label);
    cJSON_AddStringToObject(j, "section", f->section);
    cJSON_AddStringToObject(j, "type",
                            f->type == HS2_BOOL                              ? "boolean"
                            : f->type == HS2_TEXT || f->type == HS2_TOPOLOGY ? "string"
                                                                             : "integer");
    cJSON_AddItemToObject(j, "value", hs2_value(f));
    cJSON_AddStringToObject(j, "unit", f->unit);
    cJSON_AddNumberToObject(j, "scale", f->scale);
    if (f->type == HS2_REFERENCE) {
        cJSON_AddBoolToObject(j, "nullable", true);
    }
    cJSON_AddNumberToObject(j, "min", (double)f->min);
    cJSON_AddNumberToObject(j, "max", (double)f->max);
    cJSON_AddNumberToObject(j, "max_bytes", f->capacity ? f->capacity - 1U : 0);
    if (f->options) {
        cJSON *opts = cJSON_AddArrayToObject(j, "options");
        if (!opts) {
            return false;
        }
        const char *s = f->options;
        unsigned n = 0;
        do {
            const char *end = strchr(s, '|');
            size_t bytes = end ? (size_t)(end - s) : strlen(s);
            char label[64];
            if (bytes >= sizeof(label)) {
                return false;
            }
            memcpy(label, s, bytes);
            label[bytes] = 0;
            cJSON *o = cJSON_CreateObject();
            if (!o) {
                return false;
            }
            if (f->type == HS2_TEXT || f->type == HS2_TOPOLOGY) {
                cJSON_AddStringToObject(o, "value", label);
            } else {
                cJSON_AddNumberToObject(o, "value",
                                        !strcmp(f->id, "engine.cylinders")  ? (n ? 6 : 4)
                                        : strstr(f->id, ".order") && n == 3 ? 255
                                                                            : n);
            }
            if (f->type == HS2_TOPOLOGY && bytes) {
                char expanded[64] = "";
                for (size_t k = 0; k < bytes; k++) {
                    if (k) {
                        strcat(expanded, " / ");
                    }
                    strcat(expanded, label[k] == 'R'   ? "Red"
                                     : label[k] == 'Y' ? "Yellow"
                                                       : "Green");
                }
                cJSON_AddStringToObject(o, "label", expanded);
            } else {
                cJSON_AddStringToObject(o, "label", bytes ? label : "Clear / unconfigured");
            }
            cJSON_AddItemToArray(opts, o);
            n++;
            if (!end) {
                break;
            }
            s = end + 1;
        } while (true);
    }
    return hs2_get(j, "value") && hs2_get(j, "id") && hs2_get(j, "label") &&
           hs2_get(j, "section") && hs2_get(j, "type") && hs2_get(j, "unit") &&
           hs2_get(j, "scale") && hs2_get(j, "min") && hs2_get(j, "max") && hs2_get(j, "max_bytes");
}
static cJSON *hs2_document(Hs2Config *c, const char *device) {
    cJSON *j = cJSON_CreateObject();
    if (!j) {
        return NULL;
    }
    cJSON_AddStringToObject(j, "schema", "huginn.settings.config");
    cJSON_AddNumberToObject(j, "schema_version", 2);
    cJSON_AddStringToObject(j, "source_device_id", device);
    cJSON_AddNumberToObject(j, "config_revision", c->revision);
    cJSON *fields = cJSON_AddArrayToObject(j, "fields");
    if (!fields || !hs2_fields(c, hs2_emit, fields)) {
        cJSON_Delete(j);
        return NULL;
    }
    cJSON *models = cJSON_AddArrayToObject(j, "engine_models");
    if (!models) {
        cJSON_Delete(j);
        return NULL;
    }
    for (unsigned i = 0; i < sizeof(g_ulpower_builtin_profile_identities) /
                                 sizeof(g_ulpower_builtin_profile_identities[0]);
         i++) {
        const HuginnBuiltinEngineProfileIdentity *p = &g_ulpower_builtin_profile_identities[i];
        cJSON *m = cJSON_CreateObject();
        if (!m) {
            cJSON_Delete(j);
            return NULL;
        }
        cJSON_AddStringToObject(m, "name", p->model);
        cJSON_AddNumberToObject(m, "cylinders", p->cylinder_count);
        cJSON_AddBoolToObject(m, "turbo", p->turbocharged);
        cJSON_AddItemToArray(models, m);
        if (!hs2_get(m, "name") || !hs2_get(m, "cylinders") || !hs2_get(m, "turbo")) {
            cJSON_Delete(j);
            return NULL;
        }
    }
    cJSON_AddStringToObject(
        j, "calibration",
        "No editable AUX calibration coefficients exist in this firmware interface. Display ranges and operating-zone limits are included.");
    cJSON_AddStringToObject(
        j, "engine_status",
        c->engine.source == HUGINN_ENGINE_CONFIG_SOURCE_UNSUPPORTED
            ? "Other Engine: explicit parameter configuration required; no manufacturer limits supplied."
        : c->engine.source == HUGINN_ENGINE_CONFIG_SOURCE_USER_CUSTOM
            ? "Owner/custom engine parameters"
            : "Built-in engine parameters");
    if (!hs2_get(j, "schema") || !hs2_get(j, "schema_version") || !hs2_get(j, "source_device_id") ||
        !hs2_get(j, "config_revision") || !hs2_get(j, "calibration") ||
        !hs2_get(j, "engine_status")) {
        cJSON_Delete(j);
        return NULL;
    }
    return j;
}
typedef struct {
    const char *id;
    const cJSON *value;
    Hs2Config *config;
    bool found, valid;
} Hs2Edit;
static bool hs2_utf8(const unsigned char *s, size_t n) {
    for (size_t i = 0; i < n;) {
        unsigned a = s[i++], extra = 0;
        uint32_t code = 0, min = 0;
        if (a < 128) {
            if (a < 32 || a == 127) {
                return false;
            }
            continue;
        }
        if (a >= 0xc2 && a <= 0xdf) {
            extra = 1;
            code = a & 31U;
            min = 0x80;
        } else if (a >= 0xe0 && a <= 0xef) {
            extra = 2;
            code = a & 15U;
            min = 0x800;
        } else if (a >= 0xf0 && a <= 0xf4) {
            extra = 3;
            code = a & 7U;
            min = 0x10000;
        } else {
            return false;
        }
        if (i + extra > n) {
            return false;
        }
        while (extra--) {
            unsigned b = s[i++];
            if ((b & 0xc0) != 0x80) {
                return false;
            }
            code = (code << 6) | (b & 63U);
        }
        if (code < min || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
            return false;
        }
    }
    return true;
}
static bool hs2_assign(Hs2Field *f, void *ctx) {
    Hs2Edit *e = ctx;
    if (strcmp(f->id, e->id)) {
        return true;
    }
    e->found = true;
    const cJSON *v = e->value;
    e->valid = false;
    if (f->type == HS2_TEXT || f->type == HS2_TOPOLOGY) {
        if (!cJSON_IsString(v)) {
            return true;
        }
        const char *s = v->valuestring;
        size_t n = strlen(s);
        if (f->type == HS2_TOPOLOGY) {
            e->valid = hs2_set_topology(f->value, s);
            return true;
        }
        if (!strncmp(f->id, "fuel.preset.", 12)) {
            unsigned slot = (unsigned)(f->id[12] - '0');
            for (int i = 0; i < HUGINN_FUEL_OPTION_COUNT; i++) {
                if (!strcmp(s, g_available_fuel_names[i])) {
                    e->valid = huginn_decode_fuel_preset_option(
                        i, &e->config->settings.fuel_presets[slot]);
                    break;
                }
            }
            return true;
        }
        if (n == 0 || n >= f->capacity || !hs2_utf8((const unsigned char *)s, n)) {
            return true;
        }
        if (!strncmp(f->id, "aux.", 4)) {
            for (size_t i = 0; i < n; i++) {
                if ((unsigned char)s[i] > 0x7e) {
                    return true;
                }
            }
        }
        if (!strncmp(f->id, "aux.", 4)) {
            memset(f->value, 0, 10);
            memcpy(f->value, s, n);
        } else {
            memset(f->value, 0, f->capacity);
            memcpy(f->value, s, n);
        }
        e->valid = true;
        return true;
    }
    if (f->type == HS2_BOOL) {
        if (cJSON_IsBool(v)) {
            *(bool *)f->value = cJSON_IsTrue(v);
            e->valid = true;
        }
        return true;
    }
    if (!cJSON_IsNumber(v) || !isfinite(v->valuedouble) ||
        v->valuedouble != floor(v->valuedouble) || v->valuedouble < f->min ||
        v->valuedouble > f->max) {
        return true;
    }
    int64_t n = (int64_t)v->valuedouble;
    if (!strcmp(f->id, "engine.cylinders") && n != 4 && n != 6) {
        return true;
    }
    if (!strcmp(f->id, "fuel.cruise_burn") && n % 5) {
        return true;
    }
    if (strstr(f->id, ".order") && n != 255 && n >= 3) {
        return true;
    }
    if (f->type == HS2_U8) {
        *(uint8_t *)f->value = (uint8_t)n;
    } else {
        *(int *)f->value = (int)n;
        if (f->other) {
            *(int *)f->other = (int)n;
        }
    }
    if (strstr(f->id, ".reference")) {
        unsigned i = 0;
        if (sscanf(f->id, "parameters.%u.reference", &i) == 1 &&
            i < HUGINN_ENGINE_PARAMETER_COUNT) {
            e->config->engine.profile.parameters[i].has_informational_reference = true;
        }
    }
    e->valid = true;
    return true;
}
static bool hs2_edit(Hs2Config *c, const char *id, const cJSON *value) {
    Hs2Edit e = {id, value, c, false, false};
    return hs2_fields(c, hs2_assign, &e) && e.found && e.valid;
}
static bool hs2_snapshot(Hs2Config *c) {
    HuginnCommittedConfigSnapshot *s = hs2_alloc(sizeof(*s));
    if (!s) {
        return false;
    }
    bool ok = huginn_committed_config_snapshot_copy(s);
    if (ok) {
        c->settings = s->settings;
        c->ports = s->ports_configuration;
        c->aux = s->aux_configuration;
        c->revision = s->config_revision;
        c->engine = g_aircraft_engine_configuration;
    }
    free(s);
    return ok;
}
static bool hs2_resolve_engine(Hs2Config *c) {
    if (c->engine.initialized && !strcmp(c->engine.profile.model, c->settings.engine_name) &&
        c->engine.profile.cylinder_count == c->settings.cylinders &&
        c->engine.profile.turbocharged == c->settings.turbo) {
        return true;
    }
    huginn_aircraft_engine_configuration_initialize_for_configuration(&c->settings, &c->engine);
    return c->engine.initialized;
}
static bool hs2_patch(Hs2Config *c, const cJSON *changes) {
    if (!cJSON_IsArray(changes) || cJSON_GetArraySize(changes) > 256) {
        return false;
    }
    for (const cJSON *a = changes->child; a; a = a->next) {
        if (!hs2_keys(a, "|field||value|", 2) || !cJSON_IsString(hs2_get(a, "field"))) {
            return false;
        }
        for (const cJSON *b = a->next; b; b = b->next) {
            if (hs2_string(hs2_get(b, "field"), hs2_get(a, "field")->valuestring)) {
                return false;
            }
        }
    }
    /* Identity, slot count, disabled flags and topology precede dependent values. */
    for (unsigned pass = 0; pass < 4; pass++) {
        for (const cJSON *a = changes->child; a; a = a->next) {
            const char *id = hs2_get(a, "field")->valuestring;
            unsigned phase = 3;
            if (!strcmp(id, "engine.name") || !strcmp(id, "engine.cylinders") ||
                !strcmp(id, "engine.turbo")) {
                phase = 0;
            } else if (!strcmp(id, "aux.count") ||
                       (strstr(id, ".enabled") && cJSON_IsFalse(hs2_get(a, "value")))) {
                phase = 1;
            } else if (strstr(id, ".topology")) {
                phase = 2;
            }
            if (phase == pass && !hs2_edit(c, id, hs2_get(a, "value"))) {
                return false;
            }
        }
        if (pass == 0 && !hs2_resolve_engine(c)) {
            return false;
        }
    }
    for (const cJSON *a = changes->child; a; a = a->next) {
        if (!strncmp(hs2_get(a, "field")->valuestring, "parameters.", 11)) {
            c->engine.source = HUGINN_ENGINE_CONFIG_SOURCE_USER_CUSTOM;
        }
    }
    for (unsigned i = 0; i < 4; i++) {
        HuginnAuxSlot *s = &c->aux.slots[i];
        if (i >= c->aux.enabled_count) {
            memset(s, 0, sizeof(*s));
        } else {
            s->priority = (uint8_t)i;
            s->label_length = (uint8_t)strnlen(s->label, 10);
        }
    }
    if (c->settings.fuel_usable_l > c->settings.fuel_total_l ||
        !huginn_ports_configuration_validate(&c->ports) ||
        !huginn_aux_configuration_validate(&c->aux) ||
        !huginn_engine_profile_configuration_valid(&c->engine.profile)) {
        return false;
    }
    for (unsigned i = 0; i < HUGINN_ENGINE_PARAMETER_COUNT; i++) {
        if (c->engine.profile.parameters[i].applicable &&
            !settings_engine_parameter_shape_valid(&c->engine.profile.parameters[i], false)) {
            return false;
        }
    }
    return true;
}
static bool hs2_install(Hs2Config *c) {
    g_settings = c->settings;
    g_aircraft_engine_configuration = c->engine;
    g_aux_draft_configuration = c->aux;
    return huginn_ports_runtime_configuration_install(&c->ports) &&
           huginn_settings_restore_derived_state();
}
static bool hs2_save(Hs2Config *c) {
    if (!huginn_settings_transaction_baseline_capture()) {
        return false;
    }
    if (!hs2_install(c)) {
        (void)huginn_settings_transaction_baseline_restore();
        return false;
    }
    bool restored = false;
    if (huginn_settings_save_if_changed(SETTINGS_SAVE_EXPLICIT_LIVE, &restored) != ESP_OK) {
        if (!restored) {
            (void)huginn_settings_transaction_baseline_restore();
        }
        huginn_settings_refresh_ui_after_rollback();
        return false;
    }
    if (!huginn_settings_transfer_readback_matches_saved_record()) {
        /* Restore the complete old aggregate, including engine/PORTS/AUX, before rollback save. */
        Hs2Config *old = hs2_alloc(sizeof(*old));
        bool ok = false;
        if (old) {
            old->settings = g_settings_transaction_baseline.committed_snapshot.settings;
            old->engine = g_settings_transaction_baseline.engine_configuration;
            old->ports = g_settings_transaction_baseline.committed_snapshot.ports_configuration;
            old->aux = g_settings_transaction_baseline.committed_snapshot.aux_configuration;
            ok =
                hs2_install(old) &&
                huginn_settings_save_if_changed(SETTINGS_SAVE_EXPLICIT_LIVE, &restored) == ESP_OK &&
                huginn_settings_transfer_readback_matches_saved_record();
            free(old);
        }
        if (!ok) {
            (void)huginn_settings_transaction_baseline_restore();
            huginn_committed_config_snapshot_publish(
                &g_settings_transaction_baseline.committed_snapshot);
            huginn_settings_persistence_inhibit("settings V2 readback rollback uncertain");
        }
        huginn_settings_refresh_ui_after_rollback();
        return false;
    }
    huginn_settings_refresh_ui_after_rollback();
    return true;
}
typedef struct {
    SemaphoreHandle_t done;
    int refs, cancelled;
    uint64_t epoch;
    bool apply;
    char device[18], digest[65];
    cJSON *input, *response;
} Hs2Job;
static struct {
    uint64_t epoch;
    uint32_t revision;
    int64_t expires;
    char digest[65];
} hs2_preview;
static portMUX_TYPE hs2_job_lock = portMUX_INITIALIZER_UNLOCKED;
static bool hs2_cancelled(Hs2Job *j) {
    portENTER_CRITICAL(&hs2_job_lock);
    bool cancelled = j->cancelled != 0;
    portEXIT_CRITICAL(&hs2_job_lock);
    return cancelled;
}
static void hs2_cancel(Hs2Job *j) {
    portENTER_CRITICAL(&hs2_job_lock);
    j->cancelled = 1;
    portEXIT_CRITICAL(&hs2_job_lock);
}
static void hs2_release(Hs2Job *j) {
    portENTER_CRITICAL(&hs2_job_lock);
    bool destroy = --j->refs == 0;
    portEXIT_CRITICAL(&hs2_job_lock);
    if (destroy) {
        vSemaphoreDelete(j->done);
        cJSON_Delete(j->input);
        cJSON_Delete(j->response);
        free(j);
    }
}
static void hs2_fail(Hs2Job *j, const char *why) {
    j->response = cJSON_CreateObject();
    cJSON_AddBoolToObject(j->response, "ok", false);
    cJSON_AddStringToObject(j->response, "error", why);
}
static void hs2_owner(void *arg) {
    Hs2Job *j = arg;
    Hs2Config *base = hs2_alloc(sizeof(*base)), *candidate = hs2_alloc(sizeof(*candidate));
    cJSON *before = NULL, *after = NULL;
    if (hs2_cancelled(j) || !hfa_current(j->epoch)) {
        hs2_fail(j, "AUTH_REQUIRED");
        goto done;
    }
    if (!base || !candidate) {
        hs2_fail(j, "OUT_OF_MEMORY");
        goto done;
    }
    if (g_settings_modal || !huginn_live_authority_available() ||
        huginn_settings_persistence_inhibited() || !hs2_snapshot(base)) {
        hs2_fail(j, "SETTINGS_BUSY_OR_UNAVAILABLE");
        goto done;
    }
    if (!j->input) {
        j->response = hs2_document(base, j->device);
        goto done;
    }
    cJSON *r = j->input;
    const cJSON *rev = hs2_get(r, "base_revision");
    if (!hs2_unique(r) ||
        !hs2_keys(r, "|schema||schema_version||product||source_device_id||base_revision||changes|",
                  6) ||
        !hs2_string(hs2_get(r, "schema"), "huginn.settings-transfer") ||
        !cJSON_IsNumber(hs2_get(r, "schema_version")) ||
        hs2_get(r, "schema_version")->valuedouble != 2 ||
        !hs2_string(hs2_get(r, "product"), "HuginnAPP") ||
        !hs2_string(hs2_get(r, "source_device_id"), j->device) || !cJSON_IsNumber(rev) ||
        rev->valuedouble != base->revision) {
        hs2_fail(j, "INVALID_OR_STALE_PACKAGE");
        goto done;
    }
    *candidate = *base;
    if (!hs2_patch(candidate, hs2_get(r, "changes"))) {
        hs2_fail(j, "INVALID_SETTINGS_OR_PROTECTED_FIELD");
        goto done;
    }
    before = hs2_document(base, j->device);
    after = hs2_document(candidate, j->device);
    if (!before || !after) {
        hs2_fail(j, "OUT_OF_MEMORY");
        goto done;
    }
    cJSON *diff = cJSON_CreateArray();
    if (!diff) {
        hs2_fail(j, "OUT_OF_MEMORY");
        goto done;
    }
    const cJSON *fields = hs2_get(after, "fields"), *previous = hs2_get(before, "fields");
    for (const cJSON *f = fields->child; f; f = f->next) {
        const char *id = hs2_get(f, "id")->valuestring;
        const cJSON *old = NULL;
        for (const cJSON *p = previous->child; p; p = p->next) {
            if (hs2_string(hs2_get(p, "id"), id)) {
                old = hs2_get(p, "value");
                break;
            }
        }
        const cJSON *value = hs2_get(f, "value");
        if (old && cJSON_Compare(old, value, true)) {
            continue;
        }
        cJSON *d = cJSON_CreateObject();
        if (!d) {
            cJSON_Delete(diff);
            hs2_fail(j, "OUT_OF_MEMORY");
            goto done;
        }
        cJSON_AddStringToObject(d, "field", id);
        cJSON_AddStringToObject(d, "label", hs2_get(f, "label")->valuestring);
        cJSON_AddItemToObject(d, "current", old ? cJSON_Duplicate(old, true) : cJSON_CreateNull());
        cJSON_AddItemToObject(d, "proposed", cJSON_Duplicate(value, true));
        cJSON_AddItemToArray(diff, d);
        if (!hs2_get(d, "field") || !hs2_get(d, "label") || !hs2_get(d, "current") ||
            !hs2_get(d, "proposed")) {
            cJSON_Delete(diff);
            hs2_fail(j, "OUT_OF_MEMORY");
            goto done;
        }
    }
    if (j->apply) {
        bool admitted = hs2_preview.epoch == j->epoch && hs2_preview.revision == base->revision &&
                        !strcmp(hs2_preview.digest, j->digest) &&
                        esp_timer_get_time() < hs2_preview.expires;
        memset(&hs2_preview, 0, sizeof(hs2_preview));
        if (!admitted || hs2_cancelled(j) || !hfa_current(j->epoch)) {
            cJSON_Delete(diff);
            hs2_fail(j, "PREVIEW_REQUIRED_OR_EXPIRED");
            goto done;
        }
        if (cJSON_GetArraySize(diff) && !hs2_save(candidate)) {
            cJSON_Delete(diff);
            hs2_fail(j, "SAVE_OR_READBACK_FAILED");
            goto done;
        }
        if (!hs2_snapshot(candidate)) {
            cJSON_Delete(diff);
            hs2_fail(j, "READBACK_UNAVAILABLE");
            goto done;
        }
        cJSON_Delete(after);
        after = hs2_document(candidate, j->device);
        if (!after) {
            cJSON_Delete(diff);
            hs2_fail(j, "READBACK_RESPONSE_UNAVAILABLE");
            goto done;
        }
    } else {
        hs2_preview.epoch = j->epoch;
        hs2_preview.revision = base->revision;
        hs2_preview.expires = esp_timer_get_time() + 120000000;
        snprintf(hs2_preview.digest, sizeof(hs2_preview.digest), "%s", j->digest);
    }
    j->response = cJSON_CreateObject();
    cJSON_AddBoolToObject(j->response, "ok", true);
    cJSON_AddBoolToObject(j->response, "applied", j->apply);
    cJSON_AddStringToObject(j->response, "sha256", j->digest);
    cJSON_AddStringToObject(j->response, "source_device_id", j->device);
    cJSON_AddNumberToObject(j->response, "base_revision", base->revision);
    cJSON_AddItemToObject(j->response, "changes", diff);
    cJSON_AddItemToObject(j->response, j->apply ? "settings" : "proposed", after);
    after = NULL;
done:
    cJSON_Delete(before);
    cJSON_Delete(after);
    free(base);
    free(candidate);
    xSemaphoreGive(j->done);
    hs2_release(j);
}
#ifndef HS2_HOST_MODEL
static void huginn_settings_v2_json_init(void) {
    cJSON_Hooks hooks = {hs2_json_alloc, free};
    cJSON_InitHooks(&hooks);
}
static esp_err_t huginn_settings_v2_handler(httpd_req_t *request) {
    hfa_headers_t headers;
    uint64_t epoch = 0;
    hfa_status_t admitted = hfa_request(request, &epoch, &headers);
    if (admitted != HFA_OK) {
        return hfa_http_error(request, admitted);
    }
    hfa_cors(request, &headers);
    hfa_scrub_request(request);
    const bool get = request->method == HTTP_GET,
               apply = !strcmp(request->uri, "/api/v2/settings/apply");
    bool route = get ? !strcmp(request->uri, "/api/v2/settings")
                     : request->method == HTTP_POST &&
                           (apply || !strcmp(request->uri, "/api/v2/settings/preview"));
    if (!route || headers.transfer_count || headers.content_length_count > 1 ||
        (!get &&
         (headers.content_type_count != 1 || strcmp(headers.content_type, "application/json"))) ||
        request->content_len > HS2_BODY_MAX || (get && request->content_len) ||
        (!get && !request->content_len)) {
        return httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "Invalid settings request");
    }
    /* cJSON is used only by this settings protocol. Its small allocations must not consume scarce
     * internal heap. */
    Hs2Job *j = hs2_alloc(sizeof(*j));
    if (!j) {
        return httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR,
                                   "Settings allocation failed");
    }
    j->done = xSemaphoreCreateBinary();
    j->refs = 1;
    j->epoch = epoch;
    j->apply = apply;
    uint8_t mac[6];
    if (!j->done || esp_wifi_get_mac(WIFI_IF_AP, mac) != ESP_OK) {
        if (j->done) {
            vSemaphoreDelete(j->done);
        }
        free(j);
        return httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR,
                                   "Settings identity unavailable");
    }
    snprintf(j->device, sizeof(j->device), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2],
             mac[3], mac[4], mac[5]);
    if (!get) {
        char *body = hs2_alloc((size_t)request->content_len + 1U);
        if (!body) {
            hs2_release(j);
            return httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR,
                                       "Settings allocation failed");
        }
        int have = 0;
        while (have < request->content_len) {
            int got = httpd_req_recv(request, body + have, (size_t)(request->content_len - have));
            if (got <= 0) {
                free(body);
                hs2_release(j);
                return ESP_FAIL;
            }
            have += got;
        }
        uint8_t sha[32] = {0};
        int hashed = mbedtls_sha256((const unsigned char *)body, (size_t)have, sha, 0);
        if (hashed) {
            free(body);
            hs2_release(j);
            return httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR,
                                       "Settings digest unavailable");
        }
        for (unsigned i = 0; i < 32; i++) {
            snprintf(j->digest + 2 * i, 3, "%02x", sha[i]);
        }
        if (hs2_request_bytes(body, (size_t)have)) {
            j->input = cJSON_ParseWithLengthOpts(body, (size_t)have + 1, NULL, true);
        }
        free(body);
        if (hashed || !j->input) {
            hs2_release(j);
            return httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "Invalid settings JSON");
        }
    }
    if (!lvgl_port_lock(1000)) {
        hs2_release(j);
        return httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR, "Settings busy");
    }
    j->refs = 2;
    lv_res_t queued = lv_async_call(hs2_owner, j);
    lvgl_port_unlock();
    if (queued != LV_RES_OK) {
        hs2_release(j);
        hs2_release(j);
        return httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR, "Settings busy");
    }
    if (xSemaphoreTake(j->done, pdMS_TO_TICKS(10000)) != pdTRUE) {
        hs2_cancel(j);
        hs2_release(j);
        httpd_resp_set_status(request, "504 Gateway Timeout");
        return httpd_resp_sendstr(request, "{\"ok\":false,\"error\":\"SAVE_UNCERTAIN_TIMEOUT\"}");
    }
    if (!hfa_current(epoch)) {
        hs2_release(j);
        return hfa_http_error(request, HFA_REVOKED);
    }
    char *response = j->response ? cJSON_PrintUnformatted(j->response) : NULL;
    esp_err_t result;
    if (!response || strlen(response) > HS2_RESPONSE_MAX) {
        result = httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR,
                                     "Settings response unavailable");
    } else {
        httpd_resp_set_type(request, "application/json");
        httpd_resp_set_hdr(request, "Cache-Control", "no-store");
        if (hs2_get(j->response, "ok") && cJSON_IsFalse(hs2_get(j->response, "ok"))) {
            httpd_resp_set_status(request, "409 Conflict");
        }
        result = httpd_resp_sendstr(request, response);
    }
    free(response);
    hs2_release(j);
    return result;
}
static esp_err_t huginn_settings_v2_preflight(httpd_req_t *request) {
    hfa_headers_t h;
    if (!hfa_headers(request, &h) || !hfa_origin(h.origin, strlen(h.origin), h.origin_count)) {
        return hfa_http_error(request, HFA_ORIGIN);
    }
    hfa_cors(request, &h);
    hfa_scrub_request(request);
    httpd_resp_set_hdr(request, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    httpd_resp_set_hdr(request, "Access-Control-Allow-Headers", "Authorization, Content-Type");
    httpd_resp_set_hdr(request, "Cache-Control", "no-store");
    httpd_resp_set_status(request, "204 No Content");
    return httpd_resp_send(request, NULL, 0);
}
#endif /* HS2_HOST_MODEL: host tests execute the exact LVGL-owner implementation */
#endif
