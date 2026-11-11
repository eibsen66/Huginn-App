"""Owner-authorized source preparation only. No configure, build, device or flash."""
from pathlib import Path
import hashlib, json, shutil, subprocess
ROOT=Path('C:/HuginnEIS/Huginn/Firmware/huginn')
HOME=Path('C:/HuginnEIS')
SDK=Path('C:/esp/v5.5.2/esp-idf')
HERE=Path(__file__).parent
OUT=Path('C:/HuginnAPP/build/rev24-preparation')
OUT.mkdir(parents=True,exist_ok=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(p): return {f.relative_to(p).as_posix():sha(f) for f in sorted(p.rglob('*')) if f.is_file() and '.git' not in f.parts and '__pycache__' not in f.parts}
def edit(p,old,new):
    s=p.read_text(encoding='utf8');assert s.count(old)==1,(p,old)
    p.write_text(s.replace(old,new),encoding='utf8',newline='\n')
def save(p,obj):
    with p.open('x',encoding='utf8') as f:json.dump(obj,f,indent=2)
assert not (ROOT/'components/mbedtls').exists(),'Preserve existing override'
original={n:tree(SDK/'components'/n) for n in ('mbedtls','esp-tls','esp_https_server')}
preserved={}
for folder in [ROOT/'build-rev2.3-20261104',HOME/'Evidence/REV2.3-PREPARATION',HOME/'Evidence/REV2.3-COM5']:
    for f in folder.rglob('*'):
        if f.is_file():preserved[f.as_posix()]=sha(f)
for f in list(HOME.glob('REV2.3*'))+list((HOME/'Tools').glob('rev23*')):
    if f.is_file():preserved[f.as_posix()]=sha(f)
save(OUT/'preservation-before.json',preserved)
shutil.copytree(SDK/'components/mbedtls',ROOT/'components/mbedtls',ignore=shutil.ignore_patterns('.git','__pycache__'))
subprocess.run(['git','-c','safe.directory='+HOME.as_posix(),'-C',str(ROOT),'apply','--check','C:/HuginnAPP/protocol/aes-output-allocation-cleanup.patch'],check=True)
subprocess.run(['git','-c','safe.directory='+HOME.as_posix(),'-C',str(ROOT),'apply','C:/HuginnAPP/protocol/aes-output-allocation-cleanup.patch'],check=True)
# Exact active S3 heap allocation sites; other architectures remain unchanged.
aes=ROOT/'components/mbedtls/port/aes/dma/esp_aes_dma_core.c'
edit(aes,'#include "esp_heap_caps.h"','#include "esp_heap_caps.h"\n#include "huginn_aes_alloc_diag.h"')
for var,size,caps,site,anchor in [
 ('input_buf','chunk_len','input_heap_caps','bounce_input','    if (realloc_input) {\n        input_buf ='),
 ('output_buf','chunk_len','output_heap_caps','bounce_output','    if (realloc_output) {\n        output_buf ='),
 ('block_desc','crypto_dma_desc_num * 2 * sizeof(crypto_dma_desc_t)','MALLOC_CAP_DMA','block_descriptors','        block_desc = heap_caps_aligned_calloc'),
 ('block_desc','((crypto_dma_desc_num * 2) + 1) * sizeof(crypto_dma_desc_t)','MALLOC_CAP_DMA','gcm_descriptors','    block_desc = heap_caps_calloc')]:
    s=aes.read_text();a=s.index(anchor);b=s.index('if ('+var+' == NULL) {',a)+len('if ('+var+' == NULL) {')
    indent='            ' if site=='block_descriptors' else '        '
    s=s[:b]+'\n'+indent+'huginn_aes_alloc_diag_failure('+size+', '+caps+', "'+site+'", __func__, __LINE__);'+s[b:]
    aes.write_text(s,encoding='utf8',newline='\n')
for name in ('huginn_aes_alloc_diag.c','huginn_aes_alloc_diag.h'):
    dest=ROOT/'components/mbedtls/port'/('include' if name.endswith('.h') else '')/name
    shutil.copyfile(HERE/name,dest)
cm=ROOT/'components/mbedtls/CMakeLists.txt'
edit(cm,'add_subdirectory(mbedtls)','add_subdirectory(mbedtls)\n# Rev. 2.4 bounded Settings allocation diagnostic, linked with actual AES code.\ntarget_sources(mbedcrypto PRIVATE "${COMPONENT_DIR}/port/huginn_aes_alloc_diag.c")\ntarget_link_libraries(mbedcrypto PRIVATE idf::esp_timer)')
diag=ROOT/'components/esp-tls/huginn_settings_send_diag.c'
edit(diag,'#include "huginn_settings_send_diag.h"','#include "huginn_settings_send_diag.h"\n#include "huginn_aes_alloc_diag.h"')
edit(diag,'    errno = saved_errno;\n    return started;','    if (started) {\n        huginn_aes_alloc_diag_begin(*id);\n    }\n    errno = saved_errno;\n    return started;')
edit(diag,'    errno = saved_errno;\n    return ended;','    if (ended) {\n        huginn_aes_alloc_diag_end();\n    }\n    errno = saved_errno;\n    return ended;')
for p,old,new in [(ROOT/'CMakeLists.txt','set(PROJECT_VER "HuginnEIS Rev. 2.3")','set(PROJECT_VER "HuginnEIS Rev. 2.4")'),(ROOT/'main/main.c','#define HUGINN_BUILD_ID "HuginnEIS Rev. 2.3"','#define HUGINN_BUILD_ID "HuginnEIS Rev. 2.4"')]:edit(p,old,new)
for f in HOME.glob('REV2.3-OWNER-*.ps1'):
    target=HOME/f.name.replace('2.3','2.4');assert not target.exists()
    target.write_text(f.read_text().replace('2.3','2.4').replace('rev23','rev24'),encoding='utf8',newline='\n')
for name in ('rev23_release.py','rev23_capture.py','rev23_read_diagnostic.py'):
    target=HOME/'Tools'/name.replace('23','24');assert not target.exists()
    target.write_text((HOME/'Tools'/name).read_text().replace('2.3','2.4').replace('rev23','rev24').replace(r'2\.3',r'2\.4'),encoding='utf8',newline='\n')
save(HOME/'Tools/rev24-diagnostic-inputs.json',{'original':original,'local':{n:tree(ROOT/'components'/n) for n in original}})
assert all(sha(Path(p))==h for p,h in preserved.items())
assert all(tree(SDK/'components'/n)==v for n,v in original.items())
save(OUT/'preservation-after.json',{'all_retained_unchanged':True,'shared_sdk_unchanged':True,'files':len(preserved)})
print('Prepared Rev. 2.4 source; release checks still to be extended; no target build')
