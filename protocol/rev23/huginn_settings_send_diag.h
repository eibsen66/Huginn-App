#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
typedef struct {
    uint32_t id;
    size_t expected, accepted, tls_requested, https_requested;
    unsigned tls_calls;
    int tls_return, tls_errno, https_return, https_errno;
} huginn_settings_send_diag_t;
bool huginn_settings_send_diag_begin(const void *body, size_t size, uint32_t *id);
bool huginn_settings_send_diag_end(huginn_settings_send_diag_t *result);
void huginn_settings_send_diag_tls(const void *data, size_t requested, int result, int saved_errno);
void huginn_settings_send_diag_https(size_t requested, int result, int saved_errno);
