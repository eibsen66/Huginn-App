from pathlib import Path
import json,hashlib
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');out=Path('C:/HuginnAPP/build/rev26-preparation')
def extract(s,sig):
 a=s.index(sig);i=s.index('{',a);n=1;j=i+1
 while n:
  if s[j]=='{':n+=1
  if s[j]=='}':n-=1
  j+=1
 return s[a:j]
diag='components/mbedtls/port/huginn_aes_alloc_diag.c';old=(out/'before'/diag).read_text();new=(root/diag).read_text()
assert extract(old,'void huginn_aes_alloc_diag_failure(')==extract(new,'void huginn_aes_alloc_diag_failure('),'RAM-only failure hook changed'
aes='components/mbedtls/port/aes/dma/esp_aes_dma_core.c';old=(out/'before'/aes).read_text();new=(root/aes).read_text()
injection='''        /* Normal request context, never an allocator callback. No policy change. */
        huginn_aes_output_probe_constraints(input, output);
        huginn_aes_output_probe_before(len, chunk_len, output_alignment, output_heap_caps,
                                       realloc_input, input == output,
                                       esp_ptr_external_ram(input), esp_ptr_external_ram(output));
'''
assert new.count(injection)==1
assert new.replace(injection,'').replace('        huginn_aes_output_probe_after(output_buf == NULL);\n','')==old,'AES behavior delta beyond observations'
pins=json.loads((root/'build-rev2.5-20261105/owner-build-start.json').read_text())['sources']
changed=[p for p,h in pins.items() if not (root/p).is_file() or hashlib.sha256((root/p).read_bytes()).hexdigest()!=h]
expected=['CMakeLists.txt','main/main.c',aes,diag,'components/mbedtls/port/include/huginn_aes_alloc_diag.h'];assert sorted(changed)==sorted(expected),changed
(out/'behavior-audit.json').write_text(json.dumps({'ram_only_failure_hook_exact':True,'aes_identical_after_removing_observations':True,'changed_firmware_inputs':changed,'transport_tls_configuration_allocator_policy_retries_cleanup_unchanged':True},indent=2))
print('PASS unchanged failure hook and AES behavior after removing observation calls; exactly five firmware inputs changed')
