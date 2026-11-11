/* RAM-only measurement. No I/O, allocation, transport decision or payload logging. */
#include "huginn_settings_send_diag.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <errno.h>
#include <limits.h>
#include <string.h>
static portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
static TaskHandle_t owner;
static uintptr_t body_start, body_end;
static uint32_t sequence;
static huginn_settings_send_diag_t current;
bool huginn_settings_send_diag_begin(const void *body, size_t size, uint32_t *id)
{
    const int saved_errno = errno;
    const TaskHandle_t task = xTaskGetCurrentTaskHandle();
    bool started = false;
    portENTER_CRITICAL(&lock);
    if (owner == NULL && body != NULL && size > 0 && size <= 131072U &&
        (uintptr_t)body <= UINTPTR_MAX - size) {
        memset(&current, 0, sizeof(current));
        if (++sequence == 0) { ++sequence; }
        current.id = sequence;
        current.expected = size;
        body_start = (uintptr_t)body;
        body_end = body_start + size;
        owner = task;
        *id = current.id;
        started = true;
    }
    portEXIT_CRITICAL(&lock);
    errno = saved_errno;
    return started;
}
void huginn_settings_send_diag_tls(const void *data, size_t requested, int result, int saved_errno)
{
    const int entry_errno = errno;
    const TaskHandle_t task = xTaskGetCurrentTaskHandle();
    portENTER_CRITICAL(&lock);
    if (owner != NULL && task == owner) {
        if (current.tls_calls != UINT_MAX) { ++current.tls_calls; }
        current.tls_requested = requested;
        current.tls_return = result;
        current.tls_errno = saved_errno;
        const uintptr_t p = (uintptr_t)data;
        /* Only accepted bytes in the caller-owned JSON range count as body.
         * HTTP headers and writes in any other task are excluded. */
        if (result > 0 && (size_t)result <= requested && p >= body_start &&
            p < body_end && (size_t)result <= body_end - p &&
            (size_t)result <= current.expected - current.accepted) {
            current.accepted += (size_t)result;
        }
    }
    portEXIT_CRITICAL(&lock);
    errno = entry_errno;
}
void huginn_settings_send_diag_https(size_t requested, int result, int saved_errno)
{
    const int entry_errno = errno;
    const TaskHandle_t task = xTaskGetCurrentTaskHandle();
    portENTER_CRITICAL(&lock);
    if (owner != NULL && task == owner) {
        current.https_requested = requested;
        current.https_return = result;
        current.https_errno = saved_errno;
    }
    portEXIT_CRITICAL(&lock);
    errno = entry_errno;
}
bool huginn_settings_send_diag_end(huginn_settings_send_diag_t *result)
{
    const int saved_errno = errno;
    const TaskHandle_t task = xTaskGetCurrentTaskHandle();
    bool ended = false;
    portENTER_CRITICAL(&lock);
    if (owner != NULL && owner == task && result != NULL) {
        *result = current;
        owner = NULL;
        body_start = body_end = 0;
        ended = true;
    }
    portEXIT_CRITICAL(&lock);
    errno = saved_errno;
    return ended;
}
