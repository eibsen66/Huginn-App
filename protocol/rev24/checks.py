"""Focused host/syntax checks, never invokes target configure/build/link."""
import json,shlex,subprocess
from pathlib import Path
ROOT=Path('C:/HuginnEIS/Huginn/Firmware/huginn');SDK=Path('C:/esp/v5.5.2/esp-idf')
OUT=Path('C:/HuginnAPP/build/rev24-preparation');OUT.mkdir(exist_ok=True)
local=ROOT/'components/mbedtls'
commands=json.loads((ROOT/'build-rev2.3-20261104/compile_commands.json').read_text())
results=[]
cases=[('main/main.c',ROOT/'main/main.c'),('esp_tls_mbedtls.c',ROOT/'components/esp-tls/huginn_settings_send_diag.c'),('esp_tls_mbedtls.c',ROOT/'components/esp-tls/esp_tls_mbedtls.c'),('esp_aes_dma_core.c',local/'port/aes/dma/esp_aes_dma_core.c'),('esp_aes_dma_core.c',local/'port/huginn_aes_alloc_diag.c')]
for suffix,path in cases:
    c=next(x for x in commands if x['file'].replace('\\','/').endswith(suffix))
    args=shlex.split(c['command'].replace('\\"','"'),posix=False)
    args=[x[1:-1] if x.startswith('"') and x.endswith('"') else x for x in args]
    cleaned=[];skip=False
    for arg in args:
        if skip:skip=False;continue
        if arg in ('-o','-MF','-MT','-MQ'):skip=True;continue
        if arg in ('-c','-MD','-MMD','-MP'):continue
        if arg.replace('\\','/')==c['file'].replace('\\','/'):continue
        cleaned.append(arg.replace('\\','/').replace((SDK/'components/mbedtls').as_posix(),local.as_posix()))
    cleaned += ['-I'+str(local/'port/include'),'-I'+str(ROOT/'components/esp-tls'),'-I'+str(SDK/'components/esp_timer/include'),'-fsyntax-only','-Wall','-Werror=misleading-indentation',str(path)]
    p=subprocess.run(cleaned,cwd=ROOT/'build-rev2.3-20261104',capture_output=True,text=True)
    (OUT/(path.name+'.syntax.log')).write_text(p.stdout+p.stderr)
    results.append({'file':str(path),'exit_code':p.returncode,'command':cleaned,'mode':'syntax only using existing Rev. 2.3 generated headers; no firmware build'})
    print(path.name,p.returncode,p.stderr[-500:])
(OUT/'xtensa-checks.json').write_text(json.dumps(results,indent=2))
assert all(r['exit_code']==0 for r in results)
