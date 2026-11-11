#pragma once
#include <stddef.h>
#include <stdint.h>
void huginn_aes_alloc_diag_begin(uint32_t id);
void huginn_aes_alloc_diag_failure(size_t bytes, uint32_t caps, const char *site,
                                   const char *function, unsigned line);
void huginn_aes_alloc_diag_end(void);
