"""Validate/seal preparation only. Never call build/flash/capture actions."""
from pathlib import Path
import ast,json,hashlib,subprocess,sys
home=Path('C:/HuginnEIS');tools=home/'Tools';out=Path('C:/HuginnAPP/build/rev27-preparation')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
# Preserve this task's empty, failed pre-attestation attempt, never an existing
# receipt or owner's build. Both resolved paths are fixed Evidence children.
attempt=home/'Evidence/REV2.7-PREPARATION'
if attempt.exists() and not any(attempt.iterdir()):
 failed=home/'Evidence/REV2.7-PREPARATION-ENV-FAILED'
 assert attempt.resolve().parent==(home/'Evidence').resolve()
 assert failed.resolve().parent==(home/'Evidence').resolve() and not failed.exists()
 attempt.rename(failed)
 (failed/'prepare-without-environment-failed.log').write_bytes((out/'prepare.log').read_bytes())
p=tools/'rev27_capture.py';s=p.read_text()
if 'Saved diagnostic command:' not in s:
 s+='    print("Saved diagnostic command: powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-READ-DIAGNOSTIC.ps1 -CaptureFolder \'"+OUT.as_posix()+"\'",flush=True)\n'
 p.write_text(s,encoding='utf8',newline='\n')
parsed=[]
for p in home.glob('REV2.7-OWNER-*.ps1'):
 command="$e=$null; [System.Management.Automation.Language.Parser]::ParseFile('"+p.as_posix()+"',[ref]$null,[ref]$e) | Out-Null; if ($e.Count) { $e; exit 1 }"
 subprocess.run(['powershell','-NoProfile','-Command',command],check=True,capture_output=True);parsed.append(p.as_posix())
for p in tools.glob('rev27*.py'):ast.parse(p.read_text());parsed.append(p.as_posix())
r=subprocess.run([sys.executable,'-B','C:/HuginnAPP/protocol/test-rev27-owner.py'],capture_output=True)
(out/'owner-tests.log').write_bytes(r.stdout+r.stderr);assert r.returncode==0,r.stderr.decode(errors='replace')
assert b'Ran 24 tests' in r.stderr
env=subprocess.run(['powershell','-NoProfile','-ExecutionPolicy','Bypass','-File',str(home/'REV2.7-OWNER-ENV.ps1')],capture_output=True)
(out/'environment-check.log').write_bytes(env.stdout+env.stderr);assert env.returncode==0,env.stderr.decode(errors='replace')
for action in ['prepare','check']:
 r=subprocess.run([sys.executable,'-B',str(tools/'rev27_release.py'),action],capture_output=True)
 (out/(action+'.log')).write_bytes(r.stdout+r.stderr);assert r.returncode==0,r.stderr.decode(errors='replace')
preserved=json.loads((tools/'rev27-preserved-inputs.json').read_text());assert all(sha(Path(p))==h for p,h in preserved.items())
assert not (home/'Huginn/Firmware/huginn/build-rev2.7-20261105').exists()
receipt={'scripts_parsed':parsed,'owner_host_tests':24,'environment':'existing IDF 5.5.2/Python/dependencies checked, no install','prepared_sha256':sha(home/'Evidence/REV2.7-PREPARATION/prepared.json'),'functional_inputs_sha256':sha(tools/'rev27-functional-inputs.json'),'preserved_files_unchanged':len(preserved),'fresh_build_directory_absent':True,'target_build_run':False,'com_access':False}
(out/'final-audit.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt,indent=2))
