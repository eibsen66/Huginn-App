"""Extend owner verification for the local mbedTLS override, without building."""
from pathlib import Path
import shutil
home=Path('C:/HuginnEIS');tools=home/'Tools'
p=tools/'rev24_release.py';s=p.read_text()
s=s.replace("('esp-tls','esp_https_server'):","('esp-tls','esp_https_server','mbedtls'):",1)
s=s.replace("'esp_https_server':['src/https_server.c']", "'esp_https_server':['src/https_server.c'],'mbedtls':['port/aes/dma/esp_aes_dma_core.c','port/huginn_aes_alloc_diag.c','port/dynamic/esp_ssl_tls.c']")
s=s.replace("(SDK/'components/esp_https_server/src/https_server.c').resolve()]", "(SDK/'components/esp_https_server/src/https_server.c').resolve(),(SDK/'components/mbedtls/port/aes/dma/esp_aes_dma_core.c').resolve(),(SDK/'components/mbedtls/port/huginn_aes_alloc_diag.c').resolve()]")
s=s.replace("'huginn_settings_send_diag_https'):","'huginn_settings_send_diag_https','huginn_aes_alloc_diag_begin','huginn_aes_alloc_diag_failure','huginn_aes_alloc_diag_end'):")
anchor="    for n in ('esp-tls','esp_https_server'):need"
assert anchor in s
at=s.index(anchor)
s=s[:at]+'''    map_text=(build/'lvgl_porting.map').read_text().replace('\\\\','/')
    for obj in ('esp_aes_dma_core.c.obj','huginn_aes_alloc_diag.c.obj'):
        need('libmbedcrypto.a('+obj+')' in map_text,'Local AES/diagnostic object not linked '+obj)
    need('--wrap=mbedtls_ssl_write' in (build/'build.ninja').read_text(),'Dynamic TLS wrapper missing')
'''+s[at:]
p.write_text(s,encoding='utf8',newline='\n')
# Reader keeps only explicitly allowlisted tags, fields, and constant site/function names.
p=tools/'rev24_read_diagnostic.py';s=p.read_text()
at=s.index('\ndef main():')
s=s[:at]+'''
def allocation_records(text):
    result=[]
    numeric={'id','records','dropped','task','index','bytes','caps','line','elapsed_us'}
    sites={'bounce_input','bounce_output','block_descriptors','gcm_descriptors'}
    functions={'esp_aes_process_dma_ext_ram','esp_aes_process_dma','esp_aes_process_dma_gcm'}
    for line in text.splitlines():
        m=re.search(r'HS2_ALLOC:\\s*(summary|failure)\\b(.*)',line)
        if not m:continue
        fields={k:int(v) for k,v in re.findall(r'\\b([a-z_]+)=(-?\\d+)\\b',m[2]) if k in numeric}
        if 'id' not in fields:continue
        for key,allowed in [('site',sites),('function',functions)]:
            value=re.search(r'\\b'+key+r'=([a-zA-Z0-9_]+)\\b',m[2])
            if value and value[1] in allowed:fields[key]=value[1]
        result.append({'event':m[1],**fields})
    return result
'''+s[at:]
s=s.replace("'settings_send_records':found", "'settings_send_records':found,'allocation_failure_records':allocation_records(raw.decode('utf8',errors='replace'))")
p.write_text(s,encoding='utf8',newline='\n')
# Adapt existing fixture tests; add mbedTLS source selection to their fixture.
source=Path('C:/HuginnAPP/protocol/rev23/test-owner.py').read_text().replace('rev23','rev24').replace('2.3','2.4')
source=source.replace("('esp-tls','esp_https_server')}}", "('esp-tls','esp_https_server','mbedtls')}}")
source=source.replace("('esp_https_server','src/https_server.c')]]", "('esp_https_server','src/https_server.c'),('mbedtls','port/aes/dma/esp_aes_dma_core.c'),('mbedtls','port/huginn_aes_alloc_diag.c'),('mbedtls','port/dynamic/esp_ssl_tls.c')]]")
Path('C:/HuginnAPP/protocol/rev24/test-owner.py').write_text(source,encoding='utf8')
print('Owner verification and sanitized allocation reader prepared; no compilation')
