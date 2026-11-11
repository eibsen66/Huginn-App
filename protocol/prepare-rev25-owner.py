"""Prepare fresh owner scripts only. No target build, flash or serial access."""
from pathlib import Path
import hashlib,json
home=Path('C:/HuginnEIS');root=home/'Huginn/Firmware/huginn';tools=home/'Tools';out=Path('C:/HuginnAPP/build/rev25-owner');out.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
preserve=json.loads(Path('C:/HuginnAPP/build/pairing-review/rev24-preservation.json').read_text())
assert all(sha(Path(p))==h for p,h in preserve.items()),'Retained Rev. 2.4 evidence changed'
review=json.loads(Path('C:/HuginnAPP/build/pairing-review/candidate-review.json').read_text())
assert sha(Path('C:/HuginnAPP/protocol/pairing-ui-rev25.patch'))==review['firmware_patch_sha256']
assert 'HuginnEIS Rev. 2.5' in (root/'CMakeLists.txt').read_text()
def translate(s):return s.replace('2.4','2.5').replace('rev24','rev25').replace(r'2\.4',r'2\.5').replace('build-rev2.5-20261104','build-rev2.5-20261105')
for p in home.glob('REV2.4-OWNER-*.ps1'):
 dest=home/p.name.replace('2.4','2.5');assert not dest.exists();dest.write_text(translate(p.read_text()),encoding='utf8',newline='\n')
for name in ['rev24_release.py','rev24_capture.py','rev24_read_diagnostic.py']:
 dest=tools/name.replace('rev24','rev25');assert not dest.exists();dest.write_text(translate((tools/name).read_text()),encoding='utf8',newline='\n')
for name in ['diagnostic-inputs.json','preserved-inputs.json']:
 dest=tools/('rev25-'+name);assert not dest.exists()
 dest.write_bytes((tools/'rev24-diagnostic-inputs.json').read_bytes() if name.startswith('diagnostic') else json.dumps(preserve,indent=2).encode())
# Require actual compilation/linkage of the reviewed pairing UI, as well as
# all inherited strict send/allocation diagnostic and artifact checks.
p=tools/'rev25_release.py';s=p.read_text();at=s.index('\ndef effective(build):')
s=s[:at]+'''
def pairing_selection(commands,map_text,nm):
    path=(ROOT/'main/huginn_flight_pairing_ui.c').resolve()
    matches=[c for c in commands if Path(c['file']).resolve()==path]
    need(len(matches)==1,'Pairing UI source not compiled exactly once')
    command=matches[0].get('command',' '.join(matches[0].get('arguments',[])))
    need(str(path).replace('\\\\','/').lower() in command.replace('\\\\','/').lower(),'Wrong pairing UI compiler source')
    need('libmain.a(huginn_flight_pairing_ui.c.obj)' in map_text,'Pairing UI object not linked')
    need(re.search(r'\\bhfp_ui_open$',nm,re.M),'Pairing UI entry not linked')
'''+s[at:]
s=s.replace("    need('--wrap=mbedtls_ssl_write'", "    pairing_selection(commands,map_text,nm)\n    need('--wrap=mbedtls_ssl_write'")
p.write_text(s,encoding='utf8',newline='\n')
# Capture only after offline verification; record intended artifact, never
# claim that a host artifact hash is a physical running-image readback.
p=home/'REV2.5-OWNER-CAPTURE.ps1';s=p.read_text();s="param([string]$BuildDir = 'C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.5-20261105', [string]$PreparationDir = 'C:/HuginnEIS/Evidence/REV2.5-PREPARATION')\n"+s
s=s.replace('# OWNER ONLY', "& $rev25Python -B 'C:/HuginnEIS/Tools/rev25_release.py' verify --build $BuildDir --preparation $PreparationDir\nif ($LASTEXITCODE -ne 0) { throw 'Intended Rev. 2.5 artifact not verified; capture not opened.' }\n# OWNER ONLY")
s=s.replace("'C:/HuginnEIS/Tools/rev25_capture.py'", "'C:/HuginnEIS/Tools/rev25_capture.py' --build $BuildDir")
p.write_text(s,encoding='utf8',newline='\n')
p=tools/'rev25_capture.py';s=p.read_text();marker="BASE=Path('C:/HuginnEIS/Evidence/REV2.5-COM5')"
s=s.replace(marker,"""import argparse, hashlib
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--build',required=True)
args=parser.parse_args()
intended_build=Path(args.build).resolve()
if intended_build.parent!=Path('C:/HuginnEIS/Huginn/Firmware/huginn').resolve() or not intended_build.name.startswith('build-rev2.5-'):
    raise ValueError('Expected verified Rev. 2.5 build directory')
intended_hash=hashlib.sha256((intended_build/'lvgl_porting.bin').read_bytes()).hexdigest()
"""+marker)
s=s.replace("facts={'pid':os.getpid()", "facts={'intended_revision':'HuginnEIS Rev. 2.5','intended_build':intended_build.as_posix(),'intended_app_sha256':intended_hash,'physical_image_readback':False,'pid':os.getpid()")
p.write_text(s,encoding='utf8',newline='\n')
p=home/'REV2.5-OWNER-READ-DIAGNOSTIC.ps1';s=p.read_text();s="param([string]$CaptureFolder)\n"+s
s=s.replace("$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop'\nif (-not $CaptureFolder) { throw 'Pass -CaptureFolder with the exact stopped ARMED Rev. 2.5 capture directory; no latest-folder fallback.' }")
s=s.replace("'C:/HuginnEIS/Tools/rev25_read_diagnostic.py'", "'C:/HuginnEIS/Tools/rev25_read_diagnostic.py' --folder $CaptureFolder")
p.write_text(s,encoding='utf8',newline='\n')
p=tools/'rev25_read_diagnostic.py';s=p.read_text();s=s.replace("p.add_argument('--folder')", "p.add_argument('--folder',required=True)")
s=s.replace("    choices=sorted(BASE.glob('console-*'))\n    folder=Path(a.folder).resolve() if a.folder else (choices[-1].resolve() if choices else None)", "    folder=Path(a.folder).resolve()")
s=s.replace("'settings_send_records':found", "'intended_revision':status.get('intended_revision'),'intended_app_sha256':status.get('intended_app_sha256'),'physical_image_readback':False,'settings_send_records':found")
p.write_text(s,encoding='utf8',newline='\n')
# Existing disposable tests adapted to new owner paths, without executing an
# actual build/flash/capture. Additional selection/reader cases follow separately.
s=translate(Path('C:/HuginnAPP/protocol/rev24/test-owner.py').read_text())
Path('C:/HuginnAPP/protocol/test-rev25-owner.py').write_text(s,encoding='utf8')
assert all(sha(Path(p))==h for p,h in preserve.items())
(out/'preservation.json').write_text(json.dumps({'retained_rev24_files':len(preserve),'unchanged':True},indent=2))
print('Prepared Rev. 2.5 owner scripts; retained',len(preserve),'Rev. 2.4 files unchanged. No target build/device action.')
