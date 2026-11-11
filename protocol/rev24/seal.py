"""Refresh final source pins and create owner handoff before preparation attestation."""
from pathlib import Path
import hashlib,json,subprocess,sys
home=Path('C:/HuginnEIS');root=home/'Huginn/Firmware/huginn';sdk=Path('C:/esp/v5.5.2/esp-idf')
out=Path('C:/HuginnAPP/build/rev24-preparation')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(p):return {f.relative_to(p).as_posix():sha(f) for f in sorted(p.rglob('*')) if f.is_file() and '.git' not in f.parts and '__pycache__' not in f.parts}
pins=home/'Tools/rev24-diagnostic-inputs.json';data=json.loads(pins.read_text())
assert all(tree(sdk/'components'/n)==v for n,v in data['original'].items())
data['local']={n:tree(root/'components'/n) for n in data['original']}
pins.write_text(json.dumps(data,indent=2),encoding='utf8')
preserved=json.loads((out/'preservation-before.json').read_text());assert all(sha(Path(p))==v for p,v in preserved.items())
changed={}
for name in data['original']:
    old=data['original'][name];new=data['local'][name]
    changed[name]={'changed':[p for p in old if new.get(p)!=old[p]],'added':[p for p in new if p not in old],'removed':[p for p in old if p not in new]}
(out/'component-delta.json').write_text(json.dumps(changed,indent=2))
# Save narrowly focused SDK delta, not the unrelated dirty project diff.
diff=[]
import difflib
for name,items in changed.items():
    for relative in items['changed']+items['added']:
        a=sdk/'components'/name/relative;b=root/'components'/name/relative
        if a.suffix not in ('.c','.h','.txt'):continue
        diff.extend(difflib.unified_diff(a.read_text().splitlines(True) if a.exists() else [],b.read_text().splitlines(True),fromfile='shared/'+name+'/'+relative,tofile='local/'+name+'/'+relative))
(out/'focused-component-diff.patch').write_text(''.join(diff),encoding='utf8')
for p in home.glob('REV2.4-OWNER-*.ps1'):
    # Parser only; do not execute owner commands.
    command="$e=$null; [System.Management.Automation.Language.Parser]::ParseFile('"+p.as_posix()+"',[ref]$null,[ref]$e) | Out-Null; if ($e.Count) { $e; exit 1 }"
    subprocess.run(['powershell','-NoProfile','-Command',command],check=True,capture_output=True)
result=subprocess.run([sys.executable,'-B','C:/HuginnAPP/protocol/rev24/test-owner.py'],capture_output=True)
(out/'owner-tests.log').write_bytes(result.stdout+result.stderr);assert result.returncode==0
print('PASS final SDK/source preservation, owner PowerShell parser checks and 13 disposable provenance/reader tests')
