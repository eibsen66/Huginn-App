"""Existing Xtensa compiler, syntax only. Never invoke idf.py/cmake/ninja/build."""
import json,subprocess,shlex
from pathlib import Path
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn')
out=Path('C:/HuginnAPP/build/rev23-preparation')
old=json.loads((root/'build-rev2.2-20261102/compile_commands.json').read_text())
main=json.loads(Path('C:/HuginnAPP/build/settings-indentation-fix/target-syntax-result.json').read_text())['command']
def args(c):
    # Existing CMake Windows commands use backslash-escaped quote definitions.
    a=shlex.split(c['command'].replace('\\"','"'),posix=False)
    return [x[1:-1] if x.startswith('"') and x.endswith('"') else x for x in a]
def clean(a):
    result=[];skip=False
    for item in a:
        if skip:skip=False;continue
        if item in ('-o','-MF','-MT','-MQ'):skip=True;continue
        if item in ('-c','-MD','-MMD','-MP'):continue
        result.append(item)
    if '-fsyntax-only' not in result:result.append('-fsyntax-only')
    result.extend(['-IC:/HuginnEIS/Huginn/Firmware/huginn/components/esp-tls','-Werror=misleading-indentation'])
    return result
results=[]
cases=[('main',main)]
for suffix,new in [('components/esp-tls/esp_tls_mbedtls.c',root/'components/esp-tls/esp_tls_mbedtls.c'),('components/esp_https_server/src/https_server.c',root/'components/esp_https_server/src/https_server.c')]:
    command=next(c for c in old if c['file'].replace('\\','/').endswith(suffix))
    a=args(command);a[-1]=new.as_posix();cases.append((new.name,a))
a=cases[1][1].copy();a[-1]=(root/'components/esp-tls/huginn_settings_send_diag.c').as_posix();cases.append(('diagnostic',a))
for name,command in cases:
    command=clean(command)
    p=subprocess.run(command,cwd=root/'build-rev2.2-20261102',capture_output=True,text=True)
    (out/(name+'.syntax.stdout')).write_text(p.stdout)
    (out/(name+'.syntax.stderr')).write_text(p.stderr)
    results.append({'name':name,'exit_code':p.returncode,'command':command,'mode':'syntax only; existing Rev. 2.2 generated headers; no object/link/target build'})
    print(name,p.returncode,p.stderr[-800:])
(out/'target-syntax.json').write_text(json.dumps(results,indent=2))
raise SystemExit(any(x['exit_code'] for x in results))
