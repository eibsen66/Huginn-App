"""Prepare new owner files only; does not invoke build, flash or capture."""
from pathlib import Path
import hashlib,json,subprocess,sys
home=Path('C:/HuginnEIS');root=home/'Huginn/Firmware/huginn';tools=home/'Tools'
out=Path('C:/HuginnAPP/build/rev27-preparation');out.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(p):return {f.relative_to(p).as_posix():sha(f) for f in sorted(p.rglob('*')) if f.is_file() and '.git' not in f.parts and '__pycache__' not in f.parts}
subprocess.run(['node','C:/HuginnAPP/protocol/verify-aes-scratch-candidate.mjs'],check=True)
candidate=json.loads(Path('C:/HuginnAPP/build/aes-scratch-candidate/applied-candidate.json').read_text())
preserved=json.loads(Path('C:/HuginnAPP/build/aes-scratch-candidate/preserved.json').read_text())
for p in candidate['changes']:preserved.pop(p)
for p in list(home.glob('REV2.6-OWNER-*'))+list(tools.glob('rev26*')):
 if p.is_file():preserved[p.as_posix()]=sha(p)
for folder in [home/'Evidence/REV2.6-COM5',home/'Evidence/REV2.6-PREPARATION']:
 for p in folder.rglob('*'):
  if p.is_file():preserved[p.as_posix()]=sha(p)
for p in (root/'build-rev2.6-20261105').iterdir():
 if p.is_file():preserved[p.as_posix()]=sha(p)
for p in (root/'build-rev2.6-20261105/log').rglob('*'):
 if p.is_file():preserved[p.as_posix()]=sha(p)
assert all(sha(Path(p))==h for p,h in preserved.items())
def trans(s):return s.replace('2.6','2.7').replace('rev26','rev27').replace('Rev26','Rev27').replace(r'2\.6',r'2\.7')
def fresh(p,text):
 assert not p.exists(),str(p)+' already exists; preserve it'
 p.write_text(text,encoding='utf8',newline='\n')
destinations=[home/p.name.replace('2.6','2.7') for p in home.glob('REV2.6-OWNER-*.ps1')]
destinations += [tools/('rev27_'+n) for n in ['release.py','capture.py','read_diagnostic.py']]
destinations += [tools/('rev27-'+n+'.json') for n in ['diagnostic-inputs','preserved-inputs','functional-inputs']]
assert all(not p.exists() for p in destinations)
assert not (root/'build-rev2.7-20261105').exists()
assert not (home/'Evidence/REV2.7-PREPARATION').exists()
for p in home.glob('REV2.6-OWNER-*.ps1'):fresh(home/p.name.replace('2.6','2.7'),trans(p.read_text(encoding='utf-8-sig')))
for n in ['release.py','capture.py','read_diagnostic.py']:fresh(tools/('rev27_'+n),trans((tools/('rev26_'+n)).read_text(encoding='utf-8-sig')))
pins=json.loads((tools/'rev26-diagnostic-inputs.json').read_text())
assert all(tree(Path('C:/esp/v5.5.2/esp-idf/components')/n)==h for n,h in pins['original'].items())
pins['local']={n:tree(root/'components'/n) for n in pins['original']}
fresh(tools/'rev27-diagnostic-inputs.json',json.dumps(pins,indent=2))
fresh(tools/'rev27-preserved-inputs.json',json.dumps(preserved,indent=2))
proof_paths=['C:/HuginnAPP/protocol/aes-s3-output-scratch-rev27.patch','C:/HuginnAPP/protocol/aes-scratch-host.c','C:/HuginnAPP/protocol/aes-scratch-tlsf-host.c','C:/HuginnAPP/protocol/check-aes-scratch-syntax.py','C:/HuginnAPP/build/aes-scratch-candidate/checks.json','C:/HuginnAPP/build/aes-scratch-candidate/host.c','C:/HuginnAPP/build/aes-scratch-candidate/host.log','C:/HuginnAPP/build/aes-scratch-candidate/tlsf-host.log','C:/HuginnAPP/build/aes-scratch-candidate/syntax-checks.json']
functional={'revision':'HuginnEIS Rev. 2.7','scope':'ESP32-S3 output bounce only, no input bounce','scratch_bytes':1024,'aes_block_bytes':16,'measured_external_cache_line':64,'target_descriptor_bytes':12,'source_pins':{p:v['after_sha256'] for p,v in candidate['changes'].items()},'review_evidence':{p:sha(Path(p)) for p in proof_paths},'target_build_run':False,'physical_validation':False}
fresh(tools/'rev27-functional-inputs.json',json.dumps(functional,indent=2))
p=tools/'rev27_release.py';s=p.read_text()
at=s.index('\ndef config_values(')
s=s[:at]+'''
def functional_inputs():
    expected=load(Path(__file__).with_name('rev27-functional-inputs.json'))
    need(expected['revision']==VERSION and expected['scratch_bytes']==1024,'Wrong functional candidate')
    for path,h in {**expected['source_pins'],**expected['review_evidence']}.items():
        need(digest(Path(path))==h,'Functional candidate or test evidence changed: '+path)
    return expected
'''+s[at:]
s=s.replace("paths.extend([Path(__file__).with_name('rev27_capture.py')", "paths.append(Path(__file__).with_name('rev27-functional-inputs.json'))\n    paths.extend([Path(__file__).with_name('rev27_capture.py')")
s=s.replace("'sources':base.source_pins(ROOT),'diagnostics':diagnostic_inputs(),'toolchain':toolchain(),", "'sources':base.source_pins(ROOT),'diagnostics':diagnostic_inputs(),'functional':functional_inputs(),'toolchain':toolchain(),")
s=s.replace("need(diagnostic_inputs()==p['diagnostics'],'Diagnostic inputs changed')", "need(diagnostic_inputs()==p['diagnostics'],'Diagnostic inputs changed')\n    need(functional_inputs()==p['functional'],'Functional candidate changed')")
s=s.replace("'diagnostics':p['diagnostics'],'scripts':p['scripts']", "'diagnostics':p['diagnostics'],'functional':p['functional'],'scripts':p['scripts']")
s=s.replace("s['diagnostics']==p['diagnostics'] and s['origin']==ORIGIN", "s['diagnostics']==p['diagnostics'] and s['functional']==p['functional'] and s['origin']==ORIGIN")
s=s.replace("Local instrumented components compiled/linked; origin ","Reviewed functional S3 AES source and local diagnostic components compiled/linked; origin ")
p.write_text(s,encoding='utf8',newline='\n')
test=trans(Path('C:/HuginnAPP/protocol/test-rev26-owner.py').read_text())
test=test.replace('build/rev27-preparation/probe-host.log','build/rev26-preparation/probe-host.log')
test=test.replace("('diagnostic_inputs',{'fixture':'diag'})", "('diagnostic_inputs',{'fixture':'diag'}),('functional_inputs',{'fixture':'functional'})")
test=test.replace("'toolchain':r.toolchain(),'scripts':r.scripts()", "'functional':r.functional_inputs(),'toolchain':r.toolchain(),'scripts':r.scripts()")
Path('C:/HuginnAPP/protocol/test-rev27-owner.py').write_text(test,encoding='utf8',newline='\n')
assert all(sha(Path(p))==h for p,h in preserved.items())
(out/'created.json').write_text(json.dumps({'new_files':[p.as_posix() for p in destinations],'retained_files':len(preserved),'functional_candidate':functional},indent=2))
print('Prepared Rev. 2.7 owner files only; retained files:',len(preserved))

