"""Apply authorized local measurement, extend constraints, prepare owner scripts only."""
from pathlib import Path
import hashlib,json,subprocess
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');home=Path('C:/HuginnEIS');tools=home/'Tools';out=Path('C:/HuginnAPP/build/rev26-preparation');out.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(p):return {f.relative_to(p).as_posix():sha(f) for f in sorted(p.rglob('*')) if f.is_file() and '.git' not in f.parts and '__pycache__' not in f.parts}
patch=Path('C:/HuginnAPP/protocol/aes-output-heap-observation.patch')
preserved={}
for folder in list(root.glob('build-rev2.5-*'))+list((home/'Evidence').glob('REV2.5-*')):
 for p in folder.rglob('*'):
  if p.is_file():preserved[p.as_posix()]=sha(p)
for p in list(home.glob('REV2.5*'))+list(tools.glob('rev25*')):
 if p.is_file():preserved[p.as_posix()]=sha(p)
(out/'rev25-preservation.json').write_text(json.dumps(preserved,indent=2))
paths=['components/mbedtls/port/aes/dma/esp_aes_dma_core.c','components/mbedtls/port/huginn_aes_alloc_diag.c','components/mbedtls/port/include/huginn_aes_alloc_diag.h','main/main.c','CMakeLists.txt']
for p in paths:
 dest=out/'before'/p;dest.parent.mkdir(parents=True,exist_ok=True)
 with dest.open('xb') as f:f.write((root/p).read_bytes())
sdk=Path('C:/esp/v5.5.2/esp-idf');sdk_pins={n:tree(sdk/'components'/n) for n in ['mbedtls','esp-tls','esp_https_server']}
for args in [['--check'],[]]:subprocess.run(['git','-c','safe.directory=C:/HuginnEIS','-C',str(root),'apply',*args,str(patch)],check=True)
def edit(p,a,b):
 s=p.read_text();assert s.count(a)==1,(p,a);p.write_text(s.replace(a,b),encoding='utf8',newline='\n')
aes=root/paths[0];diag=root/paths[1];header=root/paths[2]
edit(aes,'        huginn_aes_output_probe_before(', '        huginn_aes_output_probe_constraints(input, output);\n        huginn_aes_output_probe_before(')
with header.open('a',encoding='utf8',newline='\n') as f:f.write('\nvoid huginn_aes_output_probe_constraints(const void *input, const void *output);\n')
edit(diag,'#include "esp_heap_caps.h"','#include "esp_heap_caps.h"\n#include "esp_memory_utils.h"\n#include "esp_cache.h"')
edit(diag,'    int64_t before_us, after_us;','    int64_t before_us, after_us;\n    size_t cache_line, input_mod_cache, output_mod_cache;\n    unsigned input_mod16, output_mod16;\n    bool input_dma, output_dma;\n    int cache_result;')
edit(diag,'void huginn_aes_output_probe_before(','''void huginn_aes_output_probe_constraints(const void *input, const void *output)
{
    const int saved_errno = errno;
    if (!xPortInIsrContext() && active && owner == xTaskGetCurrentTaskHandle() && !output_probe_failed) {
        /* Record only classifications and offsets, never raw addresses/data. */
        output_probe.input_dma = esp_ptr_dma_capable(input) || esp_ptr_dma_ext_capable(input);
        output_probe.output_dma = esp_ptr_dma_capable(output) || esp_ptr_dma_ext_capable(output);
        output_probe.input_mod16 = (unsigned)((uintptr_t)input & 15U);
        output_probe.output_mod16 = (unsigned)((uintptr_t)output & 15U);
        output_probe.cache_line = 0;
        output_probe.cache_result = ESP_OK;
        if (esp_ptr_external_ram(input) || esp_ptr_external_ram(output)) {
            output_probe.cache_result = esp_cache_get_alignment(MALLOC_CAP_SPIRAM, &output_probe.cache_line);
        }
        output_probe.input_mod_cache = esp_ptr_external_ram(input) && output_probe.cache_line
            ? (uintptr_t)input % output_probe.cache_line : 0;
        output_probe.output_mod_cache = esp_ptr_external_ram(output) && output_probe.cache_line
            ? (uintptr_t)output % output_probe.cache_line : 0;
    }
    errno = saved_errno;
}
void huginn_aes_output_probe_before(''')
edit(diag,'"id=%u task=%lu bytes=%u caps=%u length=%u requested_alignment=', '"site=bounce_output function=esp_aes_process_dma_ext_ram id=%u task=%lu bytes=%u caps=%u length=%u requested_alignment=')
edit(diag,'before_us=%lld after_us=%lld"','before_us=%lld after_us=%lld input_dma=%u output_dma=%u cache_line=%u input_mod_cache=%u output_mod_cache=%u input_mod16=%u output_mod16=%u cache_result=%d"')
edit(diag,'(long long)output_probe.before_us,(long long)output_probe.after_us);','''(long long)output_probe.before_us,(long long)output_probe.after_us,
                (unsigned)output_probe.input_dma,(unsigned)output_probe.output_dma,
                (unsigned)output_probe.cache_line,(unsigned)output_probe.input_mod_cache,(unsigned)output_probe.output_mod_cache,
                output_probe.input_mod16,output_probe.output_mod16,output_probe.cache_result);''')
