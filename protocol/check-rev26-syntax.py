from pathlib import Path
import json,shlex,subprocess
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');out=Path('C:/HuginnAPP/build/rev26-preparation');build=root/'build-rev2.5-20261105'
commands=json.loads((build/'compile_commands.json').read_text());results=[]
for path in ['main/main.c','components/mbedtls/port/aes/dma/esp_aes_dma_core.c','components/mbedtls/port/huginn_aes_alloc_diag.c']:
 c=next(c for c in commands if Path(c['file']).resolve()==(root/path).resolve());args=shlex.split(c['command'].replace('\\"','"'),posix=False);args=[a[1:-1] if a.startswith('"') and a.endswith('"') else a for a in args]
 clean=[];skip=False
 for a in args:
  if skip:skip=False;continue
  if a in ['-o','-MF','-MT','-MQ']:skip=True;continue
  if a in ['-c','-MD','-MMD','-MP']:continue
  clean.append(a)
 clean+=['-fsyntax-only','-Wall','-Werror=misleading-indentation']
 p=subprocess.run(clean,cwd=build,capture_output=True,text=True);(out/(Path(path).name+'.syntax.log')).write_text(p.stdout+p.stderr)
 results.append({'file':path,'exit_code':p.returncode,'command':clean,'mode':'syntax only; retained Rev. 2.5 generated headers; no target build'})
 print(path,p.returncode,p.stderr[-600:])
(out/'syntax-checks.json').write_text(json.dumps(results,indent=2));assert all(r['exit_code']==0 for r in results)
