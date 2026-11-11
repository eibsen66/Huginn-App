"""Focused, owner-authorized pairing UI/revision source update. No build/hardware."""
from pathlib import Path
import hashlib,json,difflib
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');out=Path('C:/HuginnAPP/build/pairing-review');out.mkdir(exist_ok=True)
targets=['main/huginn_flight_pairing_ui.c','main/main.c','CMakeLists.txt']
before={p:(root/p).read_bytes() for p in targets}
for p,b in before.items():
 dest=out/'firmware-before'/p;dest.parent.mkdir(parents=True,exist_ok=True)
 with dest.open('xb') as f:f.write(b)
# Pin retained Rev. 2.4 build/preparation/evidence and owner scripts before writes.
preserve={}
folders=list(root.glob('build-rev2.4-*'))+list(Path('C:/HuginnEIS/Evidence').glob('REV2.4-*'))
for folder in folders:
 for p in folder.rglob('*'):
  if p.is_file():preserve[p.as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
for p in list(Path('C:/HuginnEIS').glob('REV2.4*'))+list(Path('C:/HuginnEIS/Tools').glob('rev24*')):
 if p.is_file():preserve[p.as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
(out/'rev24-preservation.json').write_text(json.dumps(preserve,indent=2))
p='main/huginn_flight_pairing_ui.c';b=before[p]
old=b'    /* Confirmation is the physical replacement intent.';new=b'    /* Selecting Pair Flight Courier is the physical replacement intent.'
assert b.count(old)==1;b=b.replace(old,new)
old=b'    confirm(false);';new=b'    revoke_confirmation = false;\n    confirmed(event);';assert b.count(old)==1
b=b.replace(old,new)
(root/p).write_bytes(b)
for p in ['main/main.c','CMakeLists.txt']:
 b=before[p];old=b'HuginnEIS Rev. 2.4';assert b.count(old)==1;(root/p).write_bytes(b.replace(old,b'HuginnEIS Rev. 2.5'))
diff=[]
for p,b in before.items():
 diff.extend(difflib.unified_diff(b.decode().splitlines(True),(root/p).read_bytes().decode().splitlines(True),fromfile='a/'+p,tofile='b/'+p))
(out/'pairing-ui-rev25.patch').write_text(''.join(diff),encoding='utf8')
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in preserve.items())
print('Prepared focused Rev. 2.5 source diff; retained',len(preserve),'Rev. 2.4 files unchanged; no target build')