for p in [root/'main/main.c',root/'CMakeLists.txt']:
 b=p.read_bytes();assert b.count(b'HuginnEIS Rev. 2.5')==1;p.write_bytes(b.replace(b'HuginnEIS Rev. 2.5',b'HuginnEIS Rev. 2.6'))
def trans(s):return s.replace('2.5','2.6').replace('rev25','rev26').replace('Rev25','Rev26').replace(r'2\.5',r'2\.6')
for p in home.glob('REV2.5-OWNER-*.ps1'):
 dest=home/p.name.replace('2.5','2.6');assert not dest.exists();dest.write_text(trans(p.read_text()),encoding='utf8',newline='\n')
for name in ['release.py','capture.py','read_diagnostic.py']:
 dest=tools/('rev26_'+name);assert not dest.exists();dest.write_text(trans((tools/('rev25_'+name)).read_text()),encoding='utf8',newline='\n')
new_pins={'original':sdk_pins,'local':{n:tree(root/'components'/n) for n in sdk_pins}}
for name,obj in [('diagnostic-inputs',new_pins),('preserved-inputs',preserved)]:
 p=tools/('rev26-'+name+'.json');assert not p.exists();p.write_text(json.dumps(obj,indent=2),encoding='utf8')
# Require the observation functions to be linked, not just a patch on disk.
p=tools/'rev26_release.py';edit(p,"'huginn_aes_alloc_diag_end'):","'huginn_aes_alloc_diag_end','huginn_aes_output_probe_before','huginn_aes_output_probe_after','huginn_aes_output_probe_constraints'):")
# Saved-reader output remains numeric/allowlisted; no old-capture fallback.
p=tools/'rev26_read_diagnostic.py';s=p.read_text();at=s.index('\ndef main():')
s=s[:at]+'''
DMA_FIELDS={'id','task','bytes','caps','length','requested_alignment','input_bounce','in_place','input_external','output_external','before_free','before_largest','before_blocks','after_free','after_largest','after_blocks','before_us','after_us','input_dma','output_dma','cache_line','input_mod_cache','output_mod_cache','input_mod16','output_mod16','cache_result'}
def dma_heap_records(text):
    result=[]
    for line in text.splitlines():
        if 'HS2_DMA_HEAP:' not in line:continue
        fields={k:int(v) for k,v in re.findall(r'\\b([a-z_0-9]+)=(-?\\d+)\\b',line.split('HS2_DMA_HEAP:',1)[1]) if k in DMA_FIELDS}
        if set(fields)!=DMA_FIELDS:continue # incomplete lines never masquerade as full samples
        result.append({'site':'bounce_output','function':'esp_aes_process_dma_ext_ram',**fields})
    return result
'''+s[at:]
s=s.replace("'settings_send_records':found", "'dma_heap_observations':dma_heap_records(raw.decode('utf8',errors='replace')),'dma_heap_lines_incomplete':sum(1 for line in raw.decode('utf8',errors='replace').splitlines() if 'HS2_DMA_HEAP:' in line)-len(dma_heap_records(raw.decode('utf8',errors='replace'))),'settings_send_records':found")
p.write_text(s,encoding='utf8',newline='\n')
# Existing release tests work with the new evidence namespace and receipt.
Path('C:/HuginnAPP/protocol/test-rev26-owner.py').write_text(trans(Path('C:/HuginnAPP/protocol/test-rev25-owner.py').read_text()),encoding='utf8')
assert all(sha(Path(p))==h for p,h in preserved.items())
assert all(tree(sdk/'components'/n)==v for n,v in sdk_pins.items())
(out/'applied.json').write_text(json.dumps({'reviewed_patch_sha256':sha(patch),'rev25_files_unchanged':len(preserved),'shared_sdk_unchanged':True,'source_revision':'HuginnEIS Rev. 2.6','target_built':False},indent=2))
print('Applied reviewed local measurement plus buffer-constraint detail; prepared Rev. 2.6 scripts; retained',len(preserved),'Rev. 2.5 files unchanged; shared SDK unchanged.')
