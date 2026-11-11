/* Host-only owner/NVS seams; the real firmware uses its existing NVS transaction.
 * Fault injection here is not a power-loss or physical-persistence claim. */
typedef struct {HuginnSettings settings;HuginnPortsConfiguration ports_configuration;HuginnAuxConfiguration aux_configuration;bool aux_v6_present;uint32_t config_revision;} HuginnCommittedConfigSnapshot;
static HuginnCommittedConfigSnapshot committed;
static HuginnAuxConfiguration g_aux_draft_configuration;
static HuginnPortsConfiguration runtime_ports;
static struct {HuginnCommittedConfigSnapshot committed_snapshot;HuginnAircraftEngineConfiguration engine_configuration;} g_settings_transaction_baseline;
static bool inhibited=false,busy=false,authorized=true,persist_fail=false;
static int readback_fail=0;
static char protected_state[256],fuel_state[64],fault_state[128],recordings[256];
static void *g_settings_modal=NULL;
static bool huginn_committed_config_snapshot_copy(HuginnCommittedConfigSnapshot *s){*s=committed;return true;}
static bool huginn_settings_transaction_baseline_capture(void){g_settings_transaction_baseline.committed_snapshot=committed;g_settings_transaction_baseline.engine_configuration=g_aircraft_engine_configuration;return true;}
static bool huginn_settings_transaction_baseline_restore(void){committed=g_settings_transaction_baseline.committed_snapshot;g_settings=committed.settings;runtime_ports=committed.ports_configuration;g_aux_draft_configuration=committed.aux_configuration;g_aircraft_engine_configuration=g_settings_transaction_baseline.engine_configuration;return true;}
static void huginn_committed_config_snapshot_publish(const HuginnCommittedConfigSnapshot *s){committed=*s;}
static void huginn_settings_persistence_inhibit(const char *reason){(void)reason;inhibited=true;}
static bool huginn_settings_persistence_inhibited(void){return inhibited;}
static bool huginn_live_authority_available(void){return !busy;}
static bool huginn_settings_restore_derived_state(void){return true;}
static void huginn_settings_refresh_ui_after_rollback(void){}
/* Rename the runtime installation seam; actual validation is still linked. */
static bool host_install_ports(const HuginnPortsConfiguration *p){if(!huginn_ports_configuration_validate(p))return false;runtime_ports=*p;return true;}
#define huginn_ports_runtime_configuration_install host_install_ports
#define SETTINGS_SAVE_EXPLICIT_LIVE 1
#define ESP_OK 0
static int huginn_settings_save_if_changed(int intent,bool *restored){(void)intent;*restored=false;if(persist_fail)return -1;committed.settings=g_settings;committed.ports_configuration=runtime_ports;committed.aux_configuration=g_aux_draft_configuration;committed.config_revision++;return ESP_OK;}
static bool huginn_settings_transfer_readback_matches_saved_record(void){if(readback_fail){readback_fail--;return false;}return true;}
typedef void *SemaphoreHandle_t;
static int xSemaphoreGive(SemaphoreHandle_t s){(void)s;return 1;}
static void vSemaphoreDelete(SemaphoreHandle_t s){(void)s;}
static bool hfa_current(uint64_t epoch){return authorized&&epoch==1;}
static int64_t esp_timer_get_time(void){return 1000000;}
#define MALLOC_CAP_SPIRAM 1
#define MALLOC_CAP_8BIT 2
static void *heap_caps_calloc(size_t n,size_t b,int caps){(void)caps;return calloc(n,b);}
static void *heap_caps_malloc(size_t n,int caps){(void)caps;return malloc(n);}
