/* Task/request scoped, bounded RAM only in failure path. No global heap hook. */
#include "huginn_aes_alloc_diag.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include "esp_log.h"
#include <errno.h>
#include <limits.h>
#include <stdbool.h>
#include <string.h>
#define RECORDS 8U
typedef struct {
    size_t bytes;
    uint32_t caps;
    const char *site, *function; /* compile-time literals only */
    unsigned line;
    int64_t elapsed;
} allocation_record;
/* One byte of task TLS, created with the task, never allocated in this hook.
 * Other tasks return before touching the request's shared record buffer.
 * begin/end are called only by the single HTTPD server task. */
static __thread bool active;
static TaskHandle_t owner;
static uint32_t request_id;
static int64_t started;
static allocation_record records[RECORDS];
static unsigned used, dropped;
static char task_name[configMAX_TASK_NAME_LEN];
void huginn_aes_alloc_diag_begin(uint32_t id)
{
    const int saved_errno = errno;
    /* Only the serialized Settings server task owns this scope. Other tasks
     * cannot write it; ISR calls are excluded before task lookup below. */
    if (owner == NULL) {
        request_id = id;
        used = dropped = 0;
        started = esp_timer_get_time();
        const char *name = pcTaskGetName(NULL);
        size_t i = 0;
        while (i + 1 < sizeof(task_name) && name[i]) {
            task_name[i] = name[i];
            ++i;
        }
        task_name[i] = 0;
        owner = xTaskGetCurrentTaskHandle();
        active = true;
    }
    errno = saved_errno;
}
void huginn_aes_alloc_diag_failure(size_t bytes, uint32_t caps, const char *site,
                                   const char *function, unsigned line)
{
    const int saved_errno = errno;
    if (!xPortInIsrContext() && active && owner == xTaskGetCurrentTaskHandle()) {
        if (used < RECORDS) {
            records[used++] = (allocation_record){bytes, caps, site, function, line,
                                                  esp_timer_get_time() - started};
        } else if (dropped != UINT_MAX) {
            ++dropped;
        }
    }
    errno = saved_errno;
}
void huginn_aes_alloc_diag_end(void)
{
    const int saved_errno = errno;
    if (active && owner == xTaskGetCurrentTaskHandle()) {
        const uintptr_t task = (uintptr_t)owner;
        owner = NULL; /* Reporting is outside the failure hook/AES hardware lock. */
        active = false;
        ESP_LOGI("HS2_ALLOC", "summary id=%u records=%u dropped=%u task=%lu name=%s",
                 (unsigned)request_id, used, dropped, (unsigned long)task, task_name);
        for (unsigned i = 0; i < used; ++i) {
            const allocation_record *r = &records[i];
            ESP_LOGI("HS2_ALLOC", "failure id=%u index=%u bytes=%u caps=%u site=%s function=%s line=%u task=%lu elapsed_us=%lld",
                     (unsigned)request_id, i, (unsigned)r->bytes, (unsigned)r->caps,
                     r->site, r->function, r->line, (unsigned long)task, (long long)r->elapsed);
        }
    }
    errno = saved_errno;
}
