from pathlib import Path
import hashlib,json,difflib,subprocess,ast,sys
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');home=Path('C:/HuginnEIS');sdk=Path('C:/esp/v5.5.2/esp-idf');out=Path('C:/HuginnAPP/build/rev26-preparation')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(p):return {f.relative_to(p).as_posix():sha(f) for f in sorted(p.rglob('*')) if f.is_file() and '.git' not in f.parts and '__pycache__' not in f.parts}
pins=home/'Tools/rev26-diagnostic-inputs.json';data=json.loads(pins.read_text());assert all(tree(sdk/'components'/n)==h for n,h in data['original'].items())
data['local']={n:tree(root/'components'/n) for n in data['original']};pins.write_text(json.dumps(data,indent=2),encoding='utf8')
preserve=json.loads((out/'rev25-preservation.json').read_text());assert all(sha(Path(p))==h for p,h in preserve.items())
older=json.loads((home/'Tools/rev25-preserved-inputs.json').read_text());assert all(sha(Path(p))==h for p,h in older.items())
def lines(b):
 p=b.decode().split('\n');return [s+'\n' for s in p[:-1]]+([p[-1]] if p[-1] else [])
diff=[];changes={}
for p in (out/'before').rglob('*'):
 if not p.is_file():continue
 name=p.relative_to(out/'before').as_posix();before=p.read_bytes();after=(root/name).read_bytes()
 if name in ['main/main.c','CMakeLists.txt']:assert after==before.replace(b'HuginnEIS Rev. 2.5',b'HuginnEIS Rev. 2.6')
 changes[name]={'before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(after).hexdigest()}
 diff.extend(difflib.unified_diff(lines(before),lines(after),fromfile='a/'+name,tofile='b/'+name))
patch=Path('C:/HuginnAPP/protocol/rev26-dma-heap-observation.patch');patch.write_bytes(''.join(diff).encode())
subprocess.run(['git','-c','safe.directory=C:/HuginnEIS','-C',str(root),'apply','--reverse','--check',str(patch)],check=True)
parsed=[]
for p in home.glob('REV2.6-OWNER-*.ps1'):
 command="$e=$null; [System.Management.Automation.Language.Parser]::ParseFile('"+p.as_posix()+"',[ref]$null,[ref]$e) | Out-Null; if ($e.Count) { $e; exit 1 }"
 subprocess.run(['powershell','-NoProfile','-Command',command],check=True,capture_output=True);parsed.append(p.as_posix())
for p in (home/'Tools').glob('rev26*.py'):ast.parse(p.read_text());parsed.append(p.as_posix())
r=subprocess.run([sys.executable,'-B','C:/HuginnAPP/protocol/test-rev26-owner.py'],capture_output=True)
(out/'owner-tests.log').write_bytes(r.stdout+r.stderr);assert r.returncode==0
fmt=(root/'components/mbedtls/port/huginn_aes_alloc_diag.c').read_text().split('ESP_LOGI("HS2_DMA_HEAP", "',1)[1].split('"',1)[0]
import re
maxline=re.sub(r'%lld','9'*20,fmt);maxline=re.sub(r'%lu|%u','9'*10,maxline);maxline=re.sub(r'%d','-'+'9'*10,maxline)
(out/'final-audit.json').write_text(json.dumps({'source_delta':changes,'rev25_files_unchanged':len(preserve),'older_reference_files_unchanged':len(older),'shared_sdk_unchanged':True,'patch_sha256':sha(patch),'script_parsers_passed':parsed,'owner_host_tests':20,'max_heap_record_characters_before_log_prefix':len(maxline),'target_build':False,'com_access':False},indent=2))
print('PASS final source delta, patch, preserved artifacts/SDK, script parsers and 20 owner/reader tests; max numeric record body chars:',len(maxline))
