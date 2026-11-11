import json,shlex,subprocess
from pathlib import Path
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');build=root/'build-rev2.8-20261107';out=Path('C:/HuginnAPP/build/rev29-review')
commands=json.loads((build/'compile_commands.json').read_text());results=[]
probe=out/'target-layout.c';probe.write_text('#include "sdkconfig.h"\n#include "esp_heap_caps.h"\n#include "esp_crypto_dma.h"\n_Static_assert(CONFIG_IDF_TARGET_ESP32S3==1,"S3");\n_Static_assert(MALLOC_CAP_DMA==8,"caps");\n_Static_assert(sizeof(crypto_dma_desc_t)==12,"descriptor");\n_Static_assert(512%16==0,"AES block");\n')
for rel in ('components/mbedtls/port/aes/dma/esp_aes_dma_core.c','components/mbedtls/port/crypto_shared_gdma/esp_crypto_shared_gdma.c'):
 c=next(c for c in commands if Path(c['file']).resolve()==(root/rel).resolve());args=shlex.split(c['command'].replace('\\"','"'),posix=False);args=[a[1:-1] if a.startswith('"') and a.endswith('"') else a for a in args]
 clean=[];skip=False
 for a in args:
  if skip:skip=False;continue
  if a in ('-o','-MF','-MT','-MQ'):skip=True;continue
  if a in ('-c','-MD','-MMD','-MP'):continue
  clean.append(a)
 for source in ([root/rel,probe] if 'dma_core' in rel else [root/rel]):
  cmd=[str(source) if a.replace('\\','/').endswith('/'+rel) else a for a in clean]+['-fsyntax-only','-Wall','-Wextra','-Werror']
  p=subprocess.run(cmd,cwd=build,capture_output=True,text=True);name=source.name;(out/(name+'.syntax.log')).write_text(p.stdout+p.stderr);results.append({'file':name,'exit_code':p.returncode,'command':cmd});print(name,p.returncode,p.stderr[-600:])
(out/'syntax-checks.json').write_text(json.dumps(results,indent=2));assert all(r['exit_code']==0 for r in results)
