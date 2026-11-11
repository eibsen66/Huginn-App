"""Finish formatting, pins and handoff; never builds or touches hardware."""
from pathlib import Path
import hashlib,json
root=Path('C:/HuginnEIS/Huginn/Firmware/huginn');home=Path('C:/HuginnEIS');sdk=Path('C:/esp/v5.5.2/esp-idf')
p=root/'components/mbedtls/port/aes/dma/esp_aes_dma_core.c'
s=p.read_text().replace('        huginn_aes_alloc_diag_failure(chunk_len','            huginn_aes_alloc_diag_failure(chunk_len')
p.write_text(s,encoding='utf8',newline='\n')
p=home/'Tools/rev24_release.py';s=p.read_text()
s=s.replace("paths.append(Path(__file__).with_name('rev24_capture.py'))", "paths.extend([Path(__file__).with_name('rev24_capture.py'),Path(__file__).with_name('rev24_read_diagnostic.py')])")
# Pin the full previous artifact and all saved Rev. 2.3 evidence separately.
s=s.replace("'seed_sha256':digest(SEED),'saved_flash_sha256':digest(SAVED),'scripts':scripts()", "'seed_sha256':digest(SEED),'saved_flash_sha256':digest(SAVED),'scripts':scripts(),\n        'preservation_receipt_sha256':digest(Path(__file__).with_name('rev24-preserved-inputs.json'))")
s=s.replace("    need(scripts()==p['scripts'],'Owner script changed since preparation')", "    need(scripts()==p['scripts'],'Owner script changed since preparation')\n    need(digest(Path(__file__).with_name('rev24-preserved-inputs.json'))==p['preservation_receipt_sha256'],'Preservation receipt changed')")
p.write_text(s,encoding='utf8',newline='\n')
before=Path('C:/HuginnAPP/build/rev24-preparation/preservation-before.json')
data=json.loads(before.read_text())
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==v for p,v in data.items()),'Rev. 2.3 evidence changed'
target=home/'Tools/rev24-preserved-inputs.json';assert not target.exists();target.write_bytes(before.read_bytes())
def tree(p):return {f.relative_to(p).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(p.rglob('*')) if f.is_file() and '.git' not in f.parts and '__pycache__' not in f.parts}
p=home/'Tools/rev24-diagnostic-inputs.json';pins=json.loads(p.read_text())
assert all(tree(sdk/'components'/n)==v for n,v in pins['original'].items())
pins['local']={n:tree(root/'components'/n) for n in pins['original']}
p.write_text(json.dumps(pins,indent=2),encoding='utf8')
print('Preserved',len(data),'Rev. 2.3/reference files unchanged; shared SDK unchanged; updated local input pins')
