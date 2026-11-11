from pathlib import Path
import json,shlex,subprocess
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn')
out=Path('C:/HuginnAPP/build/aes-scratch-candidate')
build=root/'build-rev2.6-20261105'
path='components/mbedtls/port/aes/dma/esp_aes_dma_core.c'
commands=json.loads((build/'compile_commands.json').read_text())
c=next(c for c in commands if Path(c['file']).resolve()==(root/path).resolve())
args=shlex.split(c['command'].replace('\\"','"'),posix=False)
args=[a[1:-1] if a.startswith('"') and a.endswith('"') else a for a in args]
clean=[];skip=False
for a in args:
 if skip:skip=False;continue
 if a in ['-o','-MF','-MT','-MQ']:skip=True;continue
 if a in ['-c','-MD','-MMD','-MP']:continue
 clean.append(a)
original=next(a for a in clean if a.replace('\\','/').endswith('/'+path))
clean[clean.index(original)]=str(out/'esp_aes_dma_core.c')
clean+=['-fsyntax-only','-Wall','-Werror=misleading-indentation']
probe=out/'target-layout.c'
probe.write_text('#include "sdkconfig.h"\n#include "esp_heap_caps.h"\n#include "esp_crypto_dma.h"\n_Static_assert(CONFIG_IDF_TARGET_ESP32S3 == 1, "S3");\n_Static_assert(MALLOC_CAP_DMA == 8, "caps");\n_Static_assert(sizeof(crypto_dma_desc_t) == 12, "descriptor layout");\n_Static_assert(1024 % 16 == 0, "AES block boundary");\n')
results=[]
for name,source in [('candidate',out/'esp_aes_dma_core.c'),('target-layout',probe)]:
 cmd=[str(source) if a==str(out/'esp_aes_dma_core.c') else a for a in clean]
 p=subprocess.run(cmd,cwd=build,capture_output=True,text=True)
 (out/(name+'.syntax.log')).write_text(p.stdout+p.stderr)
 results.append(dict(name=name,exit_code=p.returncode,command=cmd,mode='Xtensa syntax only; retained Rev. 2.6 generated headers; no target build'))
 print(name,p.returncode,p.stderr[-400:])
(out/'syntax-checks.json').write_text(json.dumps(results,indent=2))
assert all(r['exit_code']==0 for r in results)
