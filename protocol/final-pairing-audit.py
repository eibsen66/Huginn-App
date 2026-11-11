from pathlib import Path
import hashlib,json,difflib,subprocess
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');out=Path('C:/HuginnAPP/build/pairing-review')
def sha(b):return hashlib.sha256(b).hexdigest()
def lines(b):
 # Split only LF, preserving the retained mixed carriage-return bytes.
 parts=b.decode('utf8').split('\n');return [p+'\n' for p in parts[:-1]]+([parts[-1]] if parts[-1] else [])
diff=[]
for p in ['main/huginn_flight_pairing_ui.c','main/main.c','CMakeLists.txt']:
 before=(out/'firmware-before'/p).read_bytes();after=(root/p).read_bytes()
 if p!='main/huginn_flight_pairing_ui.c':assert after==before.replace(b'HuginnEIS Rev. 2.4',b'HuginnEIS Rev. 2.5')
 diff.extend(difflib.unified_diff(lines(before),lines(after),fromfile='a/'+p,tofile='b/'+p))
patch=''.join(diff).encode();dest=Path('C:/HuginnAPP/protocol/pairing-ui-rev25.patch');dest.write_bytes(patch);(out/'pairing-ui-rev25.patch').write_bytes(patch)
subprocess.run(['git','-c','safe.directory=C:/HuginnEIS','-C',str(root),'apply','--reverse','--check',str(dest)],check=True)
old=json.loads((root/'build-rev2.4-20261104/owner-build-start.json').read_text())['sources']
changes=[p for p,h in old.items() if not (root/p).is_file() or sha((root/p).read_bytes())!=h]
assert sorted(changes)==sorted(['main/huginn_flight_pairing_ui.c','main/main.c','CMakeLists.txt']),changes
preserve=json.loads((out/'rev24-preservation.json').read_text());assert all(sha(Path(p).read_bytes())==h for p,h in preserve.items())
(out/'firmware-audit.json').write_text(json.dumps({'changed_from_retained_rev24_inputs':changes,'main_only_revision_bytes_changed':True,'rev24_files_unchanged':len(preserve),'patch_sha256':sha(patch),'reverse_apply_check':True,'target_build':False,'com_access':False},indent=2))
print('PASS exact focused source delta and reverse patch check; retained Rev. 2.4 files unchanged:',len(preserve))
