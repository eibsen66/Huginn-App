#ifndef HUGINN_COURIER_SPKI_H
#define HUGINN_COURIER_SPKI_H
#include <stddef.h>
#include <stdint.h>
/* Returns a slice of the original certificate DER, including SPKI tag/length.
 * No key re-encoding. Call only after platform X.509 chain validation. */
int huginn_spki_slice(const uint8_t *der, size_t size, size_t *offset, size_t *length);
int huginn_ip_san(const uint8_t *der, size_t size);
#endif
