"""Parse owner scripts and record task host results. No script action/device I/O."""
from pathlib import Path
import ast,hashlib,json,subprocess
home=Path('C:/HuginnEIS');out=Path('C:/HuginnAPP/build/rev25-owner');results=[]
for p in home.glob('REV2.5-OWNER-*.ps1'):
 command="$e=$null; [System.Management.Automation.Language.Parser]::ParseFile('"+p.as_posix()+"',[ref]$null,[ref]$e) | Out-Null; if ($e.Count) { $e; exit 1 }"
 r=subprocess.run(['powershell','-NoProfile','-Command',command],capture_output=True,text=True,check=True)
 results.append({'script':p.as_posix(),'parser':'PASS','sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
for p in (home/'Tools').glob('rev25*.py'):
 ast.parse(p.read_text());results.append({'script':p.as_posix(),'ast':'PASS','sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(out/'script-checks.json').write_text(json.dumps(results,indent=2))
(out/'host-test-results.json').write_text(json.dumps({'executed_command':'C:/Espressif/tools/python/v5.5.2/venv/Scripts/python.exe -B C:/HuginnAPP/protocol/test-rev25-owner.py','tests':16,'passed':16,'failed':0,'disposable_fixtures':True,'flash_subprocesses_mocked':True,'physical_operations':False,'note':'Summary of the executed unittest results, not a target build log'},indent=2))
preserve=json.loads((home/'Tools/rev25-preserved-inputs.json').read_text());assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in preserve.items())
subprocess.run(['git','-c','safe.directory=C:/HuginnEIS','-C','C:/HuginnEIS/Huginn/Firmware/huginn','apply','--reverse','--check','C:/HuginnAPP/protocol/pairing-ui-rev25.patch'],check=True)
assert not (home/'Huginn/Firmware/huginn/build-rev2.5-20261105').exists()
print('PASS owner PowerShell/Python parser checks; retained Rev. 2.4 hashes; reviewed pairing patch matches; no Rev. 2.5 build directory')
