from pathlib import Path
p=Path('C:/HuginnEIS/Huginn/Firmware/huginn/components/mbedtls/port/huginn_aes_alloc_diag.c')
s=p.read_text();assert s.count('#include "esp_cache.h"')==1
p.write_text(s.replace('#include "esp_cache.h"','#include "esp_cache.h"\n#include "esp_private/esp_cache_private.h"'),encoding='utf8',newline='\n')
p=Path('C:/HuginnAPP/build/rev26-preparation/stubs/esp_private/esp_cache_private.h');p.parent.mkdir(exist_ok=True);p.write_text('#include "esp_cache.h"\n')
