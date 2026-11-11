"""Xtensa syntax only, using retained Rev. 2.4 generated headers. No target build."""
from pathlib import Path
import json,shlex,subprocess,hashlib
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');out=Path('C:/HuginnAPP/build/pairing-review')
build=root/'build-rev2.4-20261104';commands=json.loads((build/'compile_commands.json').read_text())
results=[]
for name in ['huginn_flight_pairing_ui.c','main.c']:
 c=next(c for c in commands if c['file'].replace('\\','/').endswith('/'+name));args=shlex.split(c['command'].replace('\\"','"'),posix=False)
 args=[a[1:-1] if a.startswith('"') and a.endswith('"') else a for a in args]
 clean=[];skip=False
 for a in args:
  if skip:skip=False;continue
  if a in ['-o','-MF','-MT','-MQ']:skip=True;continue
  if a in ['-c','-MD','-MMD','-MP']:continue
  clean.append(a)
 clean+=['-fsyntax-only','-Wall','-Werror=misleading-indentation']
 p=subprocess.run(clean,cwd=build,capture_output=True,text=True)
 (out/(name+'.syntax.log')).write_text(p.stdout+p.stderr)
 results.append({'source':name,'exit_code':p.returncode,'command':clean,'target_build':False,'generated_headers':'retained Rev. 2.4'})
 print(name,p.returncode,p.stderr[-500:])
preserved=json.loads((out/'rev24-preservation.json').read_text());assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in preserved.items())
(out/'target-checks.json').write_text(json.dumps(results,indent=2));print('PASS unchanged retained Rev. 2.4 inventory:',len(preserved))
assert all(r['exit_code']==0 for r in results)
